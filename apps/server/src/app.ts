import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import * as authCtrl from './controllers/auth.controllers';
import * as designCtrl from './controllers/design.controller';
import * as workspaceCtrl from './controllers/workspace.controller';
import { requireAuth } from './middleware/requireAuth';
import { prisma } from './services/db.service';

export const app = express();

const isProd = process.env.NODE_ENV === 'production';

// Behind Render / Railway / Fly the real client IP and protocol arrive via X-Forwarded-* headers.
if (isProd) app.set('trust proxy', 1);
app.disable('x-powered-by');

// Baseline security headers (no extra dependency).
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
});

// CLIENT_ORIGIN may be a comma-separated list, e.g. "https://app.example.com,http://localhost:5174".
// Not needed when the API serves the web app itself (same origin).
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ---- Health (used by hosting platforms and by `npm run smoke`) ----
app.get('/api/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', db: 'up', uptime: Math.round(process.uptime()) });
    } catch {
        res.status(503).json({ status: 'degraded', db: 'down' });
    }
});

// ---- Auth ----
app.post('/api/auth/register', authCtrl.register);
app.post('/api/auth/verify', authCtrl.verifyOtp);
app.post('/api/auth/resend-code', authCtrl.resendCode);
app.post('/api/auth/resend', authCtrl.resendCode); // legacy alias
app.post('/api/auth/login', authCtrl.login);
app.post('/api/auth/logout', authCtrl.logout);
app.post('/api/auth/logout-all', requireAuth, authCtrl.logoutAll);
app.get('/api/auth/me', requireAuth, authCtrl.me);
app.post('/api/auth/forgot-password', authCtrl.forgotPassword);
app.post('/api/auth/reset-password', authCtrl.resetPassword);

// ---- Workspaces & members (session required; roles enforced in the controllers) ----
app.get('/api/workspaces', requireAuth, workspaceCtrl.listMyWorkspaces);
app.get('/api/workspaces/:workspaceId/members', requireAuth, workspaceCtrl.listMembers);
app.post('/api/workspaces/:workspaceId/members', requireAuth, workspaceCtrl.addMember);
app.patch('/api/workspaces/:workspaceId/members/:userId', requireAuth, workspaceCtrl.updateMemberRole);
app.delete('/api/workspaces/:workspaceId/members/:userId', requireAuth, workspaceCtrl.removeMember);

// ---- Designs ----
app.get('/api/workspaces/:workspaceId/designs', requireAuth, designCtrl.getWorkspaceDesigns);
app.post('/api/designs', requireAuth, designCtrl.saveDesign);
app.delete('/api/designs/:id', requireAuth, designCtrl.deleteDesign);

// Unknown API routes answer with JSON (never with the web app's index.html).
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// ---- Optionally serve the built web app (single-origin deployment) ----
// One service = one origin: no CORS, first-party cookies, nothing else to host.
//   SERVE_WEB=true|false  force on/off   (default: on in production when apps/web/dist exists)
//   WEB_DIST_DIR          override the folder (default: apps/web/dist)
const webDist = process.env.WEB_DIST_DIR
    ? path.resolve(process.env.WEB_DIST_DIR)
    : path.resolve(__dirname, '../../web/dist');
const hasBuild = fs.existsSync(path.join(webDist, 'index.html'));
const serveWeb = process.env.SERVE_WEB ? process.env.SERVE_WEB === 'true' : isProd && hasBuild;

if (serveWeb && hasBuild) {
    app.use(
        express.static(webDist, {
            index: false,
            setHeaders: (res, filePath) => {
                // Vite fingerprints everything under /assets, so it can be cached "forever".
                if (filePath.includes(`${path.sep}assets${path.sep}`)) {
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                } else if (filePath.endsWith('.html')) {
                    res.setHeader('Cache-Control', 'no-cache');
                }
            }
        })
    );
    // SPA fallback for every non-API GET.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(webDist, 'index.html'));
    });
} else {
    app.get('/', (_req, res) => {
        res.send('VisualStack API is up and running!');
    });
}

// ---- Error handler (malformed JSON, unexpected throws) ----
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    console.error('[server] unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
});
