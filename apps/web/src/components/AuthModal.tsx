// src/components/AuthModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  registerUser,
  loginUser,
  verifyUserEmail,
  resendVerificationCode,
  createWorkspace,
  getAllWorkspaces,
  type UserAccount,
  type Workspace
} from '../utils/authStorage';
import {
  getSessionUser,
  setSessionUser,
  getAllWorkspaces,
  type UserAccount
} from './utils/authStorage';
import { AuthScreens } from './pages/AuthScreens';
interface AuthModalProps {
  isOpen: boolean;
  theme: 'dark' | 'light';
  currentUser: UserAccount | null;
  onClose: () => void;
  onUserUpdate: (user: UserAccount | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  theme,
  currentUser,
  onClose,
  onUserUpdate
}) => {
  const isDark = theme === 'dark';
  const [view, setView] = useState<'login' | 'register' | 'verify' | 'workspace'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Automatically switch view based on state
  useEffect(() => {
    if (currentUser && !currentUser.isEmailVerified) {
      setView('verify');
    }
  }, [currentUser, isOpen]);

  // Cooldown timer for resending email codes
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = registerUser(name, email, password);
    if (result.error) {
      setError(result.error);
    } else if (result.user) {
      onUserUpdate(result.user);
      setResendCooldown(60);
      setView('verify');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = loginUser(email, password);
    if (result.error) {
      setError(result.error);
    } else if (result.user) {
      onUserUpdate(result.user);
      if (!result.user.isEmailVerified) {
        setResendCooldown(60);
        setView('verify');
      } else {
        onClose();
      }
    }
  };

  // Handle digit changes & auto-focus
  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1);
    if (char && !/^\d+$/.test(char)) return;

    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pasteData)) return;

    const chars = pasteData.split('');
    setDigits(chars);
    inputRefs.current[5]?.focus();
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) return;

    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setError('Please provide all 6 digits of the confirmation code.');
      return;
    }

    const res = verifyUserEmail(currentUser.id, fullCode);
    if (!res.success) {
      setError(res.error || 'Verification failed.');
    } else {
      onUserUpdate({ ...currentUser, isEmailVerified: true });
      alert('Email confirmed successfully! Your account is active.');
      onClose();
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0 || !currentUser) return;
    setError(null);
    const res = resendVerificationCode(currentUser.id);
    if (res.success) {
      setResendCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } else {
      setError(res.error || 'Failed to resend confirmation email.');
    }
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !workspaceName.trim()) return;
    const ws = createWorkspace(currentUser.id, workspaceName.trim());
    onUserUpdate({ ...currentUser, currentWorkspaceId: ws.id });
    alert(`Workspace "${ws.name}" created!`);
    setWorkspaceName('');
    onClose();
  };

  const userWorkspaces: Workspace[] = currentUser
    ? getAllWorkspaces().filter((w) => currentUser.workspaces.includes(w.id))
    : [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 440,
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          borderRadius: 14,
          padding: 24,
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0284c7' }}>
            {view === 'login' && 'Sign In to VisualStack'}
            {view === 'register' && 'Create Your Account'}
            {view === 'verify' && 'Verify Your Email'}
            {view === 'workspace' && 'Manage Workspaces'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fee2e2',
              color: '#dc2626',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 14
            }}
          >
            {error}
          </div>
        )}

        {/* 1. Login View */}
        {view === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                marginTop: 8,
                padding: '10px',
                borderRadius: 6,
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <div style={{ textAlign: 'center', fontSize: 12, marginTop: 10, color: '#64748b' }}>
              Don't have an account?{' '}
              <span onClick={() => setView('register')} style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}>
                Sign Up
              </span>
            </div>
          </form>
        )}

        {/* 2. Register View */}
        {view === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f8fafc' : '#0f172a'
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                marginTop: 8,
                padding: '10px',
                borderRadius: 6,
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Register & Send Code
            </button>
            <div style={{ textAlign: 'center', fontSize: 12, marginTop: 10, color: '#64748b' }}>
              Already registered?{' '}
              <span onClick={() => setView('login')} style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}>
                Log In
              </span>
            </div>
          </form>
        )}

        {/* 3. 6-Digit Email Verification View */}
        {view === 'verify' && (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              We sent a verification code to <strong>{currentUser?.email}</strong>. Check your console or notification banner below:
            </p>

            {/* Instant verification hint for development */}
            {currentUser?.verificationCode && (
              <div
                style={{
                  background: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                  border: '1px dashed #10b981',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: isDark ? '#34d399' : '#047857'
                }}
              >
                📬 Verification Code: <strong>{currentUser.verificationCode}</strong>
              </div>
            )}

            {/* 6 Digit Inputs */}
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8, textAlign: 'center' }}>
                Enter 6-Digit Code
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    onPaste={handleDigitPaste}
                    style={{
                      width: 44,
                      height: 50,
                      fontSize: 20,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      borderRadius: 8,
                      border: `1.5px solid ${digit ? '#0284c7' : isDark ? '#334155' : '#cbd5e1'}`,
                      background: isDark ? '#0f172a' : '#f8fafc',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      outline: 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: 6,
                padding: '11px',
                borderRadius: 6,
                background: '#10b981',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Verify Email Address
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 ? '#94a3b8' : '#0284c7',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  padding: 0
                }}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={() => setView('login')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                Switch Account
              </button>
            </div>
          </form>
        )}

        {/* 4. Workspaces View */}
        {view === 'workspace' && currentUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>
                Your Workspaces
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {userWorkspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => {
                      onUserUpdate({ ...currentUser, currentWorkspaceId: ws.id });
                      alert(`Switched to workspace: ${ws.name}`);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: currentUser.currentWorkspaceId === ws.id ? '#0284c7' : isDark ? '#0f172a' : '#f1f5f9',
                      color: currentUser.currentWorkspaceId === ws.id ? '#fff' : isDark ? '#f8fafc' : '#0f172a',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{ws.name}</span>
                    {currentUser.currentWorkspaceId === ws.id && <span>✓ Active</span>}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateWorkspace} style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
                + Add New Workspace
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infrastructure Core"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 6,
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};