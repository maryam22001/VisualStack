import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';

/**
 * Session tokens.
 *
 * The JWT lives ONLY in an HTTP-only cookie. JavaScript on the page can never read it,
 * so an XSS bug cannot steal the session. The frontend keeps just a non-sensitive
 * profile cache (name, email, workspace) in localStorage for fast first paint.
 */

export const COOKIE_NAME = 'token';
const SESSION_TTL_DAYS = 7;

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me-before-deploying';
let warnedAboutDevSecret = false;

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.length >= 32) return secret;

    if (process.env.NODE_ENV === 'production') {
        // Refuse to boot with a guessable secret in production.
        throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
    }
    if (!warnedAboutDevSecret) {
        console.warn('[auth] JWT_SECRET is missing or shorter than 32 chars - using an insecure dev secret.');
        warnedAboutDevSecret = true;
    }
    return DEV_FALLBACK_SECRET;
}

export function sessionCookieOptions(): CookieOptions {
    const requested = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
    const sameSite = (['lax', 'strict', 'none'].includes(requested) ? requested : 'lax') as 'lax' | 'strict' | 'none';
    const isProd = process.env.NODE_ENV === 'production';

    return {
        httpOnly: true,
        sameSite,
        // Browsers reject SameSite=None cookies that are not Secure.
        secure: isProd || sameSite === 'none',
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: '/',
        maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    };
}

// clearCookie only works when every attribute except maxAge matches the original.
export function clearCookieOptions(): CookieOptions {
    const { maxAge: _maxAge, ...rest } = sessionCookieOptions();
    return rest;
}

export function signSession(userId: string): string {
    return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' });
}

export function verifySession(token: string): { userId: string } {
    return jwt.verify(token, getJwtSecret()) as { userId: string };
}
