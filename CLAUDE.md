# CLAUDE.md — Le Cocon

---

# 1. Philosophie & Contexte

**Le Cocon** est un cahier de liaison numérique 2.0 pensé pour les **assistantes maternelles** et les **parents**. Il remplace le carnet papier par une interface chaleureuse et professionnelle, adaptée aussi bien à une assistante individuelle qu'à une structure accueillant une cinquantaine d'enfants.

Le projet porte une identité visuelle forte baptisée **"Soie & Lumière"** — glassmorphism chaleureux, palette terre/miel, typographie expressive. L'objectif est une application douce et immédiatement reconnaissable, loin de tout rendu "app générique".

**Valeurs fondamentales :**
- **Confiance** — les données des enfants sont sensibles, la sécurité est non négociable
- **Chaleur** — l'interface doit évoquer le cocon, pas le dashboard froid
- **Simplicité** — une assistante maternelle doit pouvoir saisir un journal en 30 secondes
- **Adaptabilité** — fonctionne de 1 à 50 enfants, sur mobile comme sur desktop

**Priorités techniques :** `sécurité > lisibilité > DX > performance`

> **Aucune sécurité côté client.** Toute protection repose sur l'auth JWT serveur et les server actions SvelteKit.

---

# 2. Architecture en un coup d'oeil

```
┌─────────────────────────────────────────────────────────┐
│  SvelteKit 5 (Runes) + TypeScript                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Routes   │  │  Domain      │  │  Server            │  │
│  │  (app)    │→ │  Services    │→ │  ├ db/ (Drizzle)   │  │
│  │  (auth)   │  │  (métier)    │  │  ├ auth.ts (JWT)   │  │
│  │  api/     │  │              │  │  ├ ai/ (Scaleway)  │  │
│  └──────────┘  └──────────────┘  │  └ helpers.ts      │  │
│                                   └───────────────────┘  │
│  UI: Design System "Soie & Lumière"                      │
│  ├ src/lib/ui/ (Card, Button, Avatar, FadeIn...)         │
│  ├ src/app.css (@theme tokens Tailwind v4)               │
│  └ Fraunces (display) + DM Sans (body)                   │
└─────────────────────────────────────────────────────────┘
         │                              │
    PostgreSQL 16                 Scaleway AI
    (Docker dev /                 (Mistral small
     Managed prod)                via OpenAI SDK)
```

**Flux de données :**
- `hooks.server.ts` → auth JWT → `locals.user` + `locals.db`
- Pages : `+page.server.ts` (load) → domain services → DB
- Mutations : `actions` dans `+page.server.ts` ou `+server.ts`
- IA : `POST /api/agent` → intent detection → domain services

**Deux rôles :** `assistante` (pro) et `parent` — chaque vue s'adapte au rôle.

---

# 3. Stack technique

## Frontend
- **SvelteKit 5 (Runes) + TypeScript**
- **Tailwind CSS 4.2** (Vite plugin, Rust engine, `@theme {}` tokens)

## Backend
- **PostgreSQL 16** (Docker dev, Scaleway Managed prod)
- **Drizzle ORM 0.45** — schéma dans `src/lib/server/db/schema.ts`
- **JWT + bcryptjs 3** — auth dans `src/lib/server/auth.ts`

## IA
- **Scaleway Generative API** — endpoint compatible OpenAI, appelé via `fetch` natif
- Modèle : `mistral-small-3.2-24b-instruct-2506`
- Client : `src/lib/server/ai/ollama.ts` (nom hérité, conservé pour compatibilité imports)

## Dépendances principales
| Package | Version | Rôle |
|---|---|---|
| `@sveltejs/kit` | 2.53 | Framework fullstack |
| `drizzle-orm` | 0.45 | ORM SQL typé |
| `drizzle-kit` | 0.31 | CLI migrations/push |
| `bcryptjs` | 3.x | Hachage mots de passe ($2b$) |
| `jsonwebtoken` | 9.x | JWT auth |
| `zod` | 4.x | Validation formulaires |
| `lucide-svelte` | 0.577 | Icônes |
| `vite` | 7.x | Bundler |
| `svelte` | 5.53 | UI framework |
| `tailwindcss` | 4.2 | CSS utility (Vite plugin, Rust engine) |

