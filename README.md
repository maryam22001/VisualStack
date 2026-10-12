<div align="center">

# VisualStack

**Design system architecture visually — drag, connect, ship.**
An interactive architecture-diagram studio with 2D and 3D isometric views, a searchable icon library,
and a full-stack account system — built as an easier alternative to text-first diagram tools.

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2d3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white)

</div>

---

## Table of contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Tech stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Repository structure](#5-repository-structure)
6. [Getting started](#6-getting-started)
7. [Environment variables](#7-environment-variables)
8. [Database & Prisma migrations](#8-database--prisma-migrations)
9. [API reference](#9-api-reference)
10. [Authentication & security model](#10-authentication--security-model)
11. [Email infrastructure (Gmail SMTP)](#11-email-infrastructure-gmail-smtp)
12. [Frontend architecture](#12-frontend-architecture)
13. [Deployment](#13-deployment)
14. [Testing](#14-testing)
15. [Troubleshooting](#15-troubleshooting)
16. [Scripts reference](#16-scripts-reference)
17. [Roadmap & known limitations](#17-roadmap--known-limitations)
18. [Contributing](#18-contributing)

---

## 1. Overview

Text-based diagram tools force an automatic layout: lines tangle, you cannot place things where you want them, there is
no spatial/3D view, and swapping in a real product logo is awkward. **VisualStack** flips that: you place nodes by hand,
wire them with a click, switch between a clean 2D diagram, a detailed 2D "engineering" view and a 3D isometric scene,
and search for an icon for *any* tool. Accounts and workspaces (backed by PostgreSQL) let designs live on the server.

The repository is an **npm-workspaces monorepo**:

| Workspace | Purpose |
|---|---|
| `apps/web` | React + Vite single-page app (the studio and the auth screens) |
| `apps/server` | Express + Prisma REST API (auth, email, workspaces, designs) |
| `packages/shared` | Types shared between web and server |

---

## 2. Features

### Diagramming studio
- **Three synchronized views** of one design: *Clean architecture* (service clusters), *Detailed 2D* (engineering cards), and *3D isometric* (rendered with [Isoflow](https://github.com/markmanx/isoflow)). The 3D scene is generated from the 2D data.
- **Drag-and-drop canvas** with infinite pan, mouse-wheel zoom and **snap-to-grid** alignment.
- **Click-to-connect wiring**: click a node's port, then another node's port. Connectors are colored, can be solid or dashed, and a double-click deletes one.
- **In-place editing**: double-click any node or cluster to rename it, change its description/badge/color, or delete it.
- **Cluster enclosures** (soft-blue rounded boxes) to group services into layers/zones.
- **Undo / redo** (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z) with a debounced history stack so a whole drag is one undo step.
- **Light and dark themes.**

### Icons — “any tool”
- **Searchable icon picker** backed by a layered library: bundled Isoflow icon packs (generic, AWS, GCP, Kubernetes) are searched instantly offline, then the [Iconify](https://iconify.design) index (200k+ icons incl. brand logos) as a fallback.
- **Custom icons**: upload your own SVG/PNG (stored as a data URL inside the design).
- Icons are stored per node as an image URL/data URL, so a diagram stays portable when exported to JSON.

### Save, share, export
- **Autosave** of the active project to the browser.
- **JSON export/import** — check diagrams into Git or move them between machines.
- **PNG and SVG export** (PNG can be copied straight to the clipboard).
- **Shareable link** — the whole design is encoded into the URL hash; no server needed to view it.
- **Shared design gallery** stored in PostgreSQL, per workspace: save, open, rename (debounced), delete — available on every device you sign in on. Guests keep a browser-only gallery.
- **Import** designs you saved in this browser before accounts existed, into your workspace, with one click.

### Accounts & security
- **Sign up → verify email (6-digit code) → sign in**, with a personal workspace created automatically.
- **Forgot password / reset password** via emailed one-time code.
- **Unverified users** who try to sign in are routed to the code screen with a **Resend code** button.
- **Session persistence**: HTTP-only cookie session that survives refreshes and is re-validated on every page load.
- **Instant session revocation**: a password reset or **Sign out of all devices** invalidates every session on every device.
- **Teams & roles**: add teammates to a workspace as **Editor** (can edit) or **Viewer** (read-only); a workspace picker switches between your own and shared workspaces. Roles are enforced by the server, not just the UI.
- Professional **HTML + plain-text transactional emails**.

---

## 3. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript (strict) | Web and server |
| Frontend | React 18, Vite 8 | SPA, no router (screen state machine) |
| Diagram engine | `isoflow` 1.x, `@isoflow/isopacks` | 3D isometric rendering and icon packs |
| 2D rendering | Custom SVG (`CleanArchitectureView`, `Architecture2D`) | pan/zoom/drag/connect implemented in-house |
| Icons | Isopacks + [Iconify API](https://iconify.design) | local-first, remote fallback |
| Backend | Node.js 22, Express 4 | REST, cookie-based sessions |
| ORM / DB | Prisma 5, PostgreSQL 16 | migrations in `apps/server/prisma/migrations` |
| Auth | argon2 (password hashing), `jsonwebtoken` (JWT in HTTP-only cookie), `zod` (validation) | |
| Email | Nodemailer → Gmail SMTP | App Password; HTML + text templates |
| Tooling | npm workspaces, `tsx`, ESLint, Docker Compose (Postgres), GitHub Actions (Pages) | |

---

## 4. Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI["React SPA (apps/web)"]
    LS[("localStorage<br/>project autosave,<br/>profile cache")]
  end
  subgraph Server["Express API (apps/server)"]
    MW["requireAuth<br/>(JWT cookie)"]
    CTRL["Controllers<br/>auth · designs"]
    MAIL["email.service<br/>(Nodemailer)"]
  end
  DB[("PostgreSQL<br/>via Prisma")]
  GMAIL["Gmail SMTP"]
  ICONIFY["Iconify API"]

  UI -- "fetch /api/* (credentials: include)" --> MW --> CTRL --> DB
  CTRL --> MAIL --> GMAIL
  UI --> LS
  UI -. "icon search" .-> ICONIFY
```

### Sign-up → verification → sign-in

```mermaid
sequenceDiagram
  actor U as User
  participant W as Web app
  participant A as API
  participant D as Postgres
  participant M as Gmail SMTP

  U->>W: Fill sign-up form
  W->>A: POST /api/auth/register
  A->>D: create User + Workspace (one transaction)
  A->>M: send 6-digit code
  A-->>W: 201 { user, emailSent } (no cookie yet)
  U->>W: Enter code
  W->>A: POST /api/auth/verify { userId, code }
  A->>D: mark verified
  W->>A: POST /api/auth/login
  A-->>W: Set-Cookie: token=JWT (HttpOnly) + { user }
  Note over W: Studio opens on the user's workspace
```

### Session persistence

```mermaid
sequenceDiagram
  participant W as Web app (useAuth)
  participant A as API
  W->>W: Read cached profile from localStorage (instant paint)
  W->>A: GET /api/auth/me (cookie sent automatically)
  alt cookie valid
    A-->>W: 200 { user } → refresh cache
  else missing / expired
    A-->>W: 401 → clear cache → show sign-in
  end
```

---

## 5. Repository structure
```text
VisualStack/
├── apps/
│   ├── server/
│   │   ├── prisma/
│   │   │   ├── schema.prisma              # data model
│   │   │   └── migrations/                # SQL migrations (commit these; never edit applied ones)
│   │   ├── tests/                         # node:test API suites (fake DB, no Postgres needed)
│   │   └── src/
│   │       ├── index.ts                   # boot: env, JWT check, SMTP check, listen
│   │       ├── app.ts                     # security headers, CORS, routes, health, optional web serving
│   │       ├── controllers/
│   │       │   ├── auth.controllers.ts    # register/verify/resend/login/logout(-all)/me/forgot/reset
│   │       │   ├── workspace.controller.ts# my workspaces, members: list/add/role/remove
│   │       │   └── design.controller.ts   # designs CRUD, role-checked
│   │       ├── middleware/requireAuth.ts  # cookie JWT + tokenVersion check
│   │       └── services/
│   │           ├── db.service.ts          # PrismaClient
│   │           ├── access.service.ts      # roles: owner / editor / viewer
│   │           ├── email.service.ts       # templates + Gmail transport
│   │           └── token.service.ts       # JWT + cookie options
│   └── web/
│       └── src/
│           ├── App.tsx                    # studio shell, auth gating, workspace picker
│           ├── api/client.ts              # typed fetch client (cookies, ApiError, 401 event)
│           ├── hooks/
│           │   ├── AuthProvider.tsx       # session: cached profile + /auth/me validation
│           │   ├── useAuth.ts             # context + hook
│           │   ├── useDesigns.ts          # gallery store: API for users, localStorage for guests
│           │   └── useProjectHistory.ts   # undo/redo
│           ├── pages/AuthScreens.tsx      # sign in / up / verify / forgot / reset (+ auth.css)
│           ├── components/                # DesignGalleryModal (designs + team), IconPicker
│           ├── views/                     # CleanArchitectureView, Architecture2D
│           ├── utils/                     # storage, designStorage, isoflowAdapter, IconLibrary, geometry
│           └── types/project.ts           # VisualStackProject schema
├── packages/shared/                       # shared types
├── scripts/smoke.mjs                      # post-deploy smoke test
├── .github/workflows/
│   ├── ci.yml                             # check + real-Postgres migration + smoke test
│   └── deploy.yml                         # optional: static web -> GitHub Pages
├── Dockerfile  .dockerignore              # one image: API + web
├── render.yaml                            # Render blueprint: service + database
├── docker-compose.yml                     # local PostgreSQL 16
├── DEPLOYMENT.md                          # step-by-step production guide
└── .env.example
```

---

## 6. Getting started

### Prerequisites
- **Node.js 20.19+** (22 recommended) and npm 10+
- **Docker** (for local PostgreSQL) — or any PostgreSQL 14+ instance
- A **Google account** with 2-Step Verification (for sending email) — see [§11](#11-email-infrastructure-gmail-smtp)

### Setup

```bash
# 1. Clone and install (installs all workspaces)
git clone https://github.com/maryam22001/VisualStack.git
cd VisualStack
npm install

# 2. Configure the API
cp .env.example apps/server/.env
#    then edit apps/server/.env  (DATABASE_URL, JWT_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD)

# 3. Start PostgreSQL
npm run docker:up

# 4. Create the schema and generate the Prisma client
npm run db:migrate          # prompts for a migration name on first run
npm run db:generate

# 5. Run API + web together
npm run dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:5174 |
| API | http://localhost:5000 (`GET /api/health`) |

In development the Vite dev server **proxies `/api` → `http://localhost:5000`**, so the browser sees one origin and the
session cookie works without any CORS setup.

### First run checklist
1. Open http://localhost:5174 → **Create an account**.
2. The API log should show `[email] SMTP ready - sending as you@gmail.com` at boot and
   `[email] verify email sent to …` after sign-up. If SMTP is not configured, the code is printed in the server console
   (development only) so you can still proceed.
3. Enter the 6-digit code → you land in the studio on **“<your name>'s Workspace”**.
4. Refresh the page — you stay signed in.
5. Run **`npm run check`** to confirm everything is in order (see [§14](#14-testing)).

---

## 7. Environment variables

The API reads `apps/server/.env`. Never commit it.

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/visualstack?schema=public` | Postgres connection string |
| `JWT_SECRET` | ✅ prod | `openssl rand -base64 48` | ≥ 32 chars. In production the server **refuses to start** without it |
| `GMAIL_USER` | ✅ email | `you@gmail.com` | Sender account |
| `GMAIL_APP_PASSWORD` | ✅ email | `abcd efgh ijkl mnop` | 16-char Google App Password (spaces ignored) |
| `EMAIL_FROM_NAME` | – | `VisualStack` | Display name on emails |
| `EMAIL_REPLY_TO` | – | `support@yourdomain.com` | Reply-To header |
| `PORT` | – | `5000` | API port |
| `NODE_ENV` | – | `production` | Enables `Secure` cookies, hides dev code logging |
| `SERVE_WEB` | – | `true` | API also serves the built web app (single origin). Default: on in production when `apps/web/dist` exists |
| `WEB_DIST_DIR` | – | `/app/apps/web/dist` | Override the folder served when `SERVE_WEB` is on |
| `CLIENT_ORIGIN` | split hosting only | `https://app.example.com` | Allowed browser origin(s) for CORS, comma-separated. Not needed when the API serves the web app |
| `COOKIE_SAMESITE` | – | `lax` \| `strict` \| `none` | Use `none` only for cross-site setups (needs HTTPS) |
| `COOKIE_DOMAIN` | – | `.example.com` | Share the cookie between `app.` and `api.` subdomains |

Frontend build-time variables (`apps/web/.env.production`):

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Public API origin, e.g. `https://api.example.com`. **Leave empty in development and when the API serves the web app** |
| `VITE_BASE_PATH` | Sub-path when hosted on GitHub Pages project sites, e.g. `/VisualStack/` |

---

## 8. Database & Prisma migrations

### Data model

```mermaid
erDiagram
  User ||--o{ Workspace : owns
  User ||--o{ WorkspaceMember : "member of"
  Workspace ||--o{ WorkspaceMember : has
  Workspace ||--o{ Design : contains
  User |o--o{ Design : created

  User {
    uuid id PK
    string email UK
    string passwordHash
    string fullName
    bool isVerified
    string verificationCode
    datetime verificationExpiresAt
    int verificationAttempts
    string resetCode
    datetime resetExpiresAt
    int resetAttempts
    int tokenVersion
  }
  Workspace { uuid id PK
    string name
    uuid ownerId FK }
  WorkspaceMember { uuid workspaceId PK
    uuid userId PK
    string role }
  Design { uuid id PK
    uuid workspaceId FK
    uuid createdById FK
    string title
    string viewMode
    string theme
    json graphData }
```

### Commands

| Situation | Command | Notes |
|---|---|---|
| Local development | `npm run db:migrate` | Creates + applies a migration from `schema.prisma` changes, regenerates the client |
| Regenerate client only | `npm run db:generate` | Run after pulling schema changes |
| **Production / CI** | `npm run db:deploy` | Applies committed migrations only; never prompts, never resets |
| Inspect data | `npm run db:studio` | Prisma Studio on http://localhost:5555 |

> ⚠️ **After pulling this update, apply the new migration.** It adds `User.tokenVersion`, which lets a password reset or
> *Sign out of all devices* revoke sessions instantly. The migration `20261010120000_add_token_version` is included:
>
> ```bash
> npm run db:migrate      # local: applies it (and regenerates the Prisma client)
> npm run db:deploy       # production / CI
> ```
>
> (The reset-code and attempt-counter columns arrived earlier in `20261010033547_version1_1`.) The new column has a default,
> so existing users migrate without data loss. Never edit a migration that has been applied. CI checks that `schema.prisma`
> is fully covered by committed migrations, so a forgotten migration fails the build.

### Production rollout
```bash
# on the deploy target, with DATABASE_URL pointing at production
npx prisma migrate deploy --schema apps/server/prisma/schema.prisma
```
Run this **before** starting the new API version. Never use `migrate dev` or `migrate reset` against production.

---

## 9. API reference
Base URL: `/api`. JSON in, JSON out. Protected routes need the `token` cookie (sent automatically by the browser when
`credentials: 'include'` is used). Errors look like `{ "error": "Human readable message" }`.

### Auth

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/register` | – | `{ fullName, email, password }` | `201 { user, emailSent }` — **no cookie** |
| POST | `/auth/verify` | – | `{ userId, code }` | `200 { success, isVerified }` |
| POST | `/auth/resend-code` | – | `{ email }` | `200 { success, emailSent }` |
| POST | `/auth/login` | – | `{ email, password }` | `200 { user }` + `Set-Cookie: token` |
| POST | `/auth/logout` | – | – | `200 { success }` (cookie cleared) |
| POST | `/auth/logout-all` | cookie | – | `200 { success }` — revokes **every** session of the account |
| GET | `/auth/me` | cookie | – | `200 { user }` |
| POST | `/auth/forgot-password` | – | `{ email }` | `200 { message }` (always) |
| POST | `/auth/reset-password` | – | `{ email, code, newPassword }` | `200 { message }` (also revokes all sessions) |

`/auth/resend` is kept as a legacy alias of `/auth/resend-code`.

**`user` object** (the only user shape the browser ever receives):
```json
{ "id": "…", "fullName": "Ada Lovelace", "email": "ada@example.com", "isVerified": true,
  "currentWorkspaceId": "…", "currentWorkspaceName": "Ada Lovelace's Workspace" }
```

### Workspaces & team (session required)

| Method | Path | Who | Body | Success |
|---|---|---|---|---|
| GET | `/workspaces` | any user | – | `200 [{ id, name, ownerId, role }]` — every workspace I belong to |
| GET | `/workspaces/:id/members` | any member | – | `200 [{ userId, fullName, email, role }]` |
| POST | `/workspaces/:id/members` | **owner** | `{ email, role: "editor"\|"viewer" }` | `201 member` — the person must already have a verified account |
| PATCH | `/workspaces/:id/members/:userId` | **owner** | `{ role }` | `200 member` |
| DELETE | `/workspaces/:id/members/:userId` | owner (anyone), or a member removing **themselves** | – | `200 { success }` — the owner cannot be removed |

### Designs (session required)

| Method | Path | Needs | Body | Success |
|---|---|---|---|---|
| GET | `/workspaces/:workspaceId/designs` | any role | – | `200 Design[]` (newest first) |
| POST | `/designs` | owner / editor | `{ id?, workspaceId, title, viewMode, theme, graphData }` | `201` created, or `200` updated when `id` exists |
| DELETE | `/designs/:id` | owner / editor | – | `200 { success }` |

`graphData` holds the whole `VisualStackProject`.

**Roles**

| Role | Read designs | Create / edit / delete designs | Manage members |
|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ |
| `editor` | ✅ | ✅ | – (can leave) |
| `viewer` | ✅ | ❌ `403` | – (can leave) |

Legacy rows with `role = "member"` are treated as `editor`.

### Misc
`GET /api/health` → `200 { "status": "ok", "db": "up" }`, or `503 { "status": "degraded", "db": "down" }` when the
database is unreachable (use it as your host's health check). Unknown `/api/*` paths return a JSON `404`.

### Status codes worth handling

| Code | Where | Meaning |
|---|---|---|
| `400` | any | Validation failed (`error` has the first problem) |
| `401` | `/login`, protected routes | Wrong credentials / missing, expired or **revoked** session |
| `403` | `/login` | Correct password but **email not verified** → `needsVerification: true`, `userId`, `email` |
| `403` | designs, workspaces | Not a member of that workspace, or role too low (e.g. viewer writing) |
| `404` | members | No verified account with that email (invite) / member not found |
| `409` | `/register`, add member | Email already registered / already a member |
| `429` | `/verify`, `/resend-code`, `/reset-password` | Too many wrong codes, or resend cooldown (`retryAfter` seconds) |

### Example

```bash
curl -i -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse battery"}' \
  http://localhost:5000/api/auth/login

curl -b jar.txt http://localhost:5000/api/auth/me
curl -b jar.txt http://localhost:5000/api/workspaces
```

---

## 10. Authentication & security model
| Concern | Implementation |
|---|---|
| Password storage | **argon2** hashes; passwords 8–128 chars |
| Session | JWT (7 days) in an **HTTP-only** cookie (`token`); JavaScript cannot read it, so XSS cannot steal it. `Secure` in production; `SameSite` configurable |
| **Session revocation** | Every JWT carries the user's `tokenVersion`; `requireAuth` compares it with the database on each request. A **password reset** or **Sign out of all devices** bumps it, so all older sessions stop working immediately, on every device. Deleted/unverified accounts are rejected the same way |
| What the browser stores | A **non-sensitive profile cache** in `localStorage` (name, email, workspace) — never the token. It is re-validated with `GET /auth/me` on every load |
| Email verification | 6-digit code from `crypto.randomInt`, 10-minute lifetime, compared in constant time |
| No verification bypass | `/register` does **not** set a session; only `/login` does, and only for verified accounts |
| Brute-force limits | 5 wrong codes burn the code (verification and reset); 30-second resend cooldown |
| Password reset | 6-digit code, 15-minute lifetime, single use; a successful reset also marks the email verified (the code only reached that inbox) |
| Account enumeration | `/forgot-password` and `/resend-code` answer identically for unknown emails; login uses one generic error. *(Adding a teammate does reveal whether an email has an account — to workspace owners only — because invitations need an existing account.)* |
| Authorization | `requireAuth` on every workspace/design route **plus** a role check (owner / editor / viewer) from the database on every read, write and delete. The UI hides what you cannot do, but the server is the authority |
| Input validation | `zod` schemas on auth and member endpoints; body size limit; malformed JSON → clean `400` |
| CORS | Only origins listed in `CLIENT_ORIGIN`, with credentials (irrelevant in single-origin deployments) |
| Transport/headers | HSTS in production, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`; `X-Powered-By` removed |
| Secrets | `JWT_SECRET` ≥ 32 chars is enforced at boot in production; verification codes are never logged in production |
| HTML emails | User-supplied names are HTML-escaped before templating |

---

## 11. Email infrastructure (Gmail SMTP)

### Create the App Password
1. Google Account → **Security** → enable **2-Step Verification**.
2. Open <https://myaccount.google.com/apppasswords> → create one (name it “VisualStack”).
3. Copy the 16-character password into `GMAIL_APP_PASSWORD` (spaces are ignored).
4. Set `GMAIL_USER` to the same account.

> Use the App Password, **not** your normal Google password. If Gmail rejects the login, the API logs a precise hint at
> startup (`EAUTH`) — you do not have to wait for the first sign-up to find out.

### Production configuration
Set these in your host's secret manager / dashboard (Render, Railway, Fly.io, …) — **not** in the repository:

```text
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
EMAIL_FROM_NAME=VisualStack
NODE_ENV=production
```
On boot, look for `[email] SMTP ready - sending as …` in the logs.

### Delivery testing (do this before launch)
1. Register real accounts using **Gmail, Outlook/Hotmail, Yahoo and iCloud** addresses.
2. For each: confirm the message lands in the **inbox, not spam**, the subject shows the code, and the layout renders
   (light-only design, so dark-mode clients are fine).
3. In Gmail open the message → **⋮ → Show original** and confirm `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
4. Send one message to the address from <https://www.mail-tester.com> and aim for **9/10 or better**.
5. Click **Resend code** and confirm the 30-second cooldown and that the old code stops working.

### Limits and the upgrade path
- A personal Gmail account allows only a few hundred recipients per day (Google Workspace allows more) and Google can
  rewrite or throttle bulk mail. That is fine for early use and testing, **not** for high volume.
- For production at scale, send from **your own domain** through a transactional provider (Resend, Postmark, Amazon SES)
  after configuring **SPF, DKIM and DMARC** for the domain. Only `email.service.ts` needs to change; the controllers call
  `sendOtpEmail` / `sendPasswordResetEmail` and are provider-agnostic.

---

## 12. Frontend architecture

### One canonical project schema
Every view reads and writes a single `VisualStackProject` (`apps/web/src/types/project.ts`): metadata, `activeTab`,
`cleanView` and `detailed2DView` (each with nodes, clusters/connectors). The 3D scene is derived on the fly by
`utils/isoflowAdapter.ts`. JSON export/import, share links and autosave all serialize this one object.

### State and modules

| Module | Responsibility |
|---|---|
| `App.tsx` | Studio shell: header actions, view switching, export/share/import, auth gating |
| `hooks/AuthProvider.tsx` + `hooks/useAuth.ts` | Session context: cached profile + `/auth/me` validation, global 401 handling, `logout()` and `logoutEverywhere()` |
| `hooks/useDesigns.ts` | Gallery store. Signed in → API (workspaces, designs, members, roles; optimistic updates; debounced renames). Guest → `localStorage`. One interface for both |
| `hooks/useProjectHistory.ts` | Undo/redo stack with debounced snapshots |
| `api/client.ts` | Typed `fetch` wrapper: `credentials: 'include'`, `ApiError`, 401 event |
| `pages/AuthScreens.tsx` | Sign in · sign up · verify code · forgot password · reset password |
| `views/*` | SVG canvases: pan/zoom, drag, snap, click-to-connect, edit modals |
| `utils/IconLibrary.ts`, `components/IconPicker.tsx` | Icon search (Isopacks first, Iconify fallback) |
| `utils/storage.ts` | Autosave, JSON export/import, URL-hash sharing, PNG/SVG export |
| `utils/designStorage.ts` | Browser-only design storage (guests, and the one-click import into a workspace) |
| `components/DesignGalleryModal.tsx` | Workspace Hub: **Designs** tab (server gallery, import banner, view-only notice) and **Team & Account** tab (members, roles, invite, sign out everywhere) |

### Auth gating
`App.tsx` renders: a loading screen while the first session check runs → `AuthScreens` when there is no user (unless
the visitor chose *Continue without an account*) → the studio, with the workspace name in the header.

### Auth screens state machine
`login ⇄ signup → verify → (signed in)` and `login → forgot → reset → login`. A login that returns
`403 needsVerification` jumps straight to `verify` with a prompt and a Resend button.

---

## 13. Deployment
> The complete, step-by-step guide is in **[DEPLOYMENT.md](./DEPLOYMENT.md)**. Summary:

### Recommended: one service, one origin
The API serves the built web app, so the session cookie is first-party and there is no CORS to configure:

```text
https://app.example.com  →  /  (React app)   /api/*  (Express)   →  PostgreSQL
```

| Path | How |
|---|---|
| **Render** (easiest) | New → **Blueprint** → select this repo. `render.yaml` creates the service + a PostgreSQL database; fill in `GMAIL_USER` and `GMAIL_APP_PASSWORD`. |
| **Docker** (Fly.io, Railway, VPS) | `docker build -t visualstack .` then run it with `DATABASE_URL`, `JWT_SECRET`, `GMAIL_*`. The container runs migrations on start. |
| **Split hosting** (static host + API) | Only on the **same parent domain** (`app.` + `api.`), with `CLIENT_ORIGIN`, `COOKIE_DOMAIN` and `VITE_API_BASE_URL`. `deploy.yml` publishes the static part to GitHub Pages. |

### Production commands (what the hosts run)

| Step | Command |
|---|---|
| Install | `npm ci --include=dev` *(build tools are devDependencies)* |
| Build | `npm run db:generate && npm run build` |
| Migrate | `npm run db:deploy` |
| Start | `npm run start` |

### Verify a live deployment
```bash
API_URL=https://app.example.com WEB=1 npm run smoke
```

### Production checklist
- [ ] `npm run check` passes locally and **CI is green**
- [ ] Migrations committed and applied (`npm run db:deploy`)
- [ ] `NODE_ENV=production`; strong `JWT_SECRET`; `DATABASE_URL` and `GMAIL_*` stored as secrets
- [ ] HTTPS on a custom domain; paid database plan with **backups**
- [ ] `npm run smoke` passes against the live URL; boot log shows `[email] SMTP ready`
- [ ] Sign-up emails tested on Gmail, Outlook and Yahoo (inbox + SPF/DKIM/DMARC pass)

---

## 14. Testing
### One command

```bash
npm run check
```
Runs, in order: Prisma client generation → schema validation → TypeScript on web **and** server → ESLint → API tests →
production build of web and server. Stops at the first failure.

| Command | What it verifies |
|---|---|
| `npm run typecheck` | `tsc --noEmit` for `apps/web` and `apps/server` |
| `npm run lint` | ESLint (zero errors expected) |
| `npm test` | **35 API tests** (Node's built-in runner, no extra dependencies, no PostgreSQL needed) |
| `npm run build` | Production bundles: `apps/web/dist` and `apps/server/dist` |
| `npm run smoke` | Black-box checks of a **running** server (local or deployed); add `WEB=1` / `ORIGIN=…` for web serving / CORS |
| `npm run db:validate` | `schema.prisma` is valid |

### What the 35 API tests cover

| Suite | Verified behaviours |
|---|---|
| **auth** | validation; duplicate email → 409; **no session before verification**; unverified login → 403; resend cooldown; 5 wrong codes burn the code; cookie flags (HttpOnly, SameSite); no secrets in responses; `/me`; tampered and legacy tokens; logout; enumeration-safe forgot-password; reset (wrong code, weak password, single use); **a password reset revokes older sessions**; **sign out of all devices revokes every session** |
| **workspaces** | list my workspaces; **owner-only** member management; unknown/unverified email explained; duplicates; **editor can write, viewer cannot (403)**; outsiders get 403 everywhere; role changes take effect immediately; owner role is protected; removal revokes access; members can leave; every protected route needs a session |
| **single-origin serving** | `index.html` at `/` (never cached); SPA fallback; fingerprinted assets cached for a year; JSON 404 for unknown API routes; health check reports the DB; security headers; clean 400 on malformed JSON |

The tests boot the **real Express app** with an in-memory stand-in for Prisma, so routing, validation, cookies, auth and roles are
exercised end-to-end. They do not exercise PostgreSQL itself — that is what CI adds.

### Continuous integration
`.github/workflows/ci.yml` runs on every push and pull request against a **real PostgreSQL 16** service:

1. `npm run check` steps (generate, validate, typecheck, lint, tests, build)
2. `prisma migrate deploy` — proves the migrations apply to a clean database
3. `prisma migrate diff --exit-code` — fails if `schema.prisma` has changes **not covered by a committed migration**
4. Boots the production server and runs `npm run smoke` (API + built web app)

### Manual smoke test after any deploy
Sign up with a fresh address → receive email → verify → refresh → sign out → *Forgot password* → reset → sign in →
**Save** a design → reload → it is still there → *Team & Account*: add a second account as **View only** and confirm it cannot save.

### UI verification
The sign-in/forgot/reset flows, session persistence across refresh, the server-backed gallery (save, import, debounced rename,
delete), team management, view-only enforcement, sign-out-everywhere and guest mode were verified in a headless browser against a
mocked API during development. Those scripts are not committed yet; adding a Playwright suite to CI is on the roadmap.

---

## 15. Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| `[email] SMTP error … EAUTH` | Wrong Gmail credentials. Use a 16-char **App Password**; 2-Step Verification must be on |
| `GMAIL_USER / GMAIL_APP_PASSWORD not set` | `.env` is not in `apps/server/` or the server was not restarted |
| Code only appears in the server console | SMTP not configured (dev fallback). Never happens in production logs |
| Email in spam | Verify SPF/DKIM/DMARC pass (see §11); consider a custom domain + transactional provider |
| `404` on `/api/...` in the browser | Vite proxy not running — start via `npm run dev`; port must be 5174 |
| `GET /` shows "VisualStack API is up…" in production | The web build is missing or `SERVE_WEB` is off. Build with `npm run build` and set `NODE_ENV=production` |
| CORS error / cookie not stored (split hosting) | `CLIENT_ORIGIN` mismatch, missing HTTPS, or web and API on different sites (see DEPLOYMENT.md §5) |
| Signed out immediately after login / on refresh | Cookie blocked (cross-site or non-HTTPS). Check the `Set-Cookie` response in dev tools |
| Signed out on every device after a reset | Expected: a password reset or *Sign out of all devices* revokes all sessions |
| `JWT_SECRET must be set…` at boot | Set a ≥ 32-char `JWT_SECRET` (enforced in production) |
| `Property 'tokenVersion'/'resetCode' does not exist` | Run `npm run db:generate` after pulling a schema change |
| `column "tokenVersion" does not exist` at runtime | Migrations not applied: `npm run db:migrate` (dev) / `npm run db:deploy` (prod) |
| `column … already exists` while migrating | You created your own migration for the same columns. Delete the duplicate (see §8) |
| Prisma `P3009` / drift | Never edit an applied migration. Locally: `npx prisma migrate reset` (destroys local data) |
| Gallery says "Could not load your workspaces" | API unreachable or session expired; use **Retry**, or sign in again |
| Save button is greyed out | Your role in the selected workspace is **Viewer** — ask the owner for edit access |
| "No VisualStack account uses that email yet" when adding a teammate | They must sign up and verify first; then add them |
| My old designs are missing after signing in | They are still in this browser: open **Gallery** — a banner offers to **Import** them into your workspace |
| Blank page / React `ReactCurrentOwner` error | React must stay on 18.x (`react@18.3.1`); Isoflow is not compatible with React 19 |
| `docker compose up` port 5432 in use | Another Postgres is running; stop it or change the published port and `DATABASE_URL` |
| Build: `tsc`/`vite` not found on the host | Dev dependencies were skipped. Install with `npm ci --include=dev` |

---

## 16. Scripts reference
| Script (run from the repo root) | Action |
|---|---|
| `npm run dev` | API (`tsx watch`) + web (Vite) together |
| `npm run dev:server` / `dev:web` | Run one side only |
| `npm run check` | **Everything**: generate, validate, typecheck, lint, tests, build |
| `npm run typecheck` / `lint` / `test` | Individual quality gates |
| `npm run build` | Build web and server (`build:web`, `build:server`, `build:shared` run one) |
| `npm run start` | Run the built server (`apps/server/dist`) |
| `npm run smoke` | Smoke-test a running server (`API_URL`, `ORIGIN`, `WEB=1`) |
| `npm run docker:up` | Start local PostgreSQL |
| `npm run db:migrate` / `db:deploy` / `db:generate` / `db:validate` / `db:studio` | Prisma workflows (see §8) |

---

## 17. Roadmap & known limitations
**Known limitations (honest list)**
- **No real-time co-editing.** Saving is explicit and the **last save wins**: if two editors save the same design, the later
  one overwrites the earlier. Optimistic concurrency (reject stale saves using `updatedAt`) is the next safeguard.
- **Teammates must already have an account.** There are no pending email invitations yet; owners add existing, verified users.
- Roles are **per workspace**, not per design.
- No per-IP rate limiting on auth endpoints (per-account limits exist: 5 attempts per code, 30 s resend cooldown). Add
  `express-rate-limit` before heavy public traffic.
- Gmail SMTP is rate-limited; move to your own domain + a transactional provider for volume.
- The 3D view is generated from the 2D data and is read-only.
- The browser-level (UI) tests are not committed; CI runs type-check, lint, API tests, migrations and the smoke test.
- The `Dockerfile` and `render.yaml` are provided and follow the platforms' documented formats, but were not built/applied in the
  environment this was developed in — CI and your first deploy are their first real run.

**Next up**
1. Optimistic concurrency + "someone else changed this design" prompt.
2. Email invitations for people who have no account yet.
3. Text/DSL import (`esp1 -> broker: MQTT`) → nodes and connectors.
4. Auto-layout button as an escape hatch, alignment guides, starter templates.
5. Per-node icons in the 3D view; publishable `ArchitectureStudio` React component.
6. Playwright UI suite in CI; per-IP rate limiting.

---

## 18. Contributing

1. Fork and branch: `git checkout -b feat/short-description`
2. Keep TypeScript strict-clean: `npx tsc --noEmit -p apps/web/tsconfig.app.json` and `npx tsc --noEmit -p apps/server/tsconfig.json`
3. Schema changes **must** ship with a committed migration (`npm run db:migrate -- --name what_changed`)
4. Never commit `.env` files or real credentials
5. Open a pull request describing the change and how you tested it

---

<div align="center">Built with React, Express, Prisma and Isoflow.</div>
