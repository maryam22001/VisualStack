# Deploying VisualStack

This guide takes you from "works on my laptop" to "real users can sign up". Read §1 first, then follow **one** path.

| Path | Best for | Hosting you need |
|---|---|---|
| **A. One service (recommended)** | Almost everyone | 1 web service + 1 PostgreSQL |
| **B. Docker on any host** | Fly.io, Railway, a VPS | a container host + PostgreSQL |
| **C. Split hosting** | You already have a static host / CDN | static host + API host + PostgreSQL, **same parent domain** |

---

## 1. How the app is deployed

The API can **serve the built web app itself**. One process, one URL, one origin:

```text
https://app.example.com
   ├── /            → the React app (apps/web/dist)
   ├── /assets/*    → fingerprinted JS/CSS (cached for a year)
   └── /api/*       → the Express API  ──►  PostgreSQL
```

Why this is the default: the session cookie is first-party (nothing to configure), there is no CORS, and there is only
one thing to deploy and monitor. It is switched on automatically when `NODE_ENV=production` and `apps/web/dist` exists
(or force it with `SERVE_WEB=true`).

---

## 2. Before you deploy (once)

Run these on your machine. If any fails, fix it **before** deploying.

```bash
# 1. Everything green locally
npm run check            # prisma generate + validate, typecheck, lint, tests, production build

# 2. The database migrations are committed (see README §8 if you have not created them yet)
git status apps/server/prisma/migrations     # should be clean

# 3. A Gmail App Password exists (README §11) - you will paste it into the host as a secret
# 4. The code is pushed to GitHub
git push
```

Generate a session secret (you need it in step 3 of any path):

```bash
openssl rand -base64 48
```

---

## 3. Path A — Render, one service (recommended)

The repo contains `render.yaml` (a Render *Blueprint*): one web service + one PostgreSQL database.

1. Sign in at <https://render.com> and connect your GitHub account.
2. **New → Blueprint** → choose the `VisualStack` repository → *Apply*.
3. When prompted, fill the secrets marked `sync: false`:
   | Variable | Value |
   |---|---|
   | `GMAIL_USER` | the sender Gmail address |
   | `GMAIL_APP_PASSWORD` | the 16-character App Password |
   `DATABASE_URL` is wired to the database automatically and `JWT_SECRET` is generated for you.
4. Wait for the first deploy. The build runs `npm ci --include=dev`, generates the Prisma client and builds web + API. The
   start command applies migrations (`prisma migrate deploy`) and boots the server.
5. Open the service URL (`https://visualstack-xxxx.onrender.com`) → you should see the sign-in screen.
6. **Verify the deployment:**
   ```bash
   API_URL=https://visualstack-xxxx.onrender.com WEB=1 npm run smoke
   ```
   It must end with `ALL CHECKS PASSED`.
7. Open **Logs** and look for `[email] SMTP ready - sending as you@gmail.com`.
8. **Real sign-up test** (see §7).

### Custom domain (recommended before real users)
Service → **Settings → Custom Domains** → add `app.yourdomain.com` → create the DNS record Render shows. HTTPS is issued
automatically. Nothing else changes (same origin).

### Free plan caveats (check Render's current pricing page)
- A free web service **sleeps when idle** (first request after a pause is slow).
- A free PostgreSQL database **expires after 30 days**. Before real users, upgrade both in `render.yaml`
  (`plan: starter` for the service, `plan: basic-256mb` or higher for the database) and re-apply the Blueprint.

---

## 4. Path B — Docker on any host

The `Dockerfile` builds one image that contains the API and the web app.

```bash
docker build -t visualstack .

docker run -d --name visualstack -p 5000:5000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://USER:PASS@HOST:5432/visualstack?schema=public" \
  -e JWT_SECRET="<openssl rand -base64 48>" \
  -e GMAIL_USER="you@gmail.com" \
  -e GMAIL_APP_PASSWORD="xxxxxxxxxxxxxxxx" \
  visualstack
```