---

# 4. Structure du projet

```
src/
 ├ lib/
 │ ├ domain/              logique métier (un fichier par entité)
 │ ├ server/
 │ │ ├ ai/                pipeline IA, actions agent, client Scaleway
 │ │ ├ db/                schéma Drizzle, client PostgreSQL, seed, migrate
 │ │ ├ auth.ts            JWT + bcrypt helpers
 │ │ ├ email.ts           envoi d'emails (Scaleway TEM)
 │ │ ├ helpers.ts         requireRole, requireAuth, parseJsonSafe, createRateLimiter
 │ │ ├ validation.ts      Zod schemas + parseFormData
 │ │ └ storage.ts         upload fichiers (à venir)
 │ ├ stores/              stores Svelte (auth, agent panel)
 │ ├ types/               types TS applicatifs
 │ ├ ui/                  design system (composants réutilisables)
 │ └ utils/
 ├ routes/
 │ ├ (auth)/login/        login form + server action
 │ ├ (auth)/onboarding/   inscription + server action
 │ ├ (auth)/verify-email/ vérification email
 │ ├ (app)/               layout protégé + toutes les pages app
 │ ├ api/
 │ │ ├ agent/             POST /api/agent (IA)
 │ │ ├ data-export/       export RGPD des données utilisateur
 │ │ ├ health/            healthcheck endpoint
 │ │ └ logout/            POST /api/logout
 │ └ +error.svelte        page d'erreur globale
infra/                    scripts infra (backup, déploiement)
drizzle/                  migrations Drizzle générées
drizzle.config.ts         config Drizzle Kit
docker-compose.yml
Dockerfile
```

---

# 5. Schéma de base de données

Tables définies dans `src/lib/server/db/schema.ts` :

| Table | Champs clés | Notes |
|---|---|---|
| `users` | email, password_hash, name, role, avatar, default_nap_* | Auth intégrée (bcrypt) |
| `children` | first_name, last_name, birth_date, avatar, assistante_id→users | |
| `parent_children` | parent_id→users, child_id→children | Junction, unique(parent,child) |
| `daily_logs` | child_id, author_id, date, meals(jsonb), nap(jsonb), mood, health(jsonb), changes, notes | Unique(child,date) |
| `news` | child_id, author_id, content, emoji, attachment | |
| `menus` | date, meal_type, description | Unique(date,meal_type) |
| `parent_notes` | child_id, created_by_id, kind, content, start/end_date, assistant_* | |
| `invite_codes` | code(unique), child_id, created_by_id, used_by_id, expires_at | |

Enums : `user_role` (`assistante` | `parent`), `mood_level`, `meal_type`, `parent_note_kind`

---

# 6. Auth flow

```
hooks.server.ts
  → getDb() → singleton pool PostgreSQL
  → cookies.get('auth_token')
  → verifyToken(jwt) → getUserFromToken(token) → DB lookup
  → event.locals.db = db
  → event.locals.user = { id, email, name, role, avatarPath, createdAt }
```

**Login** : `authenticateUser(email, password)` → bcrypt.compare → signToken(JWT) → cookies.set
- Rate limited : 10 tentatives / 15 min par email

**Logout** : `cookies.delete('auth_token')` → redirect

**Inscription** : `createUser({email, password, name, role})` → bcrypt.hash → insert → auto-login

### Sécurité serveur
- `requireRole(user, role)` → asserts user, throws 401/403
- `requireAuth(user)` → asserts user, throws 401
- `parseFormData(zodSchema, formData)` → `{ ok, data } | { ok: false, error }`
- `getAllChildren(db, assistanteId)` → scopé par assistante (jamais tous les enfants)
- `assertChildAccess()` → vérifie propriété enfant (parent ET assistante)

