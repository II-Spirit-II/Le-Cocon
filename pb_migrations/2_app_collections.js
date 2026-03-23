/**
 * Migration 2 — Collections applicatives
 *
 * Ordre de création pour gérer la dépendance circulaire
 * children ↔ parent_children :
 *
 *   1. children      (règle simplifiée : assistante seulement)
 *   2. parent_children  (peut référencer children qui existe)
 *   3. children      (màj règle : ajoute l'accès parent via parent_children)
 *   4. menus
 *   5. daily_logs
 *   6. news
 *   7. parent_notes
 *   8. invite_codes
 *
 * Compatibilité : PocketBase v0.36+
 */
migrate((app) => {

  // Résoudre l'ID de la collection users dynamiquement
  const usersId = app.findCollectionByNameOrId("users").id;

  // ── 1. children (règle provisoire sans parent_children) ──────
  const children = new Collection({
    name: "children",
    type: "base",
    listRule: "assistante = @request.auth.id",
    viewRule: "assistante = @request.auth.id",
    createRule: "@request.auth.role = 'assistante'",
    updateRule: "@request.auth.role = 'assistante' && assistante = @request.auth.id",
    deleteRule: "@request.auth.role = 'assistante' && assistante = @request.auth.id",
    fields: [
      { name: "first_name",  type: "text",     required: true,  max: 100 },
      { name: "last_name",   type: "text",     required: true,  max: 100 },
      { name: "birth_date",  type: "text",     required: true,  max: 10  },
      {
        name: "avatar",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 2097152,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        thumbs: ["100x100", "400x400"]
      },
      {
        name: "assistante",
        type: "relation",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1
      }
    ],
    indexes: [
      "CREATE INDEX idx_children_assistante ON children (assistante)"
    ]
  });
  app.save(children);

  // ── 2. parent_children (référence children.id — OK car children existe) ──
  const parentChildren = new Collection({
    name: "parent_children",
    type: "base",
    listRule: "parent = @request.auth.id || @collection.children.assistante = @request.auth.id",
    viewRule: "parent = @request.auth.id || @collection.children.assistante = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: null,
    deleteRule: "@request.auth.role = 'assistante'",
    fields: [
      {
        name: "parent",
        type: "relation",
        required: true,
        collectionId: usersId,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "child",
        type: "relation",
        required: true,
        collectionId: children.id,
        cascadeDelete: true,
        maxSelect: 1
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_parent_children_unique ON parent_children (parent, child)",
      "CREATE INDEX idx_parent_children_child ON parent_children (child)"
    ]
  });
  app.save(parentChildren);

  // ── 3. children — màj des règles complètes (parent_children existe maintenant) ──
  const childrenFull = app.findCollectionByNameOrId("children");
  const childrenRule = "assistante = @request.auth.id || (@collection.parent_children.child = id && @collection.parent_children.parent = @request.auth.id)";
  childrenFull.listRule = childrenRule;
  childrenFull.viewRule = childrenRule;
  app.save(childrenFull);

  // ── 4. menus ─────────────────────────────────────────────────
  const menus = new Collection({
    name: "menus",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'assistante'",
    updateRule: "@request.auth.role = 'assistante'",
    deleteRule: "@request.auth.role = 'assistante'",
    fields: [
      { name: "date",        type: "text", required: true, max: 10  },
      {
        name: "meal_type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["petit-dejeuner", "dejeuner", "gouter"]
      },
      { name: "description", type: "text", required: true, max: 500 }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_menus_date_type ON menus (date, meal_type)"
    ]
  });
  app.save(menus);

  // ── 5. daily_logs ─────────────────────────────────────────────
  const logChildRule = "child.assistante = @request.auth.id || (@collection.parent_children.child = child && @collection.parent_children.parent = @request.auth.id)";

  const dailyLogs = new Collection({
    name: "daily_logs",
    type: "base",
    listRule: logChildRule,
    viewRule: logChildRule,
    createRule: "@request.auth.role = 'assistante'",
    updateRule: "@request.auth.role = 'assistante' && author = @request.auth.id",
    deleteRule: "@request.auth.role = 'assistante' && author = @request.auth.id",
    fields: [
      {
        name: "child",
        type: "relation",
        required: true,
        collectionId: children.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "author",
        type: "relation",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1
      },
      { name: "date",    type: "text",   required: true,  max: 10 },
      { name: "meals",   type: "json",   required: false, maxSize: 10000 },
      { name: "nap",     type: "json",   required: false, maxSize: 2000  },
      {
        name: "mood",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["grognon", "calme", "joyeux"]
      },
      { name: "health",  type: "json",   required: false, maxSize: 2000 },
      { name: "changes", type: "number", required: false, min: 0, max: 50 },
      { name: "notes",   type: "text",   required: false, max: 2000 },
      {
        name: "menu",
        type: "relation",
        required: false,
        collectionId: menus.id,
        cascadeDelete: false,
        maxSelect: 1
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_daily_logs_child_date ON daily_logs (child, date)",
      "CREATE INDEX idx_daily_logs_date ON daily_logs (date)"
    ]
  });
  app.save(dailyLogs);

  // ── 6. news ───────────────────────────────────────────────────
  const newsChildRule = "child.assistante = @request.auth.id || (@collection.parent_children.child = child && @collection.parent_children.parent = @request.auth.id)";

  const news = new Collection({
    name: "news",
    type: "base",
    listRule: newsChildRule,
    viewRule: newsChildRule,
    createRule: "@request.auth.role = 'assistante'",
    updateRule: "@request.auth.role = 'assistante' && author = @request.auth.id",
    deleteRule: "@request.auth.role = 'assistante' && author = @request.auth.id",
    fields: [
      {
        name: "child",
        type: "relation",
        required: true,
        collectionId: children.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "author",
        type: "relation",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1
      },
      { name: "content", type: "text", required: true,  max: 500 },
      { name: "emoji",   type: "text", required: false, max: 10  },
      {
        name: "attachment",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        thumbs: ["800x600"]
      }
    ],
    indexes: [
      "CREATE INDEX idx_news_child ON news (child)"
    ]
  });
  app.save(news);

  // ── 7. parent_notes ───────────────────────────────────────────
  const noteListRule = "created_by = @request.auth.id || child.assistante = @request.auth.id";

  const parentNotes = new Collection({
    name: "parent_notes",
    type: "base",
    listRule: noteListRule,
    viewRule: noteListRule,
    createRule: "@request.auth.role = 'parent'",
    updateRule: [
      "(created_by = @request.auth.id && assistant_acknowledged_at = '')",
      "(@request.auth.role = 'assistante' && child.assistante = @request.auth.id)"
    ].join(" || "),
    deleteRule: "created_by = @request.auth.id && assistant_acknowledged_at = ''",
    fields: [
      {
        name: "child",
        type: "relation",
        required: true,
        collectionId: children.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "created_by",
        type: "relation",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1
      },
      {
        name: "kind",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["absence", "retard", "sante", "logistique", "autre"]
      },
      { name: "content",                   type: "text", required: true,  max: 800 },
      { name: "start_date",                type: "text", required: false, max: 10  },
      { name: "end_date",                  type: "text", required: false, max: 10  },
      { name: "assistant_acknowledged_at", type: "text", required: false, max: 30  },
      {
        name: "assistant_acknowledged_by",
        type: "relation",
        required: false,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1
      },
      { name: "assistant_response",        type: "text", required: false, max: 500 },
      { name: "assistant_responded_at",    type: "text", required: false, max: 30  },
      { name: "parent_seen_response_at",   type: "text", required: false, max: 30  }
    ],
    indexes: [
      "CREATE INDEX idx_parent_notes_child ON parent_notes (child)",
      "CREATE INDEX idx_parent_notes_created_by ON parent_notes (created_by)"
    ]
  });
  app.save(parentNotes);

  // ── 8. invite_codes ───────────────────────────────────────────
  const inviteCodes = new Collection({
    name: "invite_codes",
    type: "base",
    listRule: "created_by = @request.auth.id || child.assistante = @request.auth.id",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.role = 'assistante'",
    updateRule: null,
    deleteRule: "created_by = @request.auth.id",
    fields: [
      { name: "code",       type: "text", required: true, max: 20 },
      {
        name: "child",
        type: "relation",
        required: true,
        collectionId: children.id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "created_by",
        type: "relation",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1
      },
      {
        name: "used_by",
        type: "relation",
        required: false,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1
      },
      { name: "used_at",    type: "text", required: false, max: 30 },
      { name: "expires_at", type: "text", required: true,  max: 30 }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_invite_codes_code ON invite_codes (code)",
      "CREATE INDEX idx_invite_codes_child ON invite_codes (child)"
    ]
  });
  app.save(inviteCodes);

}, (app) => {
  for (const name of ["invite_codes", "parent_notes", "news", "daily_logs", "menus", "parent_children", "children"]) {
    try {
      const c = app.findCollectionByNameOrId(name);
      app.delete(c);
    } catch (_) {}
  }
});
