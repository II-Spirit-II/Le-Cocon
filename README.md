<p align="center">
  <img src="static/icons/logofull.png" alt="Le Cocon" width="120" />
</p>

<h1 align="center">Le Cocon</h1>

<p align="center">
  <strong>Cahier de liaison nouvelle generation pour assistantes maternelles et parents.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SvelteKit-5-FF3E00?logo=svelte&logoColor=white" alt="SvelteKit 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/version-0.7.0-ED7424" alt="v0.7.0" />
</p>

---

## A propos

Le Cocon est une application web pensee pour simplifier le quotidien des **assistantes maternelles** et des **parents**. Elle remplace le cahier de liaison papier par une interface moderne, securisee et accessible depuis n'importe quel appareil.

Concue pour fonctionner aussi bien pour une assistante individuelle que pour une structure accueillant une cinquantaine d'enfants.

---

## Fonctionnalites

| Module | Description |
|---|---|
| **Journal quotidien** | Saisie structuree : repas (avec assiettes visuelles), sieste, humeur, sante, changes. Saisie individuelle ou par lot. |
| **Fil d'actus** | Messages courts et chaleureux sur la journee de l'enfant, visibles en temps reel par les parents. |
| **Notes parents** | Absences, retards, informations medicales — avec systeme d'accuse de reception et reponses. |
| **Calendrier** | Vue mensuelle des absences et evenements, filtrable par enfant et par type. |
| **Menus du jour** | Configuration des repas (petit-dej, dejeuner, gouter) repris automatiquement dans les journaux. |
| **Codes d'invitation** | L'assistante genere un code pour inviter un parent a rejoindre le profil de son enfant. |
| **Agent IA** | Assistant conversationnel omnipresent : cree des journaux, publie des news, repond aux questions sur l'historique. |
| **Vue d'ensemble** | Dashboard adapte au role : meteo de la structure (assmat), suivi enfant (parent). |

---

## Stack technique

```
Frontend       SvelteKit 5 (Runes) + TypeScript + TailwindCSS 3.4
Backend        PostgreSQL 16 + Drizzle ORM 0.45
Auth           JWT (jsonwebtoken) + bcryptjs 3
Validation     Zod 4
IA             Scaleway Generative API (Mistral) via OpenAI SDK
Icons          lucide-svelte
Infra          Docker Compose (dev + prod)
```

---

## Demarrage rapide

### Prerequis

- Docker & Docker Compose
- (Optionnel) Node.js 22+ pour le dev local sans Docker

### Avec Docker (recommande)

```bash
git clone https://github.com/II-Spirit-II/Le-Cocon.git
cd Le-Cocon
docker compose up
```

L'app demarre sur **http://localhost:5173** — le schema DB est applique automatiquement.

### Donnees de test

```bash
docker compose exec app npm run db:seed
```

Comptes crees :
| Email | Mot de passe | Role |
|---|---|---|
| `assistante@lecocon.fr` | `password` | Assistante maternelle |
| `parent@lecocon.fr` | `password` | Parent |

### Variables d'environnement

Copier `.env.example` et adapter :

```env
DATABASE_URL=postgresql://lecocon:lecocon_dev@postgres:5432/lecocon
JWT_SECRET=your-secret-min-32-chars
AI_PROVIDER=scaleway        # or "off" to disable AI
SCALEWAY_API_KEY=scw-xxx
```

---

## Architecture

```
src/
 ├ lib/
 │  ├ domain/          Business logic (one file per entity)
 │  ├ server/
 │  │  ├ ai/           AI pipeline, agent actions, Scaleway client
 │  │  ├ db/           Drizzle schema, PostgreSQL pool, seed
 │  │  ├ auth.ts       JWT + bcrypt
 │  │  ├ helpers.ts    Guards, rate limiter, utilities
 │  │  └ validation.ts Zod schemas + parseFormData
 │  ├ stores/          Svelte stores (auth, agent panel)
 │  ├ types/           TypeScript types
 │  └ ui/              Design system (20+ components)
 ├ routes/
 │  ├ (auth)/          Login, onboarding
 │  ├ (app)/           Protected app pages
 │  └ api/             REST endpoints (agent, logout)
docker-compose.yml     Dev environment
docker-compose.prod.yml Production overlay
Dockerfile             Multi-stage production build
```

---

## Securite

- **Zero securite cote client** — tout repose sur le serveur
- Auth JWT avec secret cache + cookie httpOnly/secure
- Rate limiting : login (10/15min par email), agent IA (15/min par user)
- Validation Zod sur tous les formulaires
- Ownership check sur chaque acces enfant (parent ET assistante)
- Mot de passe : bcrypt $2b$ (12 rounds)

---

## Design System

20+ composants reutilisables dans `src/lib/ui/` :

`Button` `Card` `Input` `Textarea` `Select` `Badge` `Avatar` `PageHeader` `Section` `EmptyState` `Tabs` `Callout` `CalendarMonth` `ConfirmDialog` `PlateVisual` `AgentPanel` `AgentButton` `FadeIn`

Palette chaleureuse a base de tons warm + accent terracotta (`cocon-500: #ED7424`).

---

## Scripts utiles

```bash
npm run dev           # Dev server (Vite)
npm run build         # Production build
npm run check         # TypeScript check
npm run db:push       # Apply schema to DB (no migration)
npm run db:generate   # Generate SQL migration
npm run db:studio     # Drizzle Studio (DB GUI)
npm run db:seed       # Seed test data
```

---

## Licence

Projet prive — Tous droits reserves.