### Variables d'env
```
DATABASE_URL=postgresql://lecocon:lecocon_dev@postgres:5432/lecocon
JWT_SECRET=min-32-chars-secret
AI_PROVIDER=scaleway | off
SCALEWAY_API_KEY=...
```

---

# 7. Domain services

Chaque entité a son fichier dans `src/lib/domain/` :
- Reçoit `db: DrizzleDB` en paramètre (depuis `locals.db`)
- Les dates PostgreSQL sont déjà des `Date` objects — pas besoin de normalisation

```
src/lib/domain/
  children.ts              getAllChildren, getChildrenForUser, getChildById, createChild
  daily_logs.ts            getAllDailyLogs, getDailyLogByDate, createDailyLog, updateDailyLog, batchUpsertDailyLogs
  email-verification.ts    gestion des tokens de vérification email
  invites.ts               createInviteCode, useInviteCode, getAllInviteCodes
  menus.ts                 getMenusForDate, upsertMenu, deleteMenu
  news.ts                  getAllNews, getNewsForChild, createNews, updateNews, deleteNews
  parent_notes.ts          getNotesForParent, acknowledgeNote, respondToNote, getCalendarInsights, countUnacknowledged*
```

---

# 8. Agent IA (Action Agent omniprésent)

Panneau latéral flottant accessible depuis toutes les pages (bouton bas-droite).

```
src/lib/stores/agent.ts          — agentPanelOpen (writable)
src/lib/server/ai/actions.ts     — détection intent + extraction entités + exécution
src/lib/server/ai/ollama.ts      — client Scaleway (fetch natif, endpoint OpenAI-compat)
src/routes/api/agent/+server.ts  — endpoint POST /api/agent
src/lib/ui/AgentButton.svelte    — bouton flottant
src/lib/ui/AgentPanel.svelte     — panneau chat glassmorphism
```

## Règles
- Auth obligatoire (`locals.user`)
- Rate limit : 15 req/min par utilisateur
- IA uniquement côté serveur
- **Ne pas recréer `/app/ai`** — supprimée intentionnellement
- Les enfants sont chargés via `getChildrenForUser(db, user.id, user.role)`

---

# 9. Docker & Dev workflow

Docker sert uniquement à lancer PostgreSQL en dev. L'app SvelteKit tourne en local (Node natif).

```bash
docker compose up -d            # démarrer PostgreSQL
docker compose down             # arrêter
docker compose down -v          # reset DB complet
docker compose logs -f postgres # logs PostgreSQL
```

```bash
npm run dev                     # lancer SvelteKit (port 5173)
```

Les commandes Drizzle (`db:push`, `db:seed`, etc.) sont listées dans la section suivante.

**Prod** : déployé sur Scaleway Serverless + Managed Database (pas de Docker en prod).

---

# 10. Drizzle ORM

```bash
npm run db:push       # appliquer le schéma en dev (sans migration)
npm run db:generate   # générer une migration SQL
npm run db:studio     # interface web Drizzle Studio
npm run db:seed       # données de test (assistante@lecocon.fr / password)
```

Schéma dans `src/lib/server/db/schema.ts` — source de vérité unique.

---

# 11. Direction artistique — "Soie & Lumière"

## Palette de couleurs

Toutes les couleurs sont définies dans `src/app.css` via `@theme {}` (Tailwind v4).

| Token | Hex (500) | Usage |
|---|---|---|
| `miel-*` | `#E8913A` | Primaire — CTAs, accents, badges, focus rings |
| `sienne-*` | `#C2653A` | Secondaire — liens, hover, icônes chaudes |
| `warm-*` | `#B89E86` | Neutres chauds — texte, bordures, fonds légers |
| `mousse-*` | `#5FA05B` | Succès, validation, humeur joyeuse (vert frais, hue ~125°) |
| `soleil-*` | `#E5B03A` | Avertissements, humeur grognon |
| `argile-*` | `#C2635A` | Erreurs, danger, suppression |
| `bleu-*` | `#6A96AB` | Info, calme, sieste |
| `sable-*` | `#C49464` | Neutre sémantique |

