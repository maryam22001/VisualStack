import { Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db.service';
import { sendOtpEmail } from '../services/email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_jwt_key_99999';

export async function register(req: Request, res: Response) {
  try {
    const { fullName, email, password } = req.body;
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
        verificationExpiresAt
      }
    });

    // Create default personal workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: `${fullName}'s Workspace`,
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: 'owner' }
        }
      }
    });

    await sendOtpEmail(normalizedEmail, fullName, verificationCode);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    return res.status(201).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isVerified: user.isVerified,
        currentWorkspaceId: workspace.id
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  try {
    const { userId, code } = req.body;

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
        verificationExpiresAt: null
      }
    });

    return res.json({ success: true, isVerified: updated.isVerified });
  } catch (error) {
    return res.status(500).json({ error: 'Verification failed.' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { ownedWorkspaces: true, memberships: { include: { workspace: true } } }
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
        currentWorkspaceId: activeWorkspaceId
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed.' });
  }
}