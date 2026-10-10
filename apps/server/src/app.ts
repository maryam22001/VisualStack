import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as authCtrl from './controllers/auth.controllers';
import * as designCtrl from './controllers/design.controller';
import { requireAuth } from './middleware/requireAuth';

export const app = express();

// CLIENT_ORIGIN may be a comma-separated list, e.g. "https://app.example.com,http://localhost:5174"
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ---- Auth ----
app.post('/api/auth/register', authCtrl.register);
app.post('/api/auth/verify', authCtrl.verifyOtp);
app.post('/api/auth/resend-code', authCtrl.resendCode);
app.post('/api/auth/resend', authCtrl.resendCode); // legacy alias
app.post('/api/auth/login', authCtrl.login);
app.post('/api/auth/logout', authCtrl.logout);
app.get('/api/auth/me', requireAuth, authCtrl.me);
app.post('/api/auth/forgot-password', authCtrl.forgotPassword);
app.post('/api/auth/reset-password', authCtrl.resetPassword);

// ---- Design persistence (session required) ----
app.get('/api/workspaces/:workspaceId/designs', requireAuth, designCtrl.getWorkspaceDesigns);
app.post('/api/designs', requireAuth, designCtrl.saveDesign);
app.delete('/api/designs/:id', requireAuth, designCtrl.deleteDesign);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/', (_req, res) => {
    res.send('VisualStack API is up and running!');
});
