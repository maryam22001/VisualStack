import React, { useEffect, useRef, useState } from 'react';
import { apiLogin, apiRegister, apiVerifyOtp, apiResendCode, ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import './auth.css';

export type AuthScreenType = 'studio' | 'login' | 'signup' | 'verify' | 'create-workspace';

// Same props as before so App.tsx keeps working unchanged.
export interface AuthScreensProps {
  initialScreen: 'login' | 'signup' | 'verify' | 'create-workspace';
  currentUser?: any;
  onNavigate: (screen: AuthScreenType) => void;
  onLoginSuccess?: (user: any) => void;
  onClose?: () => void;
}

type Screen = 'login' | 'signup' | 'verify';

/* ---------- Small presentational pieces ---------- */

// The same isometric cube used as the node icon in the 3D view.
const LogoMark: React.FC = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <polygon points="50 10, 90 32, 50 54, 10 32" fill="#38bdf8" />
    <polygon points="10 32, 50 54, 50 92, 10 70" fill="#0284c7" />
    <polygon points="90 32, 50 54, 50 92, 90 70" fill="#075985" />
  </svg>
);

const BrandArt: React.FC = () => (
  <svg className="vs-auth__art" viewBox="0 0 380 300" aria-hidden="true">
    <defs>
      <g id="vs-cube">
        <polygon points="50 10, 90 32, 50 54, 10 32" fill="#38bdf8" />
        <polygon points="10 32, 50 54, 50 92, 10 70" fill="#0284c7" />
        <polygon points="90 32, 50 54, 50 92, 90 70" fill="#075985" />
      </g>
    </defs>
    <g stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="5 7" fill="none">
      <path d="M120 150 L230 90" />
      <path d="M120 150 L290 215" />
      <path d="M230 90 L290 215" />
    </g>
    <use href="#vs-cube" transform="translate(180 20) scale(1.1)" />
    <use href="#vs-cube" transform="translate(70 105) scale(0.9)" />
    <use href="#vs-cube" transform="translate(240 170) scale(1)" />
  </svg>
);

const Spinner: React.FC = () => <span className="vs-auth__spinner" aria-hidden="true" />;

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
}

const Field: React.FC<FieldProps> = ({ id, label, type = 'text', value, onChange, autoComplete, placeholder, hint, autoFocus }) => (
  <div className="vs-auth__field">
    <label htmlFor={id}>{label}</label>
    <input
      id={id}
      className="vs-auth__input"
      type={type}
      required
      value={value}
      autoComplete={autoComplete}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
    {hint && <p className="vs-auth__hint">{hint}</p>}
  </div>
);

const PasswordField: React.FC<Omit<FieldProps, 'type'>> = ({ id, label, value, onChange, autoComplete, placeholder, hint }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="vs-auth__field">
      <label htmlFor={id}>{label}</label>
      <div className="vs-auth__input-wrap">
        <input
          id={id}
          className="vs-auth__input vs-auth__input--pw"
          type={visible ? 'text' : 'password'}
          required
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="vs-auth__toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <p className="vs-auth__hint">{hint}</p>}
    </div>
  );
};

