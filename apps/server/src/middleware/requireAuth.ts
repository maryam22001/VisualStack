import type { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME, verifySession } from '../services/token.service';

declare module 'express-serve-static-core' {
    interface Request {
        /** Set by requireAuth when the session cookie is valid. */
        userId?: string;
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Not signed in.' });

    try {
        req.userId = verifySession(token).userId;
        next();
    } catch {
        res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
}
