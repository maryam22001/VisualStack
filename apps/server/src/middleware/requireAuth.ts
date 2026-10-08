import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ error: 'Not signed in.' });
        const { userId } = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_jwt_key_99999') as { userId: string };
        (req as any).userId = userId;
        next();
    } catch {
        res.status(401).json({ error: 'Session expired.' });
    }
}