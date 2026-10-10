import type { Request, Response } from 'express';
import { randomInt, randomUUID, timingSafeEqual } from 'crypto';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../services/db.service';
import { sendOtpEmail, sendPasswordResetEmail } from '../services/email.service';
import { COOKIE_NAME, signSession, sessionCookieOptions, clearCookieOptions } from '../services/token.service';

// ---------- Tunables ----------
const VERIFY_TTL_MS = 10 * 60 * 1000; // verification code lifetime
const RESET_TTL_MS = 15 * 60 * 1000; // password-reset code lifetime
const RESEND_COOLDOWN_MS = 30 * 1000; // minimum gap between two emails to the same user
const MAX_CODE_ATTEMPTS = 5; // wrong guesses allowed before the code is burned

// ---------- Validation ----------
const emailSchema = z.string().trim().toLowerCase().email('Please enter a valid email address.');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.');
const codeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.');

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.').max(80, 'Name is too long.'),
  email: emailSchema,
  password: passwordSchema
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
const verifySchema = z.object({ userId: z.string().min(1), code: codeSchema });
const emailOnlySchema = z.object({ email: emailSchema });
const resetSchema = z.object({ email: emailSchema, code: codeSchema, newPassword: passwordSchema });

const firstIssue = (err: z.ZodError) => err.issues[0]?.message || 'Invalid request.';

// ---------- Helpers ----------
const newCode = () => randomInt(100000, 1000000).toString();

function codesMatch(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

/** Seconds the caller must still wait, derived from when the active code was issued. */
function cooldownRemainingMs(expiresAt: Date | null | undefined, ttlMs: number): number {
  if (!expiresAt) return 0;
  const issuedAt = expiresAt.getTime() - ttlMs;
  return Math.max(0, RESEND_COOLDOWN_MS - (Date.now() - issuedAt));
}

/** The only user shape the browser ever sees. Never includes hashes or codes. */
function toSession(user: any) {
  const workspace = user.ownedWorkspaces?.[0] ?? user.memberships?.[0]?.workspace;
  return {
    id: user.id as string,
    fullName: user.fullName as string,
    email: user.email as string,
    isVerified: user.isVerified as boolean,
    currentWorkspaceId: workspace?.id as string | undefined,
    currentWorkspaceName: workspace?.name as string | undefined
  };
}

const WITH_WORKSPACES = {
  ownedWorkspaces: true,
  memberships: { include: { workspace: true } }
} as const;

// =====================================================================
// POST /api/auth/register
// =====================================================================
export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
    const { fullName, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
    }

    const id = randomUUID();
    const passwordHash = await argon2.hash(password);
    const verificationCode = newCode();

    // User + personal workspace are created atomically (one DB transaction).
    await prisma.$transaction([
      prisma.user.create({
        data: {
          id,
          fullName,
          email,
          passwordHash,
          verificationCode,
          verificationExpiresAt: new Date(Date.now() + VERIFY_TTL_MS)
        }
      }),
      prisma.workspace.create({
        data: {
          name: `${fullName}'s Workspace`,
          ownerId: id,
          members: { create: { userId: id, role: 'owner' } }
        }
      })
    ]);

    const emailSent = await sendOtpEmail(email, fullName, verificationCode);

    // No session cookie here on purpose: an account only gets a session AFTER its email
    // is verified (see verifyOtp -> login). Issuing it now would let anyone skip verification.
    return res.status(201).json({
      user: { id, fullName, email, isVerified: false },
      emailSent
    });
  } catch (error) {
    console.error('[auth] register error:', error);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

// =====================================================================
// POST /api/auth/verify        { userId, code }
// =====================================================================
export async function verifyOtp(req: Request, res: Response) {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
    const { userId, code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.isVerified) return res.json({ success: true, isVerified: true });

    if (!user.verificationCode || !user.verificationExpiresAt) {
      return res.status(400).json({ error: 'There is no active code. Request a new one.' });
    }
    if (new Date() > user.verificationExpiresAt) {
      return res.status(400).json({ error: 'That code has expired. Request a new one.' });
    }
    if (user.verificationAttempts >= MAX_CODE_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }

    if (!codesMatch(user.verificationCode, code)) {
      const attempts = user.verificationAttempts + 1;
      const locked = attempts >= MAX_CODE_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationAttempts: attempts,
          // Burn the code once the guess budget is spent.
          ...(locked ? { verificationCode: null, verificationExpiresAt: null } : {})
        }
      });
      return res.status(locked ? 429 : 400).json({
        error: locked
          ? 'Too many incorrect attempts. Request a new code.'
          : 'That code is incorrect. Please try again.'
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationCode: null, verificationExpiresAt: null, verificationAttempts: 0 }
    });
    return res.json({ success: true, isVerified: true });
  } catch (error) {
    console.error('[auth] verify error:', error);
    return res.status(500).json({ error: 'Verification failed.' });
  }
}

