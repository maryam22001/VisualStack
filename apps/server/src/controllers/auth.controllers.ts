import { Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db.service';
import { sendOtpEmail, sendPasswordResetEmail } from '../services/email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_jwt_key_99999';

// 1. Request Password Reset OTP
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Prevent account enumeration
      return res.status(200).json({ message: 'If an account exists, a reset code was sent.' });
    }

    // Generate 6-digit code & expiration (15 mins)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        verificationCode: resetCode,
        verificationExpiresAt: resetExpiry,
      },
    });

    const isSent = await sendPasswordResetEmail(user.email, user.fullName || '', resetCode);

    if (!isSent) {
      return res.status(500).json({ error: 'Failed to dispatch reset email.' });
    }

    return res.status(200).json({ message: 'Password reset code sent.' });
  } catch (err: any) {
    console.error('[Auth Controller] Forgot Password Error:', err);
    return res.status(500).json({ error: err.message || 'Server error.' });
  }
};

// 2. Verify Code & Reset Password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (
      !user ||
      !user.verificationCode ||
      user.verificationCode !== code.trim() ||
      !user.verificationExpiresAt ||
      user.verificationExpiresAt < new Date()
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const passwordHash = await argon2.hash(newPassword);

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        passwordHash,
        verificationCode: null,
        verificationExpiresAt: null,
      },
    });

    return res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (err: any) {
    console.error('[Auth Controller] Reset Password Error:', err);
    return res.status(500).json({ error: err.message || 'Server error.' });
  }
};

// 3. User Registration
export async function register(req: Request, res: Response) {
  try {
    const { fullName, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await argon2.hash(password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        fullName,
        email: normalizedEmail,
        passwordHash,
        verificationCode,
        verificationExpiresAt,
      },
    });

    // Create default personal workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: `${fullName || 'My'}'s Workspace`,
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: 'owner' },
        },
      },
    });

    await sendOtpEmail(normalizedEmail, fullName || 'there', verificationCode);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    return res.status(201).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isVerified: user.isVerified,
        currentWorkspaceId: workspace.id,
      },
    });
  } catch (error: any) {
    console.error('[Auth Controller] Register Error:', error);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

// 4. Verify OTP Code
export async function verifyOtp(req: Request, res: Response) {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ error: 'User ID and verification code are required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.verificationCode || user.verificationCode !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (user.verificationExpiresAt && new Date() > user.verificationExpiresAt) {
      return res.status(400).json({ error: 'Verification code expired.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationExpiresAt: null,
      },
    });

    return res.json({ success: true, isVerified: updated.isVerified });
  } catch (error) {
    console.error('[Auth Controller] Verify OTP Error:', error);
    return res.status(500).json({ error: 'Verification failed.' });
  }
}

// 5. User Login
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { ownedWorkspaces: true, memberships: { include: { workspace: true } } },
    });

    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    const activeWorkspaceId = user.ownedWorkspaces[0]?.id || user.memberships[0]?.workspaceId;

    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isVerified: user.isVerified,
        currentWorkspaceId: activeWorkspaceId,
      },
    });
  } catch (error) {
    console.error('[Auth Controller] Login Error:', error);
    return res.status(500).json({ error: 'Login failed.' });
  }
}

// 6. Resend OTP Verification Code
export async function resendCode(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode,
        verificationExpiresAt,
      },
    });

    await sendOtpEmail(normalizedEmail, user.fullName || 'there', verificationCode);

    return res.status(200).json({ message: 'Verification code resent successfully.' });
  } catch (error) {
    console.error('[Auth Controller] Resend Code Error:', error);
    return res.status(500).json({ error: 'Failed to resend verification code.' });
  }
}