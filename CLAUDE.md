# CLAUDE.md — Le Cocon

## Contexte

**Le Cocon** est un cahier de liaison numérique pour **assistantes maternelles** et **parents**. Il remplace le carnet papier par une interface chaleureuse, adaptée de 1 à 50 enfants, sur mobile comme desktop.

**Deux rôles** : `assistante` (pro, gère les enfants) et `parent` (consulte, communique). Chaque vue s'adapte au rôle.

**Priorités** : `sécurité > lisibilité > DX > performance`

> Aucune sécurité côté client. Toute protection repose sur l'auth JWT serveur et les server actions SvelteKit.

---

## Stack

- **SvelteKit 5** (Runes) + **TypeScript strict** (jamais de `any`)
- **Tailwind CSS 4.2** (Vite plugin, `@theme {}` tokens dans `src/app.css`)
- **PostgreSQL 16** (Docker dev, Scaleway Managed prod)
- **Drizzle ORM 0.45** — schéma : `src/lib/server/db/schema.ts`
- **Scaleway Generative API** — Mistral small, client : `src/lib/server/ai/ollama.ts`
- **Zod 4** pour la validation, **lucide-svelte** pour les icônes

---

## Commandes

```bash
docker compose up -d              # PostgreSQL en dev
npm run dev -- --host             # SvelteKit (HTTPS via @vitejs/plugin-basic-ssl)
npm run check                     # typecheck svelte-check
npm run db:push                   # appliquer le schéma sans migration
npm run db:seed                   # seed dev (assistante@lecocon.fr / password)
npm run db:generate               # générer une migration SQL
npm run db:studio                 # Drizzle Studio
```

---

## Architecture

```
hooks.server.ts → auth JWT → locals.user + locals.db
Pages : +page.server.ts (load) → domain services → DB
Mutations : actions dans +page.server.ts ou +server.ts
IA : POST /api/agent → classifyUnified → domain services
QR : POST /api/qr/{generate,scan,confirm} → attendance domain
```

Les domain services (`src/lib/domain/`) reçoivent `db: DrizzleDB` en premier paramètre. Erreurs : `catch { return [] }` ou `catch { return null }`.

Sécurité serveur — utiliser systématiquement :
- `requireRole(user, role)` ou `requireAuth(user)` sur chaque route
- `assertChildAccess(child, user)` sur chaque opération enfant
- `parseFormData(zodSchema, formData)` pour valider les inputs
- `createRateLimiter(max, windowMs)` sur les endpoints sensibles

---

## Design System — "Soie & Lumiere"

Identité visuelle forte : glassmorphism chaleureux, palette terre/miel, typographie expressive. Loin de tout rendu "app générique".

**Couleurs** (tokens dans `src/app.css` via `@theme {}`) :
- `miel-*` primaire, `sienne-*` secondaire, `warm-*` neutres
- `mousse-*` succès, `soleil-*` warning, `argile-*` danger, `bleu-*` info
- Neutres : `soie` (#FFF8F0), `voile`, `nuit` (#1A1612)

**IMPORTANT** : jamais `bg-white`, `bg-gray-*`, ni couleurs Tailwind par défaut. Tout utilise les tokens thème.

**Surfaces** : `glass-1` (cartes) et `glass-2` (éléments imbriqués). Le composant `Card` applique `glass-1` automatiquement.

**Typographie** : `Fraunces` (display, `.font-display`), `DM Sans` (body)

**Règles CSS** :
- `focus-visible:ring` (jamais `focus:ring`)
- `transition-colors` (jamais `transition-all` sur les nav items)
- Ombres toujours warm-tinted (`rgba(194, 101, 58, ...)`)
- Syntaxe Tailwind v4 canonique (`bg-linear-to-r`, `modifier!` en suffixe)
- Toutes les animations respectent `prefers-reduced-motion`

---

## Fonctionnalités principales

### Présences & QR Code
Système complet de pointage : arrivée/départ par scan QR ou saisie manuelle.
- **QR rotatif** : JWT signé (clé dérivée HMAC, 2 min expiry), affiché côté parent (`/app/my-qr`), scanné côté assmat (`/app/scan`)
- **Personnes autorisées** : adultes hors parents pouvant récupérer un enfant (table `authorized_persons`)
- **Rapport mensuel** : comparaison heures prévues (careSchedule) vs réelles (`/app/attendance/report`)
- **Dashboard widget** : compteur temps réel sur la vue d'ensemble
- **Agent IA** : intents `presence_today` et `hours_child`

### Journal quotidien
Repas, siestes, humeur, santé, changes — saisie en 30s. Batch upsert pour la saisie rapide.

### News & Communication
Actualités avec photos, notes parents (absence/retard/santé/logistique) avec accusé de réception.

### Agent IA
Panneau flottant, classification d'intent LLM, extraction d'entités rule-based + LLM, pipeline RAG.
- **Ne pas recréer `/app/ai`** — supprimée intentionnellement

---

## Conventions de code

- Indentation **2 espaces**, composants Svelte en **PascalCase**
- **UI en français**, **commentaires en anglais**
- Icônes : `lucide-svelte` uniquement, pas d'emojis dans l'interface
- `catch { return [] }` ou `catch { return null }` dans les domain services
- **Pas de nouvelle dépendance** sans justification forte — vérifier : natif possible ? package maintenu ? déjà couvert ?

---

## Workflow feature

1. Identifier les tables PostgreSQL → modifier `schema.ts` → `npm run db:push`
2. Implémenter le domain service (`src/lib/domain/`)
3. Implémenter `+page.server.ts` (load + actions)
4. Implémenter l'UI Svelte — gérer les 3 états : `loading`, `empty`, `error`
5. `npm run check` pour valider

---

## Git

- **`main`** = production, **`dev`** = développement courant
- Conventional commits : `feat:`, `fix:`, `refactor:`, `style:`, `chore:`
- Un commit = un changement logique, message décrit le **pourquoi**
- `git add <files>` individuellement — jamais `git add .`
- Ne jamais committer `.env` ou secrets

---

## Variables d'env

```
DATABASE_URL=postgresql://lecocon:lecocon_dev@localhost:5432/lecocon
JWT_SECRET=<min 32 chars>
AI_PROVIDER=scaleway | off
SCALEWAY_API_KEY=<clé>
```

---

## Prochaines étapes

- Pages légales : placeholders `[À compléter]` dans `legal/`
- Prod : migrations Drizzle, Scaleway TEM (emails), S3 (stockage), CI/CD GitHub Actions
- RGPD : tester export + suppression en staging
