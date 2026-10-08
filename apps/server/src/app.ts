import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as authCtrl from './controllers/auth.controllers';
import * as designCtrl from './controllers/design.controller';

export const app = express();

app.use(cors({ origin: 'http://localhost:5174', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Auth routes
app.post('/api/auth/register', authCtrl.register);
app.post('/api/auth/verify', authCtrl.verifyOtp);
app.post('/api/auth/resend', authCtrl.resendCode);
app.post('/api/auth/login', authCtrl.login);
app.post('/api/auth/forgot-password', authCtrl.forgotPassword);
app.post('/api/auth/reset-password', authCtrl.resetPassword);
// Design persistence routes
app.get('/api/workspaces/:workspaceId/designs', designCtrl.getWorkspaceDesigns);
app.post('/api/designs', designCtrl.saveDesign);
app.delete('/api/designs/:id', designCtrl.deleteDesign);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => {
    res.send('VisualStack API is up and running!');
});