/**
 * Migration 1 — Champs custom sur la collection users (auth)
 *
 * PocketBase crée automatiquement la collection "users" de type "auth"
 * au premier démarrage. On y ajoute ici nos champs métier.
 *
 * Compatibilité : PocketBase v0.36+
 * Les champs utilisent les constructeurs typés (TextField, SelectField, FileField).
 */
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // Nom affiché (obligatoire)
  users.fields.add(new TextField({
    name: "name",
    required: true,
    min: 1,
    max: 200
  }));

  // Rôle dans l'application
  users.fields.add(new SelectField({
    name: "role",
    required: true,
    maxSelect: 1,
    values: ["assistante", "parent"]
  }));

  // Photo de profil (optionnel)
  users.fields.add(new FileField({
    name: "avatar",
    required: false,
    maxSelect: 1,
    maxSize: 2097152,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    thumbs: ["100x100", "400x400"]
  }));

  // Heure de début de sieste par défaut (ex: "13:00")
  users.fields.add(new TextField({
    name: "default_nap_start",
    required: false,
    max: 5
  }));

  // Heure de fin de sieste par défaut (ex: "15:00")
  users.fields.add(new TextField({
    name: "default_nap_end",
    required: false,
    max: 5
  }));

  return app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");

  for (const name of ["name", "role", "avatar", "default_nap_start", "default_nap_end"]) {
    const field = users.fields.getByName(name);
    if (field) users.fields.remove(field);
  }

  return app.save(users);
});
