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
- **Design gallery** with rename/delete.

### Accounts & security
- **Sign up → verify email (6-digit code) → sign in**, with a personal workspace created automatically.
- **Forgot password / reset password** via emailed one-time code.
- **Unverified users** who try to sign in are routed to the code screen with a **Resend code** button.
- **Session persistence**: HTTP-only cookie session that survives refreshes and is re-validated on every page load.
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
│   │   │   ├── schema.prisma            # data model
│   │   │   └── migrations/              # SQL migrations (commit these)
│   │   └── src/
│   │       ├── index.ts                 # boot: env, JWT check, SMTP check, listen
│   │       ├── app.ts                   # CORS, cookies, routes
│   │       ├── controllers/
│   │       │   ├── auth.controllers.ts  # register/verify/resend/login/logout/me/forgot/reset
│   │       │   └── design.controller.ts # designs CRUD with workspace authorization
│   │       ├── middleware/requireAuth.ts
│   │       └── services/
│   │           ├── db.service.ts        # PrismaClient
│   │           ├── email.service.ts     # templates + Gmail transport
│   │           └── token.service.ts     # JWT + cookie options
│   └── web/
│       └── src/
│           ├── App.tsx                  # studio shell, auth gating
│           ├── api/client.ts            # typed fetch client
│           ├── hooks/                   # useAuth (session), useProjectHistory (undo/redo)
│           ├── pages/AuthScreens.tsx    # sign in / up / verify / forgot / reset (+ auth.css)
│           ├── views/                   # CleanArchitectureView, Architecture2D
│           ├── components/              # IconPicker, DesignGalleryModal
│           ├── utils/                   # storage, isoflowAdapter, IconLibrary, geometry
│           └── types/project.ts         # VisualStackProject schema
├── packages/shared/                     # shared types
├── .github/workflows/deploy.yml         # frontend → GitHub Pages
├── docker-compose.yml                   # local PostgreSQL 16
└── .env.example
```

---

## 6. Getting started

### Prerequisites
- **Node.js 20+** (22 recommended) and npm 10+
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
| `CLIENT_ORIGIN` | ✅ prod | `https://app.example.com` | Allowed browser origin(s) for CORS, comma-separated |
| `COOKIE_SAMESITE` | – | `lax` \| `strict` \| `none` | Use `none` only for cross-site setups (needs HTTPS) |
| `COOKIE_DOMAIN` | – | `.example.com` | Share the cookie between `app.` and `api.` subdomains |

Frontend build-time variables (`apps/web/.env.production`):

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Public API origin, e.g. `https://api.example.com`. **Leave empty in development** |
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

> ⚠️ **Required after pulling the password-reset update.** `schema.prisma` gained four columns on `User`
> (`verificationAttempts`, `resetCode`, `resetExpiresAt`, `resetAttempts`). Create and commit the migration:
>
> ```bash
> npm run db:migrate -- --name add_password_reset_and_code_attempts
> git add apps/server/prisma/migrations && git commit -m "db: password reset + OTP attempt limits"
> ```
> All new columns are nullable or have defaults, so existing rows migrate without data loss.

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
| GET | `/auth/me` | cookie | – | `200 { user }` |
| POST | `/auth/forgot-password` | – | `{ email }` | `200 { message }` (always) |
| POST | `/auth/reset-password` | – | `{ email, code, newPassword }` | `200 { message }` |

`/auth/resend` is kept as a legacy alias of `/auth/resend-code`.

**`user` object** (the only user shape the browser ever receives):
```json
{ "id": "…", "fullName": "Ada Lovelace", "email": "ada@example.com", "isVerified": true,
  "currentWorkspaceId": "…", "currentWorkspaceName": "Ada Lovelace's Workspace" }
```

**Status codes worth handling**

| Code | Where | Meaning |
|---|---|---|
| `400` | any | Validation failed (`error` has the first problem) |
| `401` | `/login`, protected routes | Wrong credentials / missing or expired session |
| `403` | `/login` | Correct password but **email not verified** → body has `needsVerification: true`, `userId`, `email` |
| `409` | `/register` | Email already registered |
| `429` | `/verify`, `/resend-code`, `/reset-password` | Too many wrong codes, or resend cooldown (`retryAfter` seconds) |

### Designs (session required)

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/designs` | – | `200 Design[]` (newest first) |
| POST | `/designs` | `{ id?, workspaceId, title, viewMode, theme, graphData }` | `201`/`200 Design` (creates, or updates when `id` exists) |
| DELETE | `/designs/:id` | – | `200 { success }` |

All three return **`403`** unless the caller is a member of the design's workspace.

### Misc
`GET /api/health` → `{ "status": "ok" }`

### Example

```bash
curl -i -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse battery"}' \
  http://localhost:5000/api/auth/login

