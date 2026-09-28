/** */
import React, { useState, useEffect, useRef } from 'react';
import {
  registerUser,
  loginUser,
  verifyCode,
  resendCode,
  createWorkspace,
  type UserAccount
} from '../utils/authStorage';

interface AuthScreensProps {
  initialScreen: 'login' | 'signup' | 'verify' | 'create-workspace';
  currentUser: UserAccount | null;
  onNavigate: (screen: 'login' | 'signup' | 'verify' | 'create-workspace' | 'studio') => void;
  onUserChange: (user: UserAccount | null) => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({
  initialScreen,
  currentUser,
  onNavigate,
  onUserChange
}) => {
  const [screen, setScreen] = useState(initialScreen);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setScreen(initialScreen);
  }, [initialScreen]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await registerUser(name, email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.user) {
      onUserChange(res.user);
      setResendTimer(60);
      onNavigate('verify');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = loginUser(email, password);
    if (res.error) {
      setError(res.error);
    } else if (res.user) {
      onUserChange(res.user);
      if (!res.user.isEmailVerified) {
        onNavigate('verify');
      } else if (!res.user.currentWorkspaceId || res.user.workspaces.length === 0) {
        onNavigate('create-workspace');
      } else {
        onNavigate('studio');
      }
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) return;

    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-digit code sent to your email.');
      return;
    }

    const res = verifyCode(currentUser.id, fullCode);
    if (!res.success) {
      setError(res.error || 'Invalid code.');
    } else {
      onUserChange({ ...currentUser, isEmailVerified: true });
      onNavigate('create-workspace');
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || !currentUser) return;
    setError(null);
    setLoading(true);
    const res = await resendCode(currentUser.id);
    setLoading(false);
    if (res.success) {
      setResendTimer(60);
      setDigits(['', '', '', '', '', '']);
    } else {
      setError(res.error || 'Failed to resend email.');
    }
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !workspaceName.trim()) return;
    const ws = createWorkspace(currentUser.id, workspaceName.trim());
    onUserChange({ ...currentUser, currentWorkspaceId: ws.id, workspaces: [...currentUser.workspaces, ws.id] });
    onNavigate('studio');
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '36px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          color: '#f8fafc'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontSize: '24px', fontWeight: '800', color: '#0284c7' }}>VisualStack</span>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
            {screen === 'signup' && 'Create your developer account'}
            {screen === 'login' && 'Sign in to access your architectures'}
            {screen === 'verify' && 'Verify your email address'}
            {screen === 'create-workspace' && 'Set up your primary workspace'}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#451a1a',
              border: '1px solid #dc2626',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '20px'
            }}
          >
            {error}
          </div>
        )}

        {/* 1. Sign Up Page */}
        {screen === 'signup' && (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Maryam Osman"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="devops@domain.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: '8px', padding: '12px', borderRadius: '8px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
            >
              {loading ? 'Sending Mail...' : 'Create Account & Send Mail'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
              Already have an account?{' '}
              <span onClick={() => onNavigate('login')} style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: '600' }}>
                Sign In
              </span>
            </div>
          </form>
        )}

        {/* 2. Login Page */}
        {screen === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
              />
            </div>
            <button
              type="submit"
              style={{ marginTop: '8px', padding: '12px', borderRadius: '8px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
            >
              Sign In
            </button>
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
              Need an account?{' '}
              <span onClick={() => onNavigate('signup')} style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: '600' }}>
                Sign Up
              </span>
            </div>
          </form>
        )}

        {/* 3. Verification Page (No code on-screen) */}
        {screen === 'verify' && (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📬</div>
              <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>
                We sent a 6-digit confirmation code to:
              </p>
              <strong style={{ color: '#38bdf8', fontSize: '15px' }}>{currentUser?.email}</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Please check your inbox (and spam folder) and enter the code below.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const char = e.target.value.slice(-1);
                    if (char && !/^\d+$/.test(char)) return;
                    const next = [...digits];
                    next[idx] = char;
                    setDigits(next);
                    if (char && idx < 5) inputRefs.current[idx + 1]?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
                  }}
                  style={{
                    width: '46px',
                    height: '54px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontSize: '22px',
                    fontWeight: 'bold',
                    background: '#0f172a',
                    border: `1.5px solid ${digit ? '#0284c7' : '#334155'}`,
                    color: '#fff',
                    outline: 'none'
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              style={{ padding: '12px', borderRadius: '8px', background: '#10b981', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
            >
              Verify Code
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendTimer > 0 || loading}
                style={{ background: 'none', border: 'none', color: resendTimer > 0 ? '#64748b' : '#38bdf8', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer' }}
              >
                {resendTimer > 0 ? `Resend email in ${resendTimer}s` : 'Resend Email'}
              </button>
              <span onClick={() => onNavigate('login')} style={{ color: '#94a3b8', cursor: 'pointer' }}>
                Use different account
              </span>
            </div>
          </form>
        )}

        {/* 4. Create Workspace Page */}
        {screen === 'create-workspace' && (
          <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏢</div>
              <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
                Every architecture diagram you build is organized inside a collaborative Workspace.
              </p>
            </div>

            <div>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Workspace Name</label>
              <input
                type="text"
                required
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Core Infrastructure / Production"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
              />
            </div>

            <button
              type="submit"
              style={{ padding: '12px', borderRadius: '8px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
            >
              Launch Studio Workspace →
            </button>
          </form>
        )}
      </div>
    </div>
  );
};