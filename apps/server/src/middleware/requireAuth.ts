import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/db.service';
import { COOKIE_NAME, verifySession } from '../services/token.service';

declare module 'express-serve-static-core' {
    interface Request {
        /** Set by requireAuth when the session cookie is valid. */
        userId?: string;
    }
}

/**
 * 1. the cookie must hold a valid, unexpired JWT, and
 * 2. its tokenVersion must still match the database (so password resets and
 *    "sign out everywhere" revoke old sessions immediately), and
 * 3. the account must still exist and be verified.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    // Cross-site frontends (e.g. GitHub Pages -> vercel.app) often have the cookie blocked as
    // third-party, so the same signed JWT is also accepted as a Bearer token.
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const token = req.cookies?.[COOKIE_NAME] || bearer;
    if (!token) return res.status(401).json({ error: 'Not signed in.' });

    let claims: { userId: string; tokenVersion: number };
    try {
        claims = verifySession(token);
    } catch {
        return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: claims.userId },
            select: { tokenVersion: true, isVerified: true }
        });
        if (!user || !user.isVerified || user.tokenVersion !== claims.tokenVersion) {
            return res.status(401).json({ error: 'Session expired. Please sign in again.' });
        }
        req.userId = claims.userId;
        next();
    } catch (error) {
        console.error('[auth] session lookup failed:', error);
        res.status(500).json({ error: 'Could not verify your session.' });
    }
}
