# Modèle de données - Le Cocon

## Vue d'ensemble

Ce document décrit le modèle de données de l'application Le Cocon.

## Tables implémentées (v1)

### `profiles`

Extension de la table `auth.users` de Supabase.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | FK vers `auth.users.id` (PK) |
| `email` | `text` | Email de l'utilisateur |
| `name` | `text` | Nom complet |
| `role` | `enum('assistante', 'parent')` | Rôle de l'utilisateur |
| `avatar_path` | `text` | Chemin Storage de l'avatar (optionnel) |
| `created_at` | `timestamptz` | Date de création |
| `updated_at` | `timestamptz` | Date de mise à jour |

### `children`

Informations sur les enfants.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | PK |
| `first_name` | `text` | Prénom |
| `last_name` | `text` | Nom de famille |
| `birth_date` | `date` | Date de naissance |
| `avatar_path` | `text` | Chemin Storage de l'avatar (optionnel) |
| `assistante_id` | `uuid` | FK vers `profiles.id` |
| `created_at` | `timestamptz` | Date de création |
| `updated_at` | `timestamptz` | Date de mise à jour |

### `parent_children`

Table de liaison entre parents et enfants (relation N-N).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | PK |
| `parent_id` | `uuid` | FK vers `profiles.id` |
| `child_id` | `uuid` | FK vers `children.id` |
| `created_at` | `timestamptz` | Date de création |

**Contrainte unique** : `(parent_id, child_id)`

---

### `news`

Fil d'actualites en temps reel.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | PK |
| `child_id` | `uuid` | FK vers `children.id` |
| `author_id` | `uuid` | FK vers `profiles.id` |
| `content` | `text` | Contenu du message (1-500 car.) |
| `emoji` | `text` | Emoji associe (optionnel) |
| `attachment_path` | `text` | Chemin Storage de la piece jointe (optionnel) |
| `created_at` | `timestamptz` | Date de creation |
| `updated_at` | `timestamptz` | Date de mise a jour |

### `daily_logs`

Journal quotidien structure.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | PK |
| `child_id` | `uuid` | FK vers `children.id` |
| `author_id` | `uuid` | FK vers `profiles.id` |
| `date` | `date` | Date du journal |
| `meals` | `jsonb` | Tableau des repas |
| `nap` | `jsonb` | Informations sieste (nullable) |
| `mood` | `enum` | Humeur generale |
| `health` | `jsonb` | Notes de sante (nullable) |
| `changes` | `integer` | Nombre de changes |
| `notes` | `text` | Notes libres |
| `created_at` | `timestamptz` | Date de creation |
| `updated_at` | `timestamptz` | Date de mise a jour |

**Contrainte unique** : `(child_id, date)` - un seul journal par enfant par jour

### `invite_codes`

Codes d'invitation pour lier parents aux enfants.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | PK |
| `code` | `text` | Code a 6 caracteres |
| `child_id` | `uuid` | FK vers `children.id` |
| `created_by` | `uuid` | FK vers `profiles.id` (assistante) |
| `used_by` | `uuid` | FK vers `profiles.id` (parent, nullable) |
| `used_at` | `timestamptz` | Date d'utilisation |
| `expires_at` | `timestamptz` | Date d'expiration (7 jours) |
| `created_at` | `timestamptz` | Date de creation |

### `parent_notes`

Notes des parents vers l'assistante (systeme "anti-chat").

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | `uuid` | PK |
| `child_id` | `uuid` | FK vers `children.id` |
| `created_by` | `uuid` | FK vers `profiles.id` (parent) |
| `kind` | `enum` | Type: absence, retard, sante, logistique, autre |
| `content` | `text` | Contenu de la note (1-800 car.) |
| `start_date` | `date` | Debut de periode (optionnel) |
| `end_date` | `date` | Fin de periode (optionnel) |
| `assistant_acknowledged_at` | `timestamptz` | Date d'acquittement |
| `assistant_acknowledged_by` | `uuid` | FK vers `profiles.id` |
| `assistant_response` | `text` | Reponse unique (max 500 car.) |
| `assistant_responded_at` | `timestamptz` | Date de reponse |
| `parent_seen_response_at` | `timestamptz` | Date de lecture de la reponse par le parent |
| `created_at` | `timestamptz` | Date de creation |
| `updated_at` | `timestamptz` | Date de mise a jour |

