import React, { useEffect, useRef, useState } from 'react';
import {
  apiForgotPassword,
  apiLogin,
  apiRegister,
  apiResendCode,
  apiResetPassword,
  apiVerifyOtp,
  ApiError,
  errorMessage,
  type UserSession
} from '../api/client';
import { useAuth } from '../hooks/useAuth';
import './auth.css';

export type AuthScreenType = 'studio' | 'login' | 'signup' | 'verify' | 'create-workspace';

export interface AuthScreensProps {
  initialScreen?: 'login' | 'signup' | 'verify' | 'create-workspace';
  currentUser?: unknown;
  /** Called with 'studio' when the visitor chooses "Continue without an account". */
  onNavigate: (screen: AuthScreenType) => void;
  onLoginSuccess?: (user: UserSession) => void;
  onClose?: () => void;
}

type Screen = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

const RESEND_SECONDS = 30;

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
  <svg className="vs-auth__art" viewBox="0 0 540 360" aria-hidden="true">
    <defs>
      <linearGradient id="vs-platform-top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#dff8ff" />
        <stop offset="1" stopColor="#60c8f2" />
      </linearGradient>
      <linearGradient id="vs-platform-side" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#39a8e0" />
        <stop offset="1" stopColor="#1769a8" />
      </linearGradient>
      <filter id="vs-art-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
    </defs>

    <ellipse cx="302" cy="277" rx="205" ry="38" fill="#0ea5e9" opacity="0.18" filter="url(#vs-art-glow)" />
    <g stroke="#67d9ff" strokeOpacity="0.75" strokeWidth="2" fill="none">
      <path d="M92 204 277 100 465 207 278 313Z" opacity=".32" />
      <path d="M92 204 278 313M185 152 372 259M277 100 465 207M371 153 185 259" opacity=".22" />
      <path d="M172 183 278 122M278 122 382 183M172 183 278 244M382 183 278 244" strokeDasharray="4 7" />
    </g>

    <g opacity=".42">
      <path d="m250 252 30-17 30 17-30 18Z" fill="#7ee7ff" />
      <path d="m250 252 30 18v16l-30-18Z" fill="#1687c2" />
      <path d="m310 252-30 18v16l30-18Z" fill="#075985" />
    </g>
    <g>
      <path d="m67 224 32-18 32 18-32 19Z" fill="url(#vs-platform-top)" />
      <path d="m67 224 32 19v42l-32-19Z" fill="#2188ca" />
      <path d="m131 224-32 19v42l32-19Z" fill="url(#vs-platform-side)" />
      <path d="m76 233 23 14 23-14M76 243l23 14 23-14" stroke="#dff8ff" strokeOpacity=".8" fill="none" />
      <path d="m242 261 38-22 38 22-38 23Z" fill="url(#vs-platform-top)" />
      <path d="m242 261 38 23v40l-38-23Z" fill="#2188ca" />
      <path d="m318 261-38 23v40l38-23Z" fill="url(#vs-platform-side)" />
      <path d="m255 267 25 15 25-15" stroke="#e6fbff" strokeOpacity=".8" fill="none" />
      <path d="m403 218 29-17 29 17-29 18Z" fill="url(#vs-platform-top)" />
      <path d="m403 218 29 18v38l-29-18Z" fill="#2188ca" />
      <path d="m461 218-29 18v38l29-18Z" fill="url(#vs-platform-side)" />
      <path d="m412 226 20 12 20-12" stroke="#e6fbff" strokeOpacity=".8" fill="none" />
    </g>

    <g>
      <path d="m157 104 39-22 39 22-39 23Z" fill="url(#vs-platform-top)" />
      <path d="m157 104 39 23v59l-39-23Z" fill="#1687c2" />
      <path d="m235 104-39 23v59l39-23Z" fill="url(#vs-platform-side)" />
      <path d="m169 113 27 16 27-16M169 127l27 16 27-16M169 141l27 16 27-16" stroke="#e6fbff" strokeOpacity=".84" fill="none" />
      <path d="m337 128 31-18 31 18-31 19Z" fill="url(#vs-platform-top)" />
      <path d="m337 128 31 19v48l-31-19Z" fill="#1687c2" />
      <path d="m399 128-31 19v48l31-19Z" fill="url(#vs-platform-side)" />
      <path d="m348 137 20 12 20-12M348 149l20 12 20-12" stroke="#e6fbff" strokeOpacity=".84" fill="none" />
      <ellipse cx="282" cy="111" rx="21" ry="12" fill="#b8f6ff" opacity=".92" />
      <path d="m261 111v27c0 7 9 13 21 13s21-6 21-13v-27" fill="#28a4d7" />
      <ellipse cx="282" cy="138" rx="21" ry="12" fill="#0d78ad" />
      <ellipse cx="282" cy="111" rx="21" ry="12" fill="#d5fbff" />
    </g>
  </svg>
);

