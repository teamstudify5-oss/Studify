import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase, signInWithGoogle } from '../supabaseClient.js';

interface AuthCardProps {
  initialMode?: 'login' | 'signup';
  onSwitchMode?: (mode: 'login' | 'signup') => void;
  onSuccess?: () => void;
  isModal?: boolean;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  initialMode = 'login',
  onSwitchMode,
  onSuccess,
  isModal = false,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  // Form input states
  const [loginEmail, setLoginEmail] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('email') || sessionStorage.getItem('pyq_registered_email') || '';
    } catch {
      return '';
    }
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('registered') === 'true') {
        return (
          urlParams.get('message') ||
          'Your account has been created. Please check your email and verify your address before logging in.'
        );
      }
      return sessionStorage.getItem('pyq_registered_message') || null;
    } catch {
      return null;
    }
  });

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccessMessage, setSignupSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const emailParam = urlParams.get('email') || sessionStorage.getItem('pyq_registered_email');
      const registered = urlParams.get('registered') === 'true' || !!sessionStorage.getItem('pyq_registered_message');

      if (emailParam) {
        setLoginEmail(emailParam);
      }
      if (registered) {
        setLoginSuccessMessage(
          sessionStorage.getItem('pyq_registered_message') ||
          'Your account has been created. Please check your email and verify your address before logging in.'
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setLoginError(null);
    setSignupError(null);
    setSignupSuccessMessage(null);
    if (newMode === 'signup') {
      setLoginSuccessMessage(null);
    }
    if (onSwitchMode) {
      onSwitchMode(newMode);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    const emailTrimmed = loginEmail.trim();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailTrimmed,
        password: loginPassword,
      });

      if (error) {
        setLoginLoading(false);
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setLoginError('Please verify your email address before signing in. Check your inbox or spam folder.');
        } else if (error.message.toLowerCase().includes('invalid login credentials')) {
          setLoginError('Invalid email or password. Please check your details and try again.');
        } else {
          setLoginError(error.message);
        }
        return;
      }

      if (data.session) {
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      setLoginLoading(false);
      setLoginError(err?.message || 'An unexpected error occurred during sign in.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);
    setSignupError(null);
    setSignupSuccessMessage(null);

    const emailTrimmed = signupEmail.trim();

    if (signupPassword !== signupConfirmPassword) {
      setSignupLoading(false);
      setSignupError('Passwords do not match.');
      return;
    }

    if (signupPassword.length < 6) {
      setSignupLoading(false);
      setSignupError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password: signupPassword,
        options: {
          data: {
            full_name: signupName.trim() || undefined,
          },
        },
      });

      if (error) {
        setSignupLoading(false);
        if (error.message.toLowerCase().includes('already registered')) {
          setSignupError('An account with this email address already exists. Please sign in instead.');
        } else {
          setSignupError(error.message);
        }
        return;
      }

      setSignupLoading(false);

      if (data.session) {
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/';
        }
      } else {
        const msg = 'Account created successfully! Please check your email to verify your address.';
        setSignupSuccessMessage(msg);
        try {
          sessionStorage.setItem('pyq_registered_email', emailTrimmed);
          sessionStorage.setItem('pyq_registered_message', msg);
        } catch {
          // ignore
        }
        setTimeout(() => {
          switchMode('login');
          setLoginEmail(emailTrimmed);
        }, 1500);
      }
    } catch (err: any) {
      setSignupLoading(false);
      setSignupError(err?.message || 'An unexpected error occurred during account creation.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (mode === 'login') {
          setLoginError(error.message || 'Failed to sign in with Google.');
        } else {
          setSignupError(error.message || 'Failed to sign in with Google.');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'An error occurred while connecting to Google.';
      if (mode === 'login') {
        setLoginError(msg);
      } else {
        setSignupError(msg);
      }
    }
  };

  return (
    <div
      className={`w-full max-w-md mx-auto bg-[var(--surface-main)]/90 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl p-6 sm:p-7 text-[var(--text-primary)] shadow-lg relative overflow-hidden ${
        isModal ? '' : 'my-6 sm:my-10'
      }`}
    >
      {/* Studify Branding Header */}
      <div className="text-center space-y-1.5 relative z-10 mb-5">
        <div className="text-base font-bold tracking-tight text-[var(--text-primary)]">
          Studify
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
          {mode === 'login'
            ? 'Continue your study workflow with verified past papers.'
            : 'Join Studify to find past papers and organize study resources.'}
        </p>
      </div>

      {/* Screen Mode Tabs */}
      <div className="flex bg-[var(--surface-elevated)] p-1 rounded-xl border border-[var(--border-divider)] mb-5 relative z-10">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer btn-quad-border ${
            mode === 'login'
              ? 'bg-[var(--surface-main)] text-[var(--accent-blue)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode('signup')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer btn-quad-border ${
            mode === 'signup'
              ? 'bg-[var(--surface-main)] text-[var(--accent-blue)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* SIGN IN FORM */}
      {mode === 'login' ? (
        <div className="space-y-3.5 relative z-10">
          {loginSuccessMessage && (
            <div className="p-3 rounded-xl bg-[var(--accent-green-bg)] border border-[var(--color-green)]/30 flex items-start gap-2 text-[var(--color-green)] text-xs text-left animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div className="space-y-1 text-left">
              <label htmlFor="login-email" className="block text-xs font-medium text-[var(--text-secondary)]">
                Email address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loginLoading}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-medium text-[var(--text-secondary)]">
                  Password
                </label>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
                <input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={loginLoading}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-9 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5 text-left">
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                  rememberMe
                    ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white dark:text-[#1C2530]'
                    : 'bg-[var(--input-bg)] border-[var(--input-border)]'
                }`}
              >
                {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
              </button>
              <label
                onClick={() => setRememberMe(!rememberMe)}
                className="text-xs text-[var(--text-secondary)] cursor-pointer select-none"
              >
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-opacity shadow-xs active:scale-[0.99] mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed btn-quad-border"
            >
              {loginLoading ? 'Signing In...' : 'Log In'}
            </button>

            {loginError && (
              <div className="p-2.5 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 flex items-start gap-2 text-[var(--color-red)] text-xs text-left animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="relative my-3 flex items-center justify-center">
              <div className="w-full border-t border-[var(--border-divider)]" aria-hidden="true" />
              <span className="bg-[var(--surface-main)] px-2.5 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider relative z-10">
                or
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2 px-3.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer btn-quad-border"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="pt-1.5 text-center text-xs text-[var(--text-secondary)]">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="font-medium text-[var(--accent-blue)] hover:underline ml-0.5 cursor-pointer"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* SIGN UP FORM */
        <form onSubmit={handleSignUp} className="space-y-3 relative z-10">
          <div className="space-y-1 text-left">
            <label htmlFor="signup-name" className="block text-xs font-medium text-[var(--text-secondary)]">
              Full name
            </label>
            <div className="relative flex items-center">
              <UserIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                disabled={signupLoading}
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1 text-left">
            <label htmlFor="signup-email" className="block text-xs font-medium text-[var(--text-secondary)]">
              Email address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                disabled={signupLoading}
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1 text-left">
            <label htmlFor="signup-password" className="block text-xs font-medium text-[var(--text-secondary)]">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
              <input
                id="signup-password"
                type={showSignupPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={signupLoading}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-9 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword(!showSignupPassword)}
                aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1 text-left">
            <label htmlFor="signup-confirm-password" className="block text-xs font-medium text-[var(--text-secondary)]">
              Confirm password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
              <input
                id="signup-confirm-password"
                type={showSignupConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={signupLoading}
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full pl-9 pr-9 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                aria-label={showSignupConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                {showSignupConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={signupLoading}
            className="w-full py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-opacity shadow-xs active:scale-[0.99] mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed btn-quad-border"
          >
            {signupLoading ? 'Creating Account...' : 'Create Account'}
          </button>

          {signupSuccessMessage && (
            <div className="p-2.5 rounded-lg bg-[var(--accent-green-bg)] border border-[var(--color-green)]/30 flex items-start gap-2 text-[var(--color-green)] text-xs text-left animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{signupSuccessMessage}</span>
            </div>
          )}

          {signupError && (
            <div className="p-2.5 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 flex items-start gap-2 text-[var(--color-red)] text-xs text-left animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{signupError}</span>
            </div>
          )}

          <div className="relative my-3 flex items-center justify-center">
            <div className="w-full border-t border-[var(--border-divider)]" aria-hidden="true" />
            <span className="bg-[var(--surface-main)] px-2.5 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider relative z-10">
              or
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-2 px-3.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer btn-quad-border"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Sign up with Google</span>
          </button>

          <div className="pt-1.5 text-center text-xs text-[var(--text-secondary)]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-medium text-[var(--accent-blue)] hover:underline ml-0.5 cursor-pointer"
            >
              Log in
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