The container applies pending migrations on start, then serves everything on port **5000**. Put it behind HTTPS
(Fly.io and Railway do this for you; on a VPS use Caddy or nginx with Let's Encrypt, forwarding `X-Forwarded-Proto`).

Use a managed PostgreSQL (Neon, Supabase, Railway, Fly Postgres, RDS, …) and paste its connection string as `DATABASE_URL`.
If the provider requires TLS, append `&sslmode=require` to the URL.

Verify: `API_URL=https://your-host WEB=1 npm run smoke`.

---

## 5. Path C — Split hosting (static host + separate API)

Only choose this if you must. **Cookies are the catch**: the session cookie is HTTP-only, so the browser only sends it
when the web app and the API are the *same site*.

- ✅ Works: `app.example.com` (web) + `api.example.com` (API) — same registrable domain.
- ⚠️ Fragile: `you.github.io` + `you.onrender.com` — different sites. It needs `COOKIE_SAMESITE=none`, and browsers
  that block third-party cookies will break sign-in. Do not use this for production.

**API (`api.example.com`)**
```text
NODE_ENV=production
CLIENT_ORIGIN=https://app.example.com
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=.example.com
SERVE_WEB=false
DATABASE_URL=...   JWT_SECRET=...   GMAIL_USER=...   GMAIL_APP_PASSWORD=...
```

**Web (`app.example.com`)** — build with the API address baked in:
```bash
VITE_API_BASE_URL=https://api.example.com npm run build:web     # publish apps/web/dist
```
For GitHub Pages the included workflow `.github/workflows/deploy.yml` does this: add the repository **variable**
`VITE_API_BASE_URL` (Settings → Secrets and variables → Actions → Variables), set **Pages → Source: GitHub Actions**,
and point your custom domain at Pages.

Verify: `API_URL=https://api.example.com ORIGIN=https://app.example.com npm run smoke`.

---

## 6. Environment variables (production)

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | ✅ | `production` (Secure cookies, HSTS, no dev code logging) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | ≥ 32 random chars; the server **refuses to start** without it |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | ✅ | verification + reset emails |
| `PORT` | – | hosts usually inject this; default 5000 |
| `SERVE_WEB` | – | `true` = API serves the web app (default in production when the build exists) |
| `CLIENT_ORIGIN` | split only | the web origin, exactly (`https://app.example.com`, no trailing slash) |
| `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | split only | see §5 |
| `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | – | cosmetic |

---

## 7. Verify the live system

### Automated (30 seconds)
```bash
API_URL=https://app.example.com WEB=1 npm run smoke
```
Checks: health + database up, anonymous requests rejected (401), no cookie on failed login, no account enumeration,
JSON 404s, security headers, and the web app + client-side routes served.

### Manual (10 minutes, do it once per launch)
1. **Sign up** with a Gmail address → email arrives → code works → you land in your workspace.
2. Repeat with an **Outlook/Hotmail**, a **Yahoo** and an **iCloud** address. For each: inbox or spam? subject shows the code?
3. In Gmail: ⋮ → **Show original** → `SPF`, `DKIM`, `DMARC` should say **PASS**. Optional: send to the address from
   <https://www.mail-tester.com> (aim for 9/10+).
4. **Refresh** the page → still signed in. **Sign out** → refresh → signed out.
5. **Forgot password** → code arrives → reset → old password rejected, new one works.
6. Sign in on two browsers → reset the password in one → the **other is signed out** on its next request.
7. **Save** a design → reload → it is still there (stored in PostgreSQL, not the browser).
8. With two accounts: owner adds the second under **Team & Account** → the second sees the shared workspace in the
   picker; as *View only* the Save button is disabled.

---

## 8. Operating it

| Task | How |
|---|---|
| **Deploy an update** | `git push`. Render/Docker rebuild and the start command runs `prisma migrate deploy`. CI (`.github/workflows/ci.yml`) must be green first. |
| **Change the data model** | Edit `schema.prisma` → `npm run db:migrate -- --name what_changed` → commit the migration. CI fails if you forget. |
| **Roll back** | Redeploy the previous commit. Migrations are forward-only: make schema changes backward-compatible (add columns/tables first, remove in a later release). |
| **Backups** | Enable your PostgreSQL provider's automated backups and test a restore once. |
| **Rotate `JWT_SECRET`** | Change it and redeploy: everyone is signed out (they can sign in again). |
| **Revoke one user's sessions** | They use *Team & Account → Sign out of all devices*, or reset their password. |
| **Rotate the Gmail App Password** | Create a new one at myaccount.google.com/apppasswords, update `GMAIL_APP_PASSWORD`, redeploy, revoke the old one. |
| **Logs** | Look for `[email] SMTP ready`, `[auth] … error`, `[server] unhandled error`. Verification codes are never logged in production. |
| **Scaling** | One instance is fine to start. Sessions and rate limits live in PostgreSQL / per account, so you can run several instances. Add per-IP rate limiting before heavy public traffic. |

---

## 9. Troubleshooting a deployment

| Symptom | Cause / fix |
|---|---|
| Build fails: `tsc: not found` / `vite: not found` | Dev dependencies were skipped. Build with `npm ci --include=dev` (already set in `render.yaml` and the `Dockerfile`). |
| Boot fails: `JWT_SECRET must be set…` | Add a ≥ 32-character `JWT_SECRET`. |
| Boot fails: `Can't reach database server` | Wrong `DATABASE_URL`, DB not ready, or TLS required (`&sslmode=require`). |
| `P3009` / failed migration | A migration failed half-way. Fix the cause, then `npx prisma migrate resolve --rolled-back <name>` and redeploy. Never edit an applied migration. |
| Sign-in works, but refresh logs you out | Cookie not stored: not HTTPS, or web and API are on different sites (see §5). |
| `GET /` returns "VisualStack API is up…" | The web build is missing or `SERVE_WEB` is off. Make sure the build step ran `npm run build` and `NODE_ENV=production`. |
| Emails not arriving | Logs: `EAUTH` = wrong App Password / 2-Step Verification off. No log line at all = `GMAIL_*` not set. Check spam. |
| 502 / health check failing on first deploy | Cold start + migrations can take a minute; the Docker health check allows 40 s. Check logs for the real error. |

---

## 10. Go-live checklist

- [ ] `npm run check` passes and CI is green on `main`
- [ ] Migrations committed; the deploy log shows them applied
- [ ] `NODE_ENV=production`, strong `JWT_SECRET`, `DATABASE_URL` set as secrets (not in git)
- [ ] Paid database plan with **backups** enabled
- [ ] Custom domain with HTTPS
- [ ] `npm run smoke` passes against the live URL
- [ ] Log shows `[email] SMTP ready`; sign-up emails tested on Gmail, Outlook and Yahoo (inbox, SPF/DKIM/DMARC pass)
- [ ] Manual checks in §7 done (sign-up, refresh, reset, shared workspace)
- [ ] You know where logs are and how to roll back