// Six boxes: auto-advance, backspace-to-previous, paste a whole code, submit when full.
const OtpInput: React.FC<{ onComplete: (code: string) => void; disabled?: boolean; hasError?: boolean; resetKey: number }> = ({
  onComplete,
  disabled,
  hasError,
  resetKey
}) => {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setDigits(Array(6).fill(''));
    refs.current[0]?.focus();
  }, [resetKey]);

  const commit = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const handleChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[i] = d;
    commit(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = digits.slice();
      next[i - 1] = '';
      setDigits(next);
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(6).fill('');
    pasted.split('').forEach((d, idx) => (next[idx] = d));
    commit(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className={`vs-auth__otp${hasError ? ' vs-auth__otp--error' : ''}`} role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
};

/* ---------- Screen ---------- */

export const AuthScreens: React.FC<AuthScreensProps> = ({ initialScreen, onNavigate, onLoginSuccess, onClose }) => {
  const { setUser } = useAuth();
  const [screen, setScreen] = useState<Screen>(initialScreen === 'signup' ? 'signup' : 'login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [otpKey, setOtpKey] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (next: Screen) => {
    setError(null);
    setNotice(null);
    setInfo(null);
    setScreen(next);
  };

  const finish = (user: any) => {
    setUser(user);
    if (onLoginSuccess) onLoginSuccess(user);
    onNavigate('studio');
    if (onClose) onClose();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRegister(fullName.trim(), email.trim(), password);
      setPendingUserId(res.user.id);
      setNotice(res.emailSent ? null : "We couldn't send the verification email. Try \u201CResend code\u201D in a moment.");
      setResendIn(30);
      setInfo(null);
      setScreen('verify');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email.trim(), password);
      finish(res.user);
    } catch (err: any) {
      if (err instanceof ApiError && err.data?.needsVerification) {
        // Correct password, but the email was never confirmed.
        setPendingUserId(err.data.userId);
        setNotice('Please verify your email to continue. Request a new code below if yours has expired.');
        setResendIn(0);
        setScreen('verify');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (!pendingUserId || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiVerifyOtp(pendingUserId, code);
      if (res.isVerified) {
        const loginRes = await apiLogin(email.trim(), password);
        finish(loginRes.user);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setOtpKey((k) => k + 1); // clear the boxes
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingUserId || resendIn > 0) return;
    setError(null);
    setInfo(null);
    try {
      const res = await apiResendCode(pendingUserId);
      setResendIn(30);
      if (res.emailSent) {
        setNotice(null);
        setInfo('A new code is on its way.');
      } else {
        setNotice("We couldn't send the email. Please try again shortly.");
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.data?.retryAfter) setResendIn(err.data.retryAfter);
      setError(err.message || 'Could not resend the code');
    }
  };

  const titles: Record<Screen, { h: string; p: React.ReactNode }> = {
    login: { h: 'Welcome back', p: 'Sign in to your VisualStack workspace.' },
    signup: { h: 'Create your account', p: 'Start designing system architecture in minutes.' },
    verify: {
      h: 'Check your email',
      p: (
        <>
          We sent a 6-digit code to <b>{email || 'your inbox'}</b>. Enter it below to finish setting up your account.
        </>
      )
    }
  };

  return (
    <div className="vs-auth">
      {/* Brand side */}
      <aside className="vs-auth__brand">
        <div className="vs-auth__logo">
          <LogoMark />
          VisualStack
        </div>

        <div className="vs-auth__hero">
          <h1>
            Design system architecture <span>visually.</span>
          </h1>
          <p>Drag, connect and ship clear architecture diagrams &mdash; no layout fights, no syntax to memorise.</p>
          <ul className="vs-auth__features">
            <li><i>✓</i> Drag-and-drop canvas with smart alignment</li>
            <li><i>✓</i> Clean, detailed 2D and 3D isometric views</li>
            <li><i>✓</i> Searchable icon library for any tool</li>
            <li><i>✓</i> Export to SVG &amp; PNG, share by link</li>
          </ul>
        </div>

        <BrandArt />
        <div className="vs-auth__foot">&copy; {new Date().getFullYear()} VisualStack</div>
      </aside>

      {/* Form side */}
      <main className="vs-auth__side">
        <button
          type="button"
          className="vs-auth__guest"
          onClick={() => {
            onNavigate('studio');
            if (onClose) onClose();
          }}
        >
          Continue without an account &rarr;
        </button>

        <div className="vs-auth__card">
          <div className="vs-auth__mobile-logo">
            <LogoMark />
            VisualStack
          </div>

          <h2 className="vs-auth__title">{titles[screen].h}</h2>
          <p className="vs-auth__subtitle">{titles[screen].p}</p>

          {notice && (
            <div className="vs-auth__alert vs-auth__alert--warn" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="vs-auth__alert vs-auth__alert--error" role="alert">
              {error}
            </div>
          )}

          {screen === 'login' && (
            <>
              <form className="vs-auth__form" onSubmit={handleLogin}>
                <Field id="login-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" autoFocus />
                <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Your password" />
                <button type="submit" className="vs-auth__btn" disabled={loading}>
                  {loading && <Spinner />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <p className="vs-auth__switch">
                New to VisualStack?{' '}
                <button type="button" className="vs-auth__link" onClick={() => go('signup')}>
                  Create an account
                </button>
              </p>
            </>
          )}

          {screen === 'signup' && (
            <>
              <form className="vs-auth__form" onSubmit={handleRegister}>
                <Field id="signup-name" label="Full name" value={fullName} onChange={setFullName} autoComplete="name" placeholder="Ada Lovelace" autoFocus />
                <Field id="signup-email" label="Work email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" />
                <PasswordField id="signup-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" hint="Use 8 or more characters." />
                <button type="submit" className="vs-auth__btn" disabled={loading}>
                  {loading && <Spinner />}
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>
              <p className="vs-auth__switch">
                Already have an account?{' '}
                <button type="button" className="vs-auth__link" onClick={() => go('login')}>
                  Sign in
                </button>
              </p>
            </>
          )}

          {screen === 'verify' && (
            <>
              <div className="vs-auth__form">
                <OtpInput onComplete={handleVerify} disabled={loading} hasError={!!error} resetKey={otpKey} />
                <button type="button" className="vs-auth__btn" disabled style={{ display: loading ? 'inline-flex' : 'none' }}>
                  <Spinner /> Verifying…
                </button>
                {info && <p className="vs-auth__hint">{info}</p>}
              </div>
              <p className="vs-auth__switch">
                Didn&rsquo;t get it?{' '}
                <button type="button" className="vs-auth__link" onClick={handleResend} disabled={resendIn > 0}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>
                <br />
                <button type="button" className="vs-auth__link" style={{ marginTop: 8, fontWeight: 500 }} onClick={() => go('signup')}>
                  Use a different email
                </button>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AuthScreens;