Neutres spéciaux : `soie` (#FFF8F0), `voile` (rgba 255,248,240,0.65), `nuit` (#1A1612).

> **Règle absolue** : jamais de `bg-white`, `bg-gray-*`, ni de couleurs froides non-thème (emerald, sky, amber Tailwind). Tout doit utiliser les tokens ci-dessus.

## Surfaces : système Glass à 2 niveaux

```
glass-1  →  Cartes principales, panneaux (blur 20px, saturate 150%)
             background: rgba(255, 248, 240, 0.65)
             border: 1px solid rgba(255, 255, 255, 0.3)
             shadow: 0 8px 32px rgba(194, 101, 58, 0.08)

glass-2  →  Éléments imbriqués dans glass-1 (blur 8px)
             background: rgba(255, 248, 238, 0.45)
             border: 1px solid rgba(255, 240, 220, 0.35)
             shadow: 0 2px 8px rgba(194, 101, 58, 0.04)
```

Le composant `Card` (dans `src/lib/ui/Card.svelte`) applique automatiquement `glass-1 rounded-3xl`.

## Modals & Popups

Style unifié pour tous les modals (`ConfirmDialog`, event detail, etc.) :
- Glass : `rgba(255, 248, 240, 0.88)`, `blur(24px) saturate(150%)`, `rounded-[1.75rem]`
- Ombres : double warm-tinted (`0 20px 60px` + `0 4px 16px`)
- Backdrop : `rgba(26, 22, 18, 0.25)` + `blur(6px)`
- Animation entrée : `scale(0.92) translateY(12px)` → overshoot `scale(1.02)` → `scale(1)` en 0.4s
- Animation sortie : `scale(1)` → `scale(0.95) translateY(8px)` + fade-out en 0.25s

## Background

- `bg-aube` — gradient mesh 4 couches (radial miel + sienne + sable + linear warm), utilisé sur toutes les pages app
- `bg-aube-intense` — variante saturée pour landing/CTA
- Orbes décoratives flottantes (`.orb`) dans le layout app — blur 80px, animation `orbFloat`

## Typographie

- **Display** : `Fraunces` (variable, axes WONK + SOFT) — titres, h1-h3, `.font-display`
- **Body** : `DM Sans` — tout le reste
- Chargées via Google Fonts dans `app.html`

## Coins & ombres

- `rounded-3xl` (2rem) pour les cartes
- `rounded-xl` (1.25rem) pour inputs, badges, éléments internes
- `rounded-2xl` (1.75rem) pour avatars
- Ombres toujours warm-tinted : `rgba(194, 101, 58, ...)` — jamais de gris

## Animations

- Easing signature : `cubic-bezier(0.34, 1.56, 0.64, 1)` (bounce élastique)
- Easing silk : `cubic-bezier(0.22, 1, 0.36, 1)` (décélération douce, transitions de hauteur)
- `FadeIn` component (`src/lib/ui/FadeIn.svelte`) — fly-up avec delay stagger
- `animate-stagger` — animation séquentielle de listes (30ms par item)
- `animate-breathe` — pulsation douce pour les orbes météo
- `glass-hover` — translateY(-2px) + scale(1.02) au hover
- Toutes les animations respectent `prefers-reduced-motion`
- Boutons : `focus-visible:ring` (jamais `focus:ring` — pas de contour au clic souris)

## Layouts

### Sidebar (layout app)
- Glass fixe `rounded-[28px]` avec `backdrop-filter: blur(28px)`
- Collapsible desktop (72px / 256px), tiroir mobile
- Nav items actifs : `box-shadow: inset` (jamais `border`, cause flash avec `transition-all`)
- Utiliser `transition-colors` (pas `transition-all`) + `outline-none` sur tous les éléments interactifs

### Bento Grid (fiche enfant `children/[id]`)
- CSS Grid avec `grid-template-areas` nommées (pas `grid-auto-rows` fixe — cause des débordements)
- Mobile : flex column ; Tablette (md) : 2 colonnes ; Desktop (lg) : 4 colonnes
- Widgets : hero (full width), 4 stats, journal (span 2 cols × 2 rows), news, présence, tendances, codes, tip
- Le layout parent (sans codes/tip) utilise la classe `.bento-parent` avec un template adapté
- Chaque `FadeIn` dans le bento doit recevoir `class="h-full"` pour propager la hauteur

### Dashboard overview (vue d'ensemble)
- Concept "Le Tableau du Jour" — barre de progression + indicateurs texte + cartes enfants
- **Desktop (lg+)** : layout fixe viewport (`height: calc(100dvh - 4rem)` + `overflow: clip`), sidebar (news + raccourcis) à droite du bloc enfants/calendrier
- **Mobile** : flow naturel, scroll autorisé, cartes enfants compactes (3 colonnes, layout vertical centré)
- Transition onglets enfants/calendrier : FLIP height animation sur mobile (tabs `position: absolute`, hauteur pilotée par JS + `transition: height 0.6s silk`), grid overlay sur desktop
- `ResizeObserver` sur le tab actif pour animer la hauteur lors de changements de contenu (event panel calendrier)
- Cartes enfant avec mood ring, `ring-pulse` animation pour les journaux manquants
- Layout adapté au rôle (assistante vs parent)

### Calendrier mobile
- Grille compacte sans `min-height` fixe, jours en une lettre, numéros `w-7 h-7`
- Events en pastilles colorées (sienne/miel) — tap pour détail
- Panneau slide-down avec nom enfant + contenu event
- Résumé du mois quand aucun jour sélectionné
- Desktop : cellules flexibles `grid-auto-rows: 1fr`, labels texte complets

## Composants UI (`src/lib/ui/`)

| Composant | Rôle |
|---|---|
| `Card` | Wrapper glass-1 + rounded-3xl + padding |
| `Button` | Variants primary/secondary/ghost/danger, elastic press, focus-visible ring |
| `Avatar` | Initiales ou image, tailles sm/md/lg/xl/2xl |
| `Badge` | Statut avec dot coloré |
| `Callout` | Alertes success/warning/info |
| `ConfirmDialog` | Modal de confirmation avec animation entrée/sortie |
| `CalendarMonth` | Calendrier mensuel responsive (compact mobile / détaillé desktop) |
| `FadeIn` | Animation d'apparition (fade ou fly) avec stagger |
| `PageHeader` | Titre + actions slot |
| `PlateVisual` | Visualisation repas (4 niveaux) |
| `AgentButton` | Bouton flottant IA (bas-droite) |
| `AgentPanel` | Panneau chat IA glassmorphism |

---

# 12. Conventions de code

- Prettier, indentation **2 espaces**
- Noms explicites, composants Svelte en **PascalCase**
- **UI en français** (labels, messages utilisateur)
- **Commentaires en anglais** — brefs, uniquement pour logique complexe ou guidance admin
- Icônes : `lucide-svelte` uniquement
- Pas d'emojis dans l'interface
- Pas d'`any`
- `catch { return [] }` ou `catch { return null }` dans les domain services
- Utiliser la syntaxe Tailwind v4 canonique (`bg-linear-to-r` pas `bg-gradient-to-r`, `min-w-15` pas `min-w-[60px]`)
- **Pas de nouvelle dépendance sans justification forte.** Avant d'ajouter un package npm, vérifier : (1) est-ce que `fetch`, une API native Node/Web, ou du code maison en <50 lignes peut faire le travail ? (2) est-ce que le package est activement maintenu et léger ? (3) est-ce qu'il n'existe pas déjà une dépendance dans le projet qui couvre le besoin ? En cas de doute, préférer zéro dépendance.

---

# 13. Workflow pour chaque feature

1. Identifier les tables PostgreSQL concernées
2. Modifier le schéma Drizzle si nécessaire
3. Appliquer avec `npm run db:push`
4. Implémenter/mettre à jour le domain service
5. Implémenter le `+page.server.ts` (load + actions)
6. Implémenter l'UI Svelte
7. Gérer les 3 états : `loading`, `empty`, `error`

---

# 14. Les 5 règles d'or pour les tâches complexes

Quand une tâche est non triviale (multi-fichiers, nouvelle feature, refactoring important), ces 5 règles s'appliquent **systématiquement** :

### Règle 1 — Planifier avant de coder
Ne jamais se lancer tête baissée. Poser d'abord un plan structuré (fichiers impactés, ordre des étapes, risques) et le valider avec l'utilisateur **avant** d'écrire la moindre ligne de code. Utiliser le mode Plan pour les tâches architecturales.

### Règle 2 — Orchestrer via sous-agents
Passer en mode orchestrateur : déléguer les recherches, explorations et tâches parallèles aux sous-agents spécialisés. Cela garde le contexte principal propre et évite la saturation. Ne jamais dupliquer le travail qu'un sous-agent fait déjà.

### Règle 3 — Auto-amélioration continue
Chaque erreur rencontrée est loguée en mémoire (`feedback`) avec le contexte et la solution. L'objectif : ne jamais refaire la même erreur d'une session à l'autre. Les succès non évidents sont aussi enregistrés pour capitaliser sur ce qui fonctionne.

### Règle 4 — Tester après chaque ajout
Après chaque modification significative, exécuter les tests pertinents (`npm run check`, build, tests unitaires) pour valider que rien n'est cassé. Ne pas attendre la fin pour tester — chaque étape doit être vérifiée individuellement.

### Règle 5 — Loguer, comprendre, corriger les bugs
Si un test échoue : (1) loguer l'erreur exacte, (2) analyser la cause racine (pas de fix à l'aveugle), (3) corriger proprement, (4) re-tester pour confirmer la résolution. Ne jamais ignorer ou contourner un échec de test.