**Contraintes** :
- `end_date` requiert `start_date`
- `end_date >= start_date`

**Indexes** :
- `(child_id, created_at DESC)` - tri par enfant
- `(created_by, created_at DESC)` - notes du parent
- `(assistant_acknowledged_at NULLS FIRST, created_at DESC)` - inbox assistante
- `(kind, start_date)` WHERE `start_date IS NOT NULL` - futur calendrier
- `(created_by, parent_seen_response_at NULLS FIRST)` WHERE `assistant_responded_at IS NOT NULL` - reponses non lues

---

## Tables prevues (futures versions)

### `ai_queries`

Historique des requetes IA.

---

## Strategie RLS (Row Level Security)

### Principes de sécurité

1. **Aucune donnée accessible sans authentification**
2. **Les parents ne voient que leurs enfants liés via `parent_children`**
3. **L'assistante voit tous les enfants où elle est `assistante_id`**
4. **Les modifications sont restreintes aux propriétaires légitimes**

### Fonctions helper (définies en SQL)

```sql
-- Retourne le rôle de l'utilisateur courant
public.get_user_role() -> user_role

-- Vérifie si l'utilisateur est une assistante
public.is_assistante() -> boolean

-- Vérifie si un parent a accès à un enfant donné
public.parent_has_child_access(child_uuid) -> boolean
```

**Note importante (Sécurité v0.5.1)** : Toutes ces fonctions utilisent `SET search_path = ''` pour éviter les attaques par manipulation du search_path.

### Policies implémentées

#### `profiles`

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `profiles_select_own` | SELECT | `id = (select auth.uid())` |
| `profiles_update_own` | UPDATE | `id = (select auth.uid())` |

**Note** : INSERT est géré par le trigger `on_auth_user_created`.

#### `children`

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `children_select` | SELECT | `assistante_id = (select auth.uid()) OR parent_has_child_access(id)` |
| `children_insert_assistante` | INSERT | `is_assistante() AND assistante_id = (select auth.uid())` |
| `children_update_assistante` | UPDATE | `assistante_id = (select auth.uid())` |
| `children_delete_assistante` | DELETE | `is_assistante() AND assistante_id = (select auth.uid())` |

**Optimisation v0.5.1** : Les policies SELECT sont consolidées pour éviter `multiple_permissive_policies`.

#### `parent_children`

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `parent_children_select` | SELECT | `parent_id = (select auth.uid()) OR enfant appartient à l'assistante` |
| `parent_children_insert_assistante` | INSERT | Enfant appartient à l'assistante |
| `parent_children_delete_assistante` | DELETE | Enfant appartient à l'assistante |

**Sécurité** : Seule l'assistante peut créer/supprimer les liaisons parent-enfant.

#### `invite_codes`

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `invite_codes_select` | SELECT | Assistante pour ses enfants OU codes valides non utilisés |
| `invite_codes_insert_assistante` | INSERT | `is_assistante()` + enfant appartient à l'assistante |
| `invite_codes_delete_assistante` | DELETE | `created_by = (select auth.uid())` |
| `invite_codes_update_parent` | UPDATE | Code valide non utilisé + utilisateur est parent |

#### `news`

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `news_select` | SELECT | `enfant appartient à l'assistante OR parent_has_child_access(child_id)` |
| `news_insert_assistante` | INSERT | `is_assistante() AND author_id = (select auth.uid())` |
| `news_update_assistante` | UPDATE | `author_id = (select auth.uid())` |
| `news_delete_assistante` | DELETE | `is_assistante() AND author_id = (select auth.uid())` |