curl -b jar.txt http://localhost:5000/api/auth/me
```

---

## 10. Authentication & security model

| Concern | Implementation |
|---|---|
| Password storage | **argon2** hashes; passwords 8–128 chars |
| Session | JWT (7 days) in an **HTTP-only** cookie (`token`); JavaScript cannot read it, so XSS cannot steal it. `Secure` in production; `SameSite` configurable |
| What the browser stores | A **non-sensitive profile cache** in `localStorage` (name, email, workspace) — never the token. It is re-validated with `GET /auth/me` on every load |
| Email verification | 6-digit code from `crypto.randomInt`, 10-minute lifetime, compared in constant time |
| No verification bypass | `/register` does **not** set a session; only `/login` does, and only for verified accounts |
| Brute-force limits | 5 wrong codes burn the code (verification and reset); 30-second resend cooldown |
| Password reset | 6-digit code, 15-minute lifetime, single use; a successful reset also marks the email verified (the code only reached that inbox) |
| Account enumeration | `/forgot-password` and `/resend-code` answer identically for unknown emails; login uses one generic error |
| Authorization | `requireAuth` on all design routes **plus** a workspace-membership check on every read/write/delete |
| Input validation | `zod` schemas on every auth endpoint |
| CORS | Only origins listed in `CLIENT_ORIGIN`, with credentials |
| Secrets | `JWT_SECRET` ≥ 32 chars is enforced at boot in production |
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
| `hooks/useAuth.tsx` | Session context: cached profile + `/auth/me` validation, global 401 handling, `logout()` |
| `hooks/useProjectHistory.ts` | Undo/redo stack with debounced snapshots |
| `api/client.ts` | Typed `fetch` wrapper: `credentials: 'include'`, `ApiError`, 401 event |
| `pages/AuthScreens.tsx` | Sign in · sign up · verify code · forgot password · reset password |
| `views/*` | SVG canvases: pan/zoom, drag, snap, click-to-connect, edit modals |
| `utils/IconLibrary.ts`, `components/IconPicker.tsx` | Icon search (Isopacks first, Iconify fallback) |
| `utils/storage.ts` | Autosave, JSON export/import, URL-hash sharing, PNG/SVG export |

### Auth gating
`App.tsx` renders: a loading screen while the first session check runs → `AuthScreens` when there is no user (unless
the visitor chose *Continue without an account*) → the studio, with the workspace name in the header.

### Auth screens state machine
`login ⇄ signup → verify → (signed in)` and `login → forgot → reset → login`. A login that returns
`403 needsVerification` jumps straight to `verify` with a prompt and a Resend button.

---

## 13. Deployment

### Recommended topology
Serve the web app and the API from **one registrable domain** (e.g. `app.example.com` and `api.example.com`) so the
session cookie is first-party:

```text
CLIENT_ORIGIN=https://app.example.com
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=.example.com
NODE_ENV=production
# web build:  VITE_API_BASE_URL=https://api.example.com
```
Hosting them on unrelated domains (e.g. `github.io` + `onrender.com`) requires `COOKIE_SAMESITE=none` and HTTPS, and some
browsers block third-party cookies entirely — avoid it for production.

### API (Render / Railway / Fly.io / VPS)

| Step | Command |
|---|---|
| Install | `npm ci` |
| Build | `npm run db:generate && npm run build:server` |
| Migrate (release step) | `npm run db:deploy` |
| Start | `npm run start --workspace=apps/server` |

Provision a managed PostgreSQL and set `DATABASE_URL` plus the variables in [§7](#7-environment-variables).

### Web (GitHub Pages)
`.github/workflows/deploy.yml` builds `apps/web` and publishes `apps/web/dist`.
In the repo: **Settings → Pages → Source: GitHub Actions**, then **Settings → Secrets and variables → Actions → Variables**
and add `VITE_API_BASE_URL`. (Any static host — Netlify, Cloudflare Pages, Vercel — works the same way: build command
`npm run build:web`, output `apps/web/dist`.)

### Production checklist
- [ ] `JWT_SECRET` is random and ≥ 32 chars; `NODE_ENV=production`
- [ ] `npm run db:deploy` has been run against the production database
- [ ] `CLIENT_ORIGIN` matches the web origin exactly (scheme + host, no trailing slash)
- [ ] HTTPS everywhere (required for `Secure` cookies)
- [ ] `GMAIL_USER` / `GMAIL_APP_PASSWORD` set; boot log shows `SMTP ready`
- [ ] Delivery tested to Gmail, Outlook and Yahoo (see [§11](#delivery-testing-do-this-before-launch))
- [ ] Database backups enabled

---

## 14. Testing

The authentication and authorization logic was verified end-to-end against the real Express app with an in-memory
database stand-in, and the UI flows with a headless browser against a mocked API:

| Area | Verified behaviours |
|---|---|
| Registration | validation errors; duplicate email → 409; **no session cookie before verification**; user + workspace created together |
| Verification | wrong codes → 400 ×4 then 429 lockout; correct code **after** lockout refused; resend cooldown 429 with `retryAfter`; fresh code works |
| Sign-in | unverified → 403 `needsVerification`; wrong password → 401; success sets an HTTP-only cookie; response contains no hash/code |
| Session | `/auth/me` with/without cookie; logout clears cookie; design routes → 401 without session |
| Password reset | identical response for known/unknown email; wrong code; weak password; success; old password rejected; code is single-use |
| Authorization | non-members get 403 on list/create/update/delete; members succeed |
| UI | forgot → reset → success banner; unverified login → code screen + Resend; login lands in the studio on the user's workspace; **refresh keeps the session**; sign-out; expired cookie clears the cache |

**Manual smoke test** after any deploy: sign up with a fresh address → receive email → verify → refresh → sign out →
*Forgot password* → reset → sign in with the new password.

Planned: automated Vitest (unit) + Playwright (E2E) suites in CI.

---

## 15. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `[email] SMTP error … EAUTH` | Wrong Gmail credentials. Use a 16-char **App Password**; 2-Step Verification must be on |
| `GMAIL_USER / GMAIL_APP_PASSWORD not set` | `.env` is not in `apps/server/` or the server was not restarted |
| Code only appears in the server console | SMTP not configured (dev fallback). Never happens in production logs |
| Email in spam | Verify SPF/DKIM/DMARC pass (see §11); consider a custom domain + transactional provider |
| `404` on `/api/...` in the browser | Vite proxy not running — start via `npm run dev`; port must be 5174 |
| CORS error / cookie not stored in production | `CLIENT_ORIGIN` mismatch, missing HTTPS, or cross-site cookies needing `COOKIE_SAMESITE=none` |
| Signed out immediately after login | Cookie blocked (cross-site / non-HTTPS). Check the `Set-Cookie` response in dev tools |
| `JWT_SECRET must be set…` at boot | Set a ≥ 32-char `JWT_SECRET` (enforced in production) |
| `Property 'resetCode' does not exist` (TypeScript) | Run `npm run db:generate` after pulling the schema change |
| Prisma `P3009` / drift on migrate | Do not edit applied migrations. Locally: `npx prisma migrate reset` (destroys local data) |
| Blank page / React `ReactCurrentOwner` error | React must stay on 18.x (`react@18.3.1`); Isoflow is not compatible with React 19 |
| `docker compose up` port 5432 in use | Another Postgres is running; stop it or change the published port and `DATABASE_URL` |

---

## 16. Scripts reference

| Script (run from repo root) | Action |
|---|---|
| `npm run dev` | API (`tsx watch`) + web (Vite) together |
| `npm run dev:server` / `dev:web` | Run one side only |
| `npm run build:web` / `build:server` / `build:shared` | Production builds |
| `npm run docker:up` | Start local PostgreSQL |
| `npm run db:migrate` / `db:deploy` / `db:generate` / `db:studio` | Prisma workflows (see §8) |
| `npm run lint` | ESLint in every workspace |

---

## 17. Roadmap & known limitations

**Known limitations (honest list)**
- **Designs are not yet wired to the UI.** The API (`/api/designs`) is complete and authorized, but the studio's gallery
  still persists to `localStorage`; "collaborators" in the gallery are local-only mock data.
- **JWTs are stateless**: after a password reset, other already-issued sessions stay valid until they expire (7 days).
  A `tokenVersion` column checked in `requireAuth` would allow instant revocation.
- No per-IP rate limiting on auth endpoints (per-account limits exist). Add `express-rate-limit` behind a trusted proxy.
- Gmail SMTP is rate-limited; move to a domain + transactional provider for volume.
- The 3D view is generated from the 2D data and is read-only.
- Automated test suites are not in CI yet.

**Next up**
1. Connect the design gallery to `apiGetDesigns` / `apiSaveDesign` / `apiDeleteDesign` using `user.currentWorkspaceId`.
2. Real collaboration: invite-by-email → `WorkspaceMember` rows with roles.
3. Text/DSL import (`esp1 -> broker: MQTT`) → nodes and connectors.
4. Auto-layout button as an escape hatch, alignment guides, starter templates.
5. Per-node icons in the 3D view; publishable `ArchitectureStudio` React component.

---

## 18. Contributing

1. Fork and branch: `git checkout -b feat/short-description`
2. Keep TypeScript strict-clean: `npx tsc --noEmit -p apps/web/tsconfig.app.json` and `npx tsc --noEmit -p apps/server/tsconfig.json`
3. Schema changes **must** ship with a committed migration (`npm run db:migrate -- --name what_changed`)
4. Never commit `.env` files or real credentials
5. Open a pull request describing the change and how you tested it

---

<div align="center">Built with React, Express, Prisma and Isoflow.</div>