---

# 15. Git workflow

## Branches
- **`main`** — production, toujours stable. Merge uniquement depuis `dev`.
- **`dev`** — développement courant. Toutes les features et fixes atterrissent ici.
- **`feat/*`** ou **`fix/*`** — branches optionnelles depuis `dev` pour les gros morceaux.

## Workflow quotidien
```bash
git checkout dev              # travailler sur dev
# ... coder ...
git add <files>
git commit -m "feat: ..."
git push origin dev

# Quand dev est stable → merge dans main
git checkout main
git merge dev
git push origin main
```

## Commits

**Toujours utiliser les conventional commits.** Chaque commit doit être atomique, ciblé et descriptif.

```
feat:      nouvelle fonctionnalité
fix:       correction de bug
perf:      amélioration de performance
refactor:  refactoring sans changement de comportement
style:     changements visuels / DA / CSS
chore:     maintenance (deps, config)
docs:      documentation
```

**Règles :**
- Un commit = un changement logique (pas de commits fourre-tout)
- Le message décrit le **pourquoi**, pas le quoi (`fix: prevent scroll on overview` pas `fix: add overflow hidden`)
- Scope entre parenthèses quand pertinent : `feat(calendar): add mobile tap-to-reveal`
- Toujours stager les fichiers individuellement (`git add <files>`) — jamais `git add .` ou `git add -A`
- Ne jamais committer de secrets, `.env`, ou fichiers générés

## Versioning
- Version dans `package.json` — actuellement **0.7.0**
- Incrémenter à chaque merge significatif dans `main`

---

# 16. Prochaines étapes

## À compléter manuellement

| Fichier | Quoi | Pourquoi |
|---|---|---|
| `legal/mentions/+page.svelte` | Nom de la collectivité, adresse, directeur de publication | Infos mairie — placeholders `[À compléter]` en place |
| `legal/confidentialite/+page.svelte` | Remplacer `contact@lecocon.app` par l'email réel | Dépend du domaine final |
| `legal/cgu/+page.svelte` | Idem email + faire relire par un juriste | Textes RGPD sur données de mineurs |

## À faire quand la mairie débloque les fonds

1. `npm run db:migrate` sur la DB Scaleway (au lieu de `db:push`)
2. Configurer Scaleway TEM pour les emails
3. Créer le bucket S3 + activer le backup cron (`infra/backup/`)
4. Configurer GitHub Actions CI/CD
5. Faire tester le flow RGPD (export + suppression) en staging