// =====================================================================
// POST /api/auth/resend-code   { email }     (alias: /api/auth/resend)
// =====================================================================
export async function resendCode(req: Request, res: Response) {
  try {
    const parsed = emailOnlySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Same answer for unknown or already-verified emails, so this endpoint can't be
    // used to discover which addresses have accounts.
    if (!user || user.isVerified) return res.json({ success: true, emailSent: true });

    const waitMs = cooldownRemainingMs(user.verificationExpiresAt, VERIFY_TTL_MS);
    if (waitMs > 0) {
      const retryAfter = Math.ceil(waitMs / 1000);
      return res.status(429).json({ error: `Please wait ${retryAfter}s before requesting another code.`, retryAfter });
    }

    const verificationCode = newCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode,
        verificationExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        verificationAttempts: 0
      }
    });

    const emailSent = await sendOtpEmail(user.email, user.fullName, verificationCode);
    return res.json({ success: true, emailSent });
  } catch (error) {
    console.error('[auth] resend error:', error);
    return res.status(500).json({ error: 'Could not resend the code.' });
  }
}

// =====================================================================
// POST /api/auth/login         { email, password }
// =====================================================================
export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Email and password are required.' });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, include: WITH_WORKSPACES });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    // Correct password but the email was never confirmed: no session, send them to the code screen.
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email to continue.',
        needsVerification: true,
        userId: user.id,
        email: user.email
      });
    }

    res.cookie(COOKIE_NAME, signSession(user.id), sessionCookieOptions());
    return res.json({ user: toSession(user) });
  } catch (error) {
    console.error('[auth] login error:', error);
    return res.status(500).json({ error: 'Login failed.' });
  }
}

// =====================================================================
// POST /api/auth/logout
// =====================================================================
export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, clearCookieOptions());
  return res.json({ success: true });
}

// =====================================================================
// GET /api/auth/me            (requires a valid session cookie)
// =====================================================================
export async function me(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, include: WITH_WORKSPACES });
    if (!user || !user.isVerified) {
      res.clearCookie(COOKIE_NAME, clearCookieOptions());
      return res.status(401).json({ error: 'Session is no longer valid.' });
    }
    return res.json({ user: toSession(user) });
  } catch (error) {
    console.error('[auth] me error:', error);
    return res.status(500).json({ error: 'Could not load your session.' });
  }
}

// =====================================================================
// POST /api/auth/forgot-password   { email }
// =====================================================================
export async function forgotPassword(req: Request, res: Response) {
  // Identical response whether or not the account exists (no account enumeration).
  const generic = { message: 'If an account exists for that email, a reset code is on its way.' };

  try {
    const parsed = emailOnlySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json(generic);

    // Silently skip if a code was issued moments ago (stops inbox flooding).
    if (cooldownRemainingMs(user.resetExpiresAt, RESET_TTL_MS) > 0) return res.json(generic);

    const resetCode = newCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { resetCode, resetExpiresAt: new Date(Date.now() + RESET_TTL_MS), resetAttempts: 0 }
    });

    await sendPasswordResetEmail(user.email, user.fullName, resetCode);
    return res.json(generic);
  } catch (error) {
    console.error('[auth] forgot-password error:', error);
    return res.status(500).json({ error: 'Could not start the password reset.' });
  }
}

// =====================================================================
// POST /api/auth/reset-password    { email, code, newPassword }
// =====================================================================
export async function resetPassword(req: Request, res: Response) {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
    const { email, code, newPassword } = parsed.data;

    const invalid = () => res.status(400).json({ error: 'Invalid or expired reset code.' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetCode || !user.resetExpiresAt || new Date() > user.resetExpiresAt) return invalid();

    if (user.resetAttempts >= MAX_CODE_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }

    if (!codesMatch(user.resetCode, code)) {
      const attempts = user.resetAttempts + 1;
      const locked = attempts >= MAX_CODE_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetAttempts: attempts,
          ...(locked ? { resetCode: null, resetExpiresAt: null } : {})
        }
      });
      return locked
        ? res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' })
        : invalid();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(newPassword),
        resetCode: null,
        resetExpiresAt: null,
        resetAttempts: 0,
        // The code only ever reached this inbox, so a successful reset also proves ownership of the email.
        isVerified: true,
        verificationCode: null,
        verificationExpiresAt: null,
        verificationAttempts: 0
      }
    });

    return res.json({ message: 'Password updated. You can now sign in.' });
  } catch (error) {
    console.error('[auth] reset-password error:', error);
    return res.status(500).json({ error: 'Could not reset the password.' });
  }
}
