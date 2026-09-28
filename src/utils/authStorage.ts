// src/utils/authStorage.ts
import emailjs from '@emailjs/browser';

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  verificationCode?: string;
  verificationExpiresAt?: number;
  currentWorkspaceId?: string;
  workspaces: string[];
}

const USERS_KEY = 'visualstack:users';
const SESSION_KEY = 'visualstack:session';
const WORKSPACES_KEY = 'visualstack:workspaces';

// EmailJS credentials (configure your Service ID, Template ID, and Public Key from emailjs.com)
export const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_visualstack',
  TEMPLATE_ID: 'template_verify',
  PUBLIC_KEY: 'YOUR_EMAILJS_PUBLIC_KEY'
};

export const getAllUsers = (): UserAccount[] => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
};

export const getAllWorkspaces = (): Workspace[] => {
  try { return JSON.parse(localStorage.getItem(WORKSPACES_KEY) || '[]'); } catch { return []; }
};

export const saveUsers = (users: UserAccount[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const saveWorkspaces = (workspaces: Workspace[]) => {
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
};

export const getSessionUser = (): UserAccount | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setSessionUser = (user: UserAccount | null) => {
  if (!user) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(user));
};

const generateSecureCode = (): string => {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return (100000 + (array[0] % 900000)).toString();
};

/**
 * Dispatches verification code directly to user's real email.
 */
export const sendVerificationEmail = async (email: string, code: string, name: string): Promise<boolean> => {
  try {
    if (EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        { to_email: email, to_name: name, verification_code: code },
        EMAILJS_CONFIG.PUBLIC_KEY
      );
      return true;
    } else {
      // Fallback: If EmailJS keys aren't set yet, dispatch via console log for testing
      console.info(`[Email Dispatch Simulation] Email sent to ${email} with code: ${code}`);
      return true;
    }
  } catch (err) {
    console.error('Failed to send verification email:', err);
    return false;
  }
};

// 1. Sign Up
export const registerUser = async (name: string, email: string, password: string): Promise<{ user?: UserAccount; error?: string }> => {
  const users = getAllUsers();
  const normalizedEmail = email.toLowerCase().trim();

  if (users.some((u) => u.email === normalizedEmail)) {
    return { error: 'An account with this email already exists.' };
  }

  const verificationCode = generateSecureCode();
  const verificationExpiresAt = Date.now() + 10 * 60 * 1000;
  const userId = `user-${Date.now()}`;

  const newUser: UserAccount = {
    id: userId,
    name,
    email: normalizedEmail,
    passwordHash: btoa(password),
    isEmailVerified: false,
    verificationCode,
    verificationExpiresAt,
    workspaces: []
  };

  saveUsers([...users, newUser]);
  setSessionUser(newUser);

  await sendVerificationEmail(normalizedEmail, verificationCode, name);
  return { user: newUser };
};

// 2. Resend Code
export const resendCode = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  const users = getAllUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return { success: false, error: 'User not found' };

  const newCode = generateSecureCode();
  users[index].verificationCode = newCode;
  users[index].verificationExpiresAt = Date.now() + 10 * 60 * 1000;
  saveUsers(users);
  setSessionUser(users[index]);

  await sendVerificationEmail(users[index].email, newCode, users[index].name);
  return { success: true };
};

// 3. Verify Code
export const verifyCode = (userId: string, enteredCode: string): { success: boolean; error?: string } => {
  const users = getAllUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return { success: false, error: 'User not found.' };

  const user = users[index];
  if (!user.verificationCode) return { success: false, error: 'No verification requested.' };
  if (user.verificationExpiresAt && Date.now() > user.verificationExpiresAt) {
    return { success: false, error: 'Code has expired. Request a new one.' };
  }
  if (user.verificationCode !== enteredCode.trim()) {
    return { success: false, error: 'Invalid verification code.' };
  }

  users[index].isEmailVerified = true;
  delete users[index].verificationCode;
  delete users[index].verificationExpiresAt;
  saveUsers(users);
  setSessionUser(users[index]);

  return { success: true };
};

// 4. Login
export const loginUser = (email: string, password: string): { user?: UserAccount; error?: string } => {
  const users = getAllUsers();
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.find((u) => u.email === normalizedEmail && u.passwordHash === btoa(password));

  if (!user) return { error: 'Invalid email or password.' };
  setSessionUser(user);
  return { user };
};

// 5. Create Workspace
export const createWorkspace = (userId: string, name: string): Workspace => {
  const wsId = `ws-${Date.now()}`;
  const newWorkspace: Workspace = {
    id: wsId,
    name,
    ownerId: userId,
    createdAt: Date.now()
  };

  saveWorkspaces([...getAllWorkspaces(), newWorkspace]);

  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    users[idx].workspaces.push(wsId);
    users[idx].currentWorkspaceId = wsId;
    saveUsers(users);
    setSessionUser(users[idx]);
  }

  return newWorkspace;
};