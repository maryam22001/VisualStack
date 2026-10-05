import React, { useState } from 'react';
import { apiLogin, apiRegister, apiVerifyOtp } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export type AuthScreenType = 'studio' | 'login' | 'signup' | 'verify' | 'create-workspace';

export interface AuthScreensProps {
  initialScreen: 'login' | 'signup' | 'verify' | 'create-workspace';
  currentUser?: any;
  onNavigate: (screen: AuthScreenType) => void;
  onLoginSuccess?: (user: any) => void;
  onClose?: () => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({
  initialScreen,
  onNavigate,
  onLoginSuccess,
  onClose
}) => {
  const { setUser } = useAuth();
  const [screen, setScreen] = useState<'login' | 'signup' | 'verify' | 'create-workspace'>(initialScreen);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRegister(fullName, email, password);
      setPendingUserId(res.user.id);
      setScreen('verify');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUserId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiVerifyOtp(pendingUserId, otpCode);
      if (res.isVerified) {
        const loginRes = await apiLogin(email, password);
        setUser(loginRes.user);
        if (onLoginSuccess) onLoginSuccess(loginRes.user);
        onNavigate('studio');
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      setUser(res.user);
      if (onLoginSuccess) onLoginSuccess(res.user);
      onNavigate('studio');
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={() => {
            onNavigate('studio');
            if (onClose) onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
        >
          ×
        </button>

        <h2 className="text-xl font-bold text-sky-400 mb-4">
          {screen === 'login' && 'Sign In to VisualStack'}
          {screen === 'signup' && 'Create Your Account'}
          {screen === 'verify' && 'Verify Your Email'}
          {screen === 'create-workspace' && 'Create Workspace'}
        </h2>

        {error && (
          <div className="mb-4 rounded bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-400">
            {error}
          </div>
        )}

        {screen === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-sm transition"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="text-xs text-center text-slate-400 mt-3">
              Don't have an account?{' '}
              <button type="button" onClick={() => setScreen('signup')} className="text-sky-400 hover:underline">
                Sign up
              </button>
            </p>
          </form>
        )}

        {screen === 'signup' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-sm transition"
            >
              {loading ? 'Creating...' : 'Sign Up'}
            </button>
            <p className="text-xs text-center text-slate-400 mt-3">
              Already have an account?{' '}
              <button type="button" onClick={() => setScreen('login')} className="text-sky-400 hover:underline">
                Sign in
              </button>
            </p>
          </form>
        )}

        {screen === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-xs text-slate-400">
              A 6-digit confirmation code was output to your server terminal for <span className="text-white font-medium">{email}</span>.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">6-Digit Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full text-center tracking-widest text-lg font-mono bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                placeholder="123456"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition"
            >
              {loading ? 'Verifying...' : 'Confirm & Open Studio'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthScreens;