/**
 * Migration 3 — Correction de la règle update sur invite_codes
 *
 * Permet à un utilisateur authentifié de marquer un code comme utilisé,
 * uniquement si le code n'a pas encore été utilisé (used_by = "").
 * Note : @request.data.* sur les champs relation n'est pas supporté en v0.36.
 * La validation métier (used_by = authId) est assurée dans le domain service.
 */
migrate((app) => {
  const inviteCodes = app.findCollectionByNameOrId("invite_codes");
  inviteCodes.updateRule = 'used_by = "" && @request.auth.id != ""';
  app.save(inviteCodes);
}, (app) => {
  const inviteCodes = app.findCollectionByNameOrId("invite_codes");
  inviteCodes.updateRule = null;
  app.save(inviteCodes);
});
