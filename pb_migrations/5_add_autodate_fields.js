/**
 * Migration 4 — Ajout des champs autodate manquants
 *
 * En PocketBase v0.36, les champs `created` et `updated` ne sont PAS
 * automatiquement ajoutés au schéma lors de la création via JS migration.
 * Sans eux : tri impossible, `record.created` = undefined → "Invalid Date".
 *
 * Cette migration les ajoute à toutes les collections applicatives.
 */
migrate((app) => {
  const COLLECTIONS = [
    "children",
    "parent_children",
    "menus",
    "daily_logs",
    "news",
    "parent_notes",
    "invite_codes",
  ];

  for (const name of COLLECTIONS) {
    const col = app.findCollectionByNameOrId(name);

    if (!col.fields.getByName("created")) {
      col.fields.add(new AutodateField({
        name: "created",
        onCreate: true,
        onUpdate: false,
      }));
    }

    if (!col.fields.getByName("updated")) {
      col.fields.add(new AutodateField({
        name: "updated",
        onCreate: true,
        onUpdate: true,
      }));
    }

    app.save(col);
  }
}, (app) => {
  const COLLECTIONS = [
    "children", "parent_children", "menus", "daily_logs",
    "news", "parent_notes", "invite_codes",
  ];
  for (const name of COLLECTIONS) {
    try {
      const col = app.findCollectionByNameOrId(name);
      const createdF = col.fields.getByName("created");
      if (createdF) col.fields.remove(createdF);
      const updatedF = col.fields.getByName("updated");
      if (updatedF) col.fields.remove(updatedF);
      app.save(col);
    } catch (_) {}
  }
});