const SocialButtons: React.FC<{ onUnavailable: (provider: string) => void }> = ({ onUnavailable }) => (
  <>
    <div className="vs-auth__socials">
      <button type="button" className="vs-auth__social-btn" onClick={() => onUnavailable('GitHub')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.32-3.76-1.32-.5-1.3-1.23-1.65-1.23-1.65-1.01-.7.08-.69.08-.69 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.59 1.21 3.22.93.1-.72.39-1.21.7-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.67.11 2.95.72.78 1.15 1.77 1.15 2.99 0 4.29-2.61 5.23-5.1 5.51.4.35.75 1.03.75 2.08v3.1c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" /></svg>
        Continue with GitHub
      </button>
      <button type="button" className="vs-auth__social-btn" onClick={() => onUnavailable('Google')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.42-.18-2.09H12v3.95h5.38a4.6 4.6 0 0 1-2 3.02v2.47h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z" /><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.47c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.06v2.55A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.41 13.94A6.01 6.01 0 0 1 6.1 12c0-.67.11-1.32.31-1.94V7.51H3.06A10 10 0 0 0 2 12c0 1.62.39 3.16 1.06 4.49l3.35-2.55Z" /><path fill="#EA4335" d="M12 5.94c1.47 0 2.8.5 3.84 1.5l2.88-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.51l3.35 2.55c.79-2.36 2.99-4.12 5.59-4.12Z" /></svg>
        Continue with Google
      </button>
    </div>
    <div className="vs-auth__divider"><span>or continue with email</span></div>
  </>
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
  /** Rendered on the right of the label row, e.g. a "Forgot password?" link. */
  labelRight?: React.ReactNode;
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

const PasswordField: React.FC<Omit<FieldProps, 'type'>> = ({ id, label, value, onChange, autoComplete, placeholder, hint, labelRight }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="vs-auth__field">
      <div className="vs-auth__label-row">
        <label htmlFor={id}>{label}</label>
        {labelRight}
      </div>
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

// Six boxes: auto-advance, backspace-to-previous, paste a whole code.
//  - onChange fires on every edit with the digits entered so far (may be < 6 long)
//  - onComplete fires once, when all six boxes are filled
const OtpInput: React.FC<{
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}> = ({ onChange, onComplete, disabled, hasError }) => {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // The parent remounts this component (via `key`) to clear it, so focusing on mount is all it takes.
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const update = (next: string[]) => {
    setDigits(next);
    onChange?.(next.join(''));
    if (onComplete && next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const handleChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[i] = d;
    update(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = digits.slice();
      next[i - 1] = '';
      update(next);
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
    update(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className={`vs-auth__otp${hasError ? ' vs-auth__otp--error' : ''}`} role="group" aria-label="6-digit code">
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

  // password reset
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    setSuccess(null);
    setInfo(null);
    setScreen(next);
  };

  // Signing in updates the auth context; App.tsx reacts to `user` and shows the studio
  // for that user's workspace. No manual navigation needed.
  const finish = (user: UserSession) => {
    setUser(user);
    if (onLoginSuccess) onLoginSuccess(user);
    if (onClose) onClose();
  };

  /* ----- sign up ----- */
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
      setResendIn(RESEND_SECONDS);
      setInfo(null);
      setOtpKey((k) => k + 1);
      setScreen('verify');
    } catch (err) {
      setError(errorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  /* ----- sign in (and the unverified-user path) ----- */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await apiLogin(email.trim(), password);
      finish(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.data.needsVerification === true) {
        // Correct password, but the email was never confirmed: enter the code, or ask for a new one.
        setPendingUserId(String(err.data.userId));
        setNotice('Please verify your email to continue. Enter the code we sent you, or request a new one below.');
        setResendIn(0);
        setOtpKey((k) => k + 1);
        setScreen('verify');
      } else {
        setError(errorMessage(err, 'Login failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  /* ----- verify email ----- */
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
    } catch (err) {
      setError(errorMessage(err, 'Verification failed'));
      setOtpKey((k) => k + 1); // clear the boxes
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendIn > 0) return;
    setError(null);
    setInfo(null);
    try {
      const res = await apiResendCode(email.trim());
      setResendIn(RESEND_SECONDS);
      setOtpKey((k) => k + 1);
      if (res.emailSent) {
        setNotice(null);
        setInfo('A new code is on its way.');
      } else {
        setNotice("We couldn't send the email. Please try again shortly.");
      }
    } catch (err) {
      if (err instanceof ApiError && typeof err.data.retryAfter === 'number') setResendIn(err.data.retryAfter);
      setError(errorMessage(err, 'Could not resend the code'));
    }
  };

  /* ----- forgot / reset password ----- */
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiForgotPassword(email.trim());
      // The server answers identically whether or not the account exists.
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpKey((k) => k + 1);
      setNotice(null);
      setInfo(null);
      setResendIn(RESEND_SECONDS);
      setScreen('reset');
    } catch (err) {
      setError(errorMessage(err, 'Could not start the password reset'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendReset = async () => {
    if (resendIn > 0) return;
    setError(null);
    setInfo(null);
    try {
      await apiForgotPassword(email.trim());
      setResendIn(RESEND_SECONDS);
      setInfo('If that email has an account, a new code is on its way.');
    } catch (err) {
      setError(errorMessage(err, 'Could not resend the code'));
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (resetCode.length !== 6) return setError('Enter the 6-digit code from your email.');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await apiResetPassword(email.trim(), resetCode, newPassword);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      go('login');
      setSuccess('Password updated. Sign in with your new password.');
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password'));
      setResetCode('');
      setOtpKey((k) => k + 1);
    } finally {
      setLoading(false);
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
    },
    forgot: { h: 'Forgot your password?', p: "Enter your email and we'll send you a 6-digit code to reset it." },
    reset: {
      h: 'Reset your password',
      p: (
        <>
          Enter the 6-digit code we sent to <b>{email}</b> and choose a new password.
        </>
      )
    }
  };

  const submitLabel = (idle: string, busy: string) => (
    <>
      {loading && <Spinner />}
      {loading ? busy : idle}
    </>
  );

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
            <li><i>✓</i> Drag-and-drop canvas with snap-to-grid</li>
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

          {success && (
            <div className="vs-auth__alert vs-auth__alert--ok" role="status">
              {success}
            </div>
          )}
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

          {/* ---------------- Sign in ---------------- */}
          {screen === 'login' && (
            <>
              <SocialButtons onUnavailable={(provider) => setNotice(`${provider} sign-in is not configured yet. Please continue with email.`)} />
              <form className="vs-auth__form" onSubmit={handleLogin}>
                <Field id="login-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" autoFocus />
                <PasswordField
                  id="login-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  placeholder="Your password"
                  labelRight={
                    <button type="button" className="vs-auth__link vs-auth__link--small" onClick={() => go('forgot')}>
                      Forgot password?
                    </button>
                  }
                />
                <button type="submit" className="vs-auth__btn" disabled={loading}>
                  {submitLabel('Sign in', 'Signing in…')}
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

          {/* ---------------- Sign up ---------------- */}
          {screen === 'signup' && (
            <>
              <SocialButtons onUnavailable={(provider) => setNotice(`${provider} sign-up is not configured yet. Please continue with email.`)} />
              <form className="vs-auth__form" onSubmit={handleRegister}>
                <Field id="signup-name" label="Full name" value={fullName} onChange={setFullName} autoComplete="name" placeholder="Ada Lovelace" autoFocus />
                <Field id="signup-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" />
                <PasswordField id="signup-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" hint="Use 8 or more characters." />
                <button type="submit" className="vs-auth__btn" disabled={loading}>
                  {submitLabel('Create account', 'Creating account…')}
                </button>
              </form>
              <p className="vs-auth__legal">
                By creating an account, you agree to our <span>Terms</span> and <span>Privacy Policy</span>.
              </p>
              <p className="vs-auth__switch">
                Already have an account?{' '}
                <button type="button" className="vs-auth__link" onClick={() => go('login')}>
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* ---------------- Verify email (also the unverified-login path) ---------------- */}
          {screen === 'verify' && (
            <>
              <div className="vs-auth__form">
                <OtpInput key={otpKey} onComplete={handleVerify} disabled={loading} hasError={!!error} />
                {loading && (
                  <p className="vs-auth__hint" role="status">
                    Verifying…
                  </p>
                )}
                {info && <p className="vs-auth__hint">{info}</p>}
              </div>
              <p className="vs-auth__switch">
                Didn&rsquo;t get it?{' '}
                <button type="button" className="vs-auth__link" onClick={handleResendVerification} disabled={resendIn > 0}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>
                <br />
                <button type="button" className="vs-auth__link vs-auth__link--muted" onClick={() => go('login')}>
                  Back to sign in
                </button>
              </p>
            </>
          )}

          {/* ---------------- Forgot password: ask for email ---------------- */}
          {screen === 'forgot' && (
            <>
              <form className="vs-auth__form" onSubmit={handleForgot}>
                <Field id="forgot-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" autoFocus />
                <button type="submit" className="vs-auth__btn" disabled={loading}>
                  {submitLabel('Send reset code', 'Sending…')}
                </button>
              </form>
              <p className="vs-auth__switch">
                <button type="button" className="vs-auth__link" onClick={() => go('login')}>
                  &larr; Back to sign in
                </button>
              </p>
            </>
          )}

          {/* ---------------- Reset password: code + new password ---------------- */}
          {screen === 'reset' && (
            <>
              <form className="vs-auth__form" onSubmit={handleReset}>
                <div className="vs-auth__field">
                  <div className="vs-auth__label-row">
                    <label>Reset code</label>
                  </div>
                  <OtpInput key={otpKey} onChange={setResetCode} disabled={loading} hasError={!!error && resetCode.length === 0} />
                </div>
                <PasswordField id="reset-new" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" placeholder="At least 8 characters" />
                <PasswordField id="reset-confirm" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Repeat the new password" />
                <button type="submit" className="vs-auth__btn" disabled={loading}>
                  {submitLabel('Reset password', 'Updating…')}
                </button>
                {info && <p className="vs-auth__hint">{info}</p>}
              </form>
              <p className="vs-auth__switch">
                Didn&rsquo;t get a code?{' '}
                <button type="button" className="vs-auth__link" onClick={handleResendReset} disabled={resendIn > 0}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>
                <br />
                <button type="button" className="vs-auth__link vs-auth__link--muted" onClick={() => go('login')}>
                  Back to sign in
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