#### `daily_logs`

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `daily_logs_select` | SELECT | `enfant appartient à l'assistante OR parent_has_child_access(child_id)` |
| `daily_logs_insert_assistante` | INSERT | `is_assistante() AND author_id = (select auth.uid())` |
| `daily_logs_update_assistante` | UPDATE | `author_id = (select auth.uid())` |
| `daily_logs_delete_assistante` | DELETE | `is_assistante() AND author_id = (select auth.uid())` |

#### `parent_notes`

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `parent_notes_select` | SELECT | `(created_by = uid AND parent_has_child_access) OR enfant appartient à l'assistante` |
| `parent_notes_insert_parent` | INSERT | Parent auteur + accès enfant + champs assistante NULL |
| `parent_notes_update` | UPDATE | `(parent auteur AND NOT assistante) OR (assistante pour ses enfants)` |
| `parent_notes_delete_parent` | DELETE | `created_by = (select auth.uid())` et note non acquittée |

**Pourquoi ces policies sont suffisantes :**
- Un parent ne peut créer/voir/modifier que ses propres notes
- L'assistante ne peut voir que les notes des enfants qu'elle garde
- Seule l'assistante peut acquitter et répondre aux notes
- Le parent peut uniquement marquer une réponse comme vue (`parent_seen_response_at`)
- Les modifications de contenu après acquittement sont interdites pour le parent (via trigger)

**Trigger de protection des champs :**
Le trigger `protect_parent_note_fields()` assure que :
- `created_by` et `child_id` sont immutables
- L'assistante ne peut modifier que les champs `assistant_*`
- Le parent ne peut modifier que le contenu (si non acquitte) et `parent_seen_response_at`

---

## Triggers

### `on_auth_user_created`

Se déclenche après la création d'un utilisateur dans `auth.users`.
Crée automatiquement un profil dans `profiles` avec :
- Le nom depuis `raw_user_meta_data.name` (ou dérivé de l'email)
- Le rôle depuis `raw_user_meta_data.role` (défaut: `parent`)

### `trigger_profiles_updated_at` / `trigger_children_updated_at`

Met à jour automatiquement `updated_at` lors de toute modification.

---

## Diagramme relationnel

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│  profiles   │       │ parent_children │       │  children   │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ parent_id (FK)  │       │ id (PK)     │
│ email       │       │ child_id (FK)   │──────►│ first_name  │
│ name        │       └─────────────────┘       │ last_name   │
│ role        │                                 │ birth_date  │
└─────────────┘                                 │ assistante_id│──┐
      │                                         └─────────────┘  │
      │                                               │          │
      │                                               ▼          │
      │         ┌─────────────┐              ┌─────────────┐     │
      │         │    news     │              │ daily_logs  │     │
      │         ├─────────────┤              ├─────────────┤     │
      └────────►│ author_id   │              │ author_id   │◄────┘
                │ child_id    │◄─────────────│ child_id    │
                │ content     │              │ date        │
                │ emoji       │              │ meals       │
                └─────────────┘              │ ...         │
                                             └─────────────┘
                                                    │
                                                    ▼
      ┌───────────────┐              ┌──────────────────┐
      │ invite_codes  │              │  parent_notes    │
      ├───────────────┤              ├──────────────────┤
      │ code          │              │ child_id (FK)    │
      │ child_id (FK) │              │ created_by (FK)  │──► profiles
      │ created_by    │──► profiles  │ kind             │
      │ used_by       │──► profiles  │ content          │
      │ expires_at    │              │ start_date       │
      └───────────────┘              │ end_date         │
                                     │ assistant_ack_at │
                                     │ assistant_resp   │
                                     └──────────────────┘
```

## Types JSONB (pour v2)

### Meal Entry
```json
{
  "type": "petit-dejeuner" | "dejeuner" | "gouter" | "diner",
  "description": "string",
  "quantity": "peu" | "moyen" | "bien" | "tres-bien"
}
```

### Nap Entry
```json
{
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "quality": "agitee" | "normale" | "paisible"
}
```

### Health Entry
```json
{
  "temperature": 37.5,
  "symptoms": "string",
  "medication": "string",
  "notes": "string"
}
```

---

## Fichiers de migration

Les migrations sont dans `supabase/migrations/` :

1. `20250112000001_initial_schema.sql` - Tables profiles, children, parent_children + RLS
2. `20250112000002_auth_trigger.sql` - Trigger de creation de profil
3. `20250113000001_invite_codes.sql` - Codes d'invitation + fonctions RPC
4. `20250113000002_news_and_daily_logs.sql` - News et journaux quotidiens
5. `20250114000001_parent_notes.sql` - Notes parentales (anti-chat)
6. `20250114000002_fix_parent_notes_policies.sql` - Fix RLS + trigger protection champs
7. `20250115000001_realtime_and_notifications.sql` - Realtime + notifications visuelles
8. `20250116000001_security_performance_fixes.sql` - Fix search_path + auth_rls_initplan + consolidation policies
9. `20250117000001_storage_setup.sql` - Buckets Storage + avatar_path + attachment_path

Pour appliquer les migrations :
```bash
supabase db push
```

Pour generer les types TypeScript :
```bash
supabase gen types typescript --local > src/lib/supabase/types.generated.ts
```

---

## Realtime

Supabase Realtime est active sur les tables suivantes :

### `news`
- **Events** : INSERT, UPDATE, DELETE
- **Utilisation** :
  - INSERT : Rafraichissement automatique du fil d'actualites
  - UPDATE : Mise a jour d'une news editee
  - DELETE : Suppression d'une news
- **Securite** : RLS appliquee automatiquement

### `parent_notes`
- **Events** : INSERT, UPDATE
- **Utilisation** :
  - Inbox assistante : nouvelle note en temps reel
  - Notes parent : reponse de l'assistante en temps reel
- **Securite** : RLS appliquee automatiquement

---

## Storage (v0.8.0)

Supabase Storage est utilise pour les fichiers (avatars et pieces jointes).

### Buckets

| Bucket | Visibilite | Limite taille | Types MIME autorises |
|--------|------------|---------------|----------------------|
| `avatars` | Public | 2 MB | image/jpeg, image/png, image/webp, image/gif |
| `news` | Prive | 5 MB | image/jpeg, image/png, image/webp, image/gif |

### Structure des chemins

| Type | Chemin | Exemple |
|------|--------|---------|
| Avatar profil | `profiles/{user_id}/avatar.{ext}` | `profiles/abc-123/avatar.jpg` |
| Avatar enfant | `children/{child_id}/avatar.{ext}` | `children/def-456/avatar.png` |
| Piece jointe news | `{child_id}/{news_id}.{ext}` | `ghi-789/jkl-012.webp` |

### Policies Storage

#### Bucket `avatars` (public)

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `avatar_select` | SELECT | Tout le monde (bucket public) |
| `avatar_insert_own_profile` | INSERT | `auth.uid() = (bucket path user_id)` |
| `avatar_update_own_profile` | UPDATE | `auth.uid() = (bucket path user_id)` |
| `avatar_delete_own_profile` | DELETE | `auth.uid() = (bucket path user_id)` |
| `avatar_insert_child` | INSERT | `is_assistante() AND child appartient a l'assistante` |
| `avatar_update_child` | UPDATE | `child appartient a l'assistante` |
| `avatar_delete_child` | DELETE | `child appartient a l'assistante` |

#### Bucket `news` (prive)

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `news_attachment_select` | SELECT | `is_assistante() OR parent_has_child_access(child_id du path)` |
| `news_attachment_insert` | INSERT | `is_assistante() AND child appartient a l'assistante` |
| `news_attachment_update` | UPDATE | `is_assistante() AND child appartient a l'assistante` |
| `news_attachment_delete` | DELETE | `is_assistante() AND child appartient a l'assistante` |

### Acces aux fichiers

| Bucket | Methode d'acces |
|--------|-----------------|
| `avatars` | URL publique via `getPublicUrl()` |
| `news` | URL signee temporaire via `createSignedUrl()` (1h par defaut) |

### Helpers TypeScript

Module `src/lib/server/storage.ts` :

```typescript
uploadProfileAvatar(supabase, userId, file): Promise<UploadResult>
uploadChildAvatar(supabase, childId, file): Promise<UploadResult>
uploadNewsAttachment(supabase, childId, newsId, file): Promise<UploadResult>
getAvatarPublicUrl(supabase, path): string
getNewsAttachmentSignedUrl(supabase, path, expiresIn?): Promise<string | null>
deleteFile(supabase, bucket, path): Promise<boolean>
```

---

## Notifications visuelles

### Badges de la sidebar

| Role | Badge | Condition |
|------|-------|-----------|
| Assistante | Boite de reception | `COUNT(parent_notes) WHERE assistant_acknowledged_at IS NULL` |
| Parent | Notes a l'assmat | `COUNT(parent_notes) WHERE assistant_responded_at IS NOT NULL AND parent_seen_response_at IS NULL` |

Les badges sont calcules cote serveur dans `(app)/+layout.server.ts` et affiches dans la sidebar.

### Callouts de page

| Page | Condition | Message |
|------|-----------|---------|
| `/app/inbox` | Notes non acquittees | "Vous avez X note(s) a traiter" |
| `/app/notes` | Reponses non vues | "Vous avez X nouvelle(s) reponse(s)" |

### Badges de carte (notes)

| Contexte | Badge | Style |
|----------|-------|-------|
| Inbox assistante | "Nouveau" | Note non acquittee |
| Notes parent | "Reponse recue" | Reponse non vue |

---

## Calendrier des absences (v0.6.0)

### Donnees source

Le calendrier utilise la table `parent_notes` avec les colonnes:
- `kind` : filtre sur 'absence' et 'retard'
- `start_date` : date de debut (obligatoire pour apparaitre dans le calendrier)
- `end_date` : date de fin (optionnel, si null = 1 seul jour)

### Logique d'overlap

Un evenement apparait sur le calendrier si son intervalle chevauche la plage affichee:

```
note.start_date <= range.to AND COALESCE(note.end_date, note.start_date) >= range.from
```

Cette logique est implementee dans `listCalendarEventsForAssistant()`.

### Insights

Les insights sont calcules cote serveur (`getCalendarInsights()`):

| Metrique | Calcul |
|----------|--------|
| Absences (7j) | `COUNT(kind='absence' AND start_date >= today AND start_date <= today+7)` |
| Absences (30j) | `COUNT(kind='absence' AND start_date >= today AND start_date <= today+30)` |
| Jours absence | `SUM(end_date - start_date + 1)` pour les 30 derniers jours |
| Retards (30j) | `COUNT(kind='retard' AND start_date >= today-30 AND start_date <= today)` |

### Securite

- Page `/app/calendar` accessible uniquement aux assistantes (redirect sinon)
- RLS sur `parent_notes` garantit que l'assistante ne voit que les notes de ses enfants
- Jointure avec `children` pour afficher les noms (protegee par RLS)

---

## Tests manuels recommandes

1. Parent envoie note => apparait dans inbox assistante (realtime)
2. Assistante acquitte => statut change dans notes parent (realtime)
3. Assistante repond => parent voit "Reponse recue" + badge sidebar
4. Parent clique "Marquer comme lu" => badge disparait, `parent_seen_response_at` set
5. Parent ne peut pas marquer vu une note sans reponse (RLS/trigger)
6. Pas de memory leak lors de navigation entre pages (unsubscribe realtime)
7. Calendrier: absence multi-jours s'affiche sur tous les jours concernes
8. Calendrier: filtre par enfant reduit les evenements et insights
9. Calendrier: parent ne peut pas acceder a /app/calendar (redirect)
10. Calendrier: navigation mois precedent/suivant fonctionne

### Edition & suppression (v0.9.0)

11. Assistante: editer une news (texte + emoji) => contenu mis a jour en realtime
12. Assistante: supprimer une news avec image => news + fichier Storage supprimes
13. Assistante: editer un journal existant => modifications sauvegardees
14. Assistante: supprimer un journal => disparait de la liste
15. Parent: ne voit AUCUN bouton editer/supprimer sur news ou journaux
16. Securite: parent tente endpoint deleteNews manuellement => 403
17. Modale confirmation: Echap ferme la modale, clic overlay aussi

---

## Bonnes pratiques de securite

### Configuration Supabase (Dashboard)

#### Leaked Password Protection (RECOMMANDE)

Activer "Leaked Password Protection" dans le dashboard Supabase :

1. Aller dans **Authentication > Providers > Email**
2. Activer **"Enable Leaked Password Protection"**

Cette fonctionnalite verifie les mots de passe contre la base HaveIBeenPwned lors de l'inscription et du changement de mot de passe. Les mots de passe compromis sont rejetes.

**Note** : Cette verification est faite de maniere securisee via k-anonymity (seul un hash partiel est envoye).

### Optimisations RLS (v0.5.1)

#### auth_rls_initplan

Toutes les policies utilisent maintenant `(select auth.uid())` au lieu de `auth.uid()` direct.

**Pourquoi** : PostgreSQL evalue `auth.uid()` pour chaque ligne, tandis que `(select auth.uid())` est evalue une seule fois par requete (InitPlan).

**Impact** : Amelioration significative des performances sur les tables volumineuses.

#### function_search_path_mutable

Toutes les fonctions SECURITY DEFINER utilisent maintenant `SET search_path = ''`.

**Pourquoi** : Sans search_path explicite, un attaquant pourrait creer un schema malveillant et manipuler le search_path pour executer du code dans le contexte SECURITY DEFINER.

**Fonctions securisees** :
- `handle_updated_at()`
- `get_user_role()`
- `is_assistante()`
- `parent_has_child_access()`
- `handle_new_user()`
- `generate_invite_code()`
- `protect_parent_note_fields()`

#### multiple_permissive_policies

Les policies SELECT ont ete consolidees (une policy par table avec OR).

**Pourquoi** : Plusieurs policies permissives pour la meme operation sont evaluees avec OR par PostgreSQL, ce qui est correct mais moins performant qu'une seule policy avec conditions OR explicites.

**Tables optimisees** :
- `children` : 2 SELECT policies -> 1 (`children_select`)
- `parent_children` : 2 SELECT policies -> 1 (`parent_children_select`)
- `invite_codes` : 2 SELECT policies -> 1 (`invite_codes_select`)
- `news` : 2 SELECT policies -> 1 (`news_select`)
- `daily_logs` : 2 SELECT policies -> 1 (`daily_logs_select`)
- `parent_notes` : 2 SELECT policies -> 1 (`parent_notes_select`), 2 UPDATE policies -> 1 (`parent_notes_update`)

---

## Assistant IA (v0.7.0)

### Architecture SQL-first

L'assistant IA utilise une architecture **SQL-first** (pas de RAG vectoriel) :

1. **Intent Detection** : Detection de l'intention via heuristiques FR (mots-cles)
2. **Data Retrieval** : Requetes SQL ciblees via Supabase (protegees par RLS)
3. **LLM Generation** : Synthese des sources en reponse naturelle

### Intents supportes (v1)

| Intent | Description | Sources utilisees |
|--------|-------------|-------------------|
| `meals_recent` | Questions sur les repas | daily_logs (5 derniers) |
| `nap_recent` | Questions sur les siestes | daily_logs (5 derniers) |
| `health_last` | Questions de sante | daily_logs + parent_notes (kind=sante) |
| `absences` | Questions sur les absences | parent_notes (kind=absence/retard, 90j) |
| `recap_week` | Resume de la semaine | daily_logs + news + parent_notes (7j) |
| `news_recent` | Dernieres actualites | news (10 dernieres) |
| `fallback_unknown` | Question non reconnue | mix de toutes sources |

### Scoping des donnees

**Securite stricte** :
- L'utilisateur **doit** choisir un enfant specifique (pas de recherche globale)
- Le `childId` est verifie cote serveur via RLS avant toute requete
- Si l'utilisateur n'a pas acces a l'enfant -> 403 Forbidden
- Les sources sont toujours filtrees par `child_id`

### Provider LLM

**Developpement** : Ollama (LLM local)
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=ministral-3:8b
AI_PROVIDER=ollama
```

**Production** : Prevu extensible vers OpenAI/Anthropic (non implemente v1)

Pour desactiver l'IA : `AI_PROVIDER=off`

### Pipeline d'execution

```
[Question utilisateur]
       │
       ▼
[1. Auth Guard] ─── Non authentifie? ──► 401
       │
       ▼
[2. Verify Child Access] ─── Pas d'acces? ──► 403
       │
       ▼
[3. Intent Detection] (heuristiques FR)
       │
       ▼
[4. Data Retrieval] (SQL via Supabase + RLS)
       │
       ▼
[5. Prompt Building] (sources formatees + question)
       │
       ▼
[6. LLM Generation] (Ollama /api/chat)
       │
       ▼
[7. Response Parsing] (JSON -> answer + sources)
       │
       ▼
[Reponse structuree]
```

### Endpoint

`POST /app/ai`

**Input** :
```json
{
  "childId": "uuid",
  "question": "string (1-300 chars)",
  "timeframeDays": 90
}
```

**Output (succes)** :
```json
{
  "success": true,
  "answer": "Reponse de l'IA...",
  "highlights": ["point cle 1", "point cle 2"],
  "sources": [
    { "type": "daily_log", "id": "uuid", "date": "2025-01-15", "label": "Journal quotidien" }
  ],
  "_debug": { "intent": "meals_recent" }
}
```

**Output (erreur)** :
```json
{
  "success": false,
  "error": "Message d'erreur"
}
```

### Rate Limiting

Simple rate limiter en memoire :
- **10 requetes par minute** par utilisateur
- Reset automatique apres 60 secondes

### Tests manuels recommandes

1. Parent avec 0 enfant : page IA affiche empty state
2. Parent lie a 1 enfant : question repas -> reponse + sources daily_logs
3. Question "dernier malade" sans health data -> "pas d'info"
4. Assistante : question news recent -> sources news
5. Securite : parent tente childId non autorise -> 403
6. IA off/unreachable -> Callout + message d'erreur propre
7. Rate limit : 11 requetes en 1 minute -> 429

### Structure du code

```
src/lib/server/ai/
├── types.ts      # Types TypeScript (AIIntent, AIResponse, etc.)
├── intent.ts     # Detection d'intent (heuristiques FR)
├── retrieval.ts  # Recuperation des sources (SQL via Supabase)
├── ollama.ts     # Client Ollama (LLM local)
├── prompt.ts     # Construction des prompts + parsing reponse
├── pipeline.ts   # Orchestration du pipeline complet
└── index.ts      # Barrel exports
```

### Contraintes de securite

1. **IA uniquement cote serveur** : Pas d'appel direct a Ollama depuis le navigateur
2. **Scoping strict** : Toujours filtrer par `child_id` accessible via RLS
3. **Pas de conseils medicaux** : L'IA refuse et redirige vers un professionnel
4. **Donnees minimales** : Max ~15 sources envoyees au LLM
5. **Pas de logging sensible** : Ne pas logger le contenu des questions/reponses en clair
