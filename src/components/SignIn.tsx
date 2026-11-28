import React, { useState, useEffect } from 'react';
import { BookOpen, Eye, EyeOff, Lock, Mail, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase, signInWithGoogle } from '../supabaseClient.js';

export interface SignInProps {
  initialEmail?: string;
  successMessage?: string;
  onSuccess?: () => void;
  onSwitchToSignUp?: () => void;
  isModal?: boolean;
}

export const SignIn: React.FC<SignInProps> = ({
  initialEmail = '',
  successMessage,
  onSuccess,
  onSwitchToSignUp,
  isModal = false,
}) => {
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('email') || sessionStorage.getItem('pyq_registered_email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(() => {
    if (successMessage) return successMessage;
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

  // Read pre-filled email and registration success state from props, storage, or URL query params
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
    if (successMessage) {
      setInfoMessage(successMessage);
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const emailParam = urlParams.get('email') || sessionStorage.getItem('pyq_registered_email');
      const registered = urlParams.get('registered') === 'true' || !!sessionStorage.getItem('pyq_registered_message');

      if (emailParam && !initialEmail) {
        setEmail(emailParam);
      }
      if (registered && !successMessage) {
        setInfoMessage(
          sessionStorage.getItem('pyq_registered_message') ||
          'Your account has been created. Please check your email and verify your address before logging in.'
        );
      }
    } catch {
      // ignore
    }
  }, [initialEmail, successMessage]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message || 'Unable to sign in. Please verify your credentials.');
        setLoading(false);
        return;
      }

      // Only redirect when a real session exists after login
      if (!data?.session) {
        setErrorMessage('Check your email and confirm your account before logging in.');
        setLoading(false);
        return;
      }

      setLoading(false);

      // Clean up registration query parameters and storage
      try {
        sessionStorage.removeItem('pyq_registered_email');
        sessionStorage.removeItem('pyq_registered_message');
        const url = new URL(window.location.href);
        url.searchParams.delete('email');
        url.searchParams.delete('registered');
        window.history.pushState({}, '', url.pathname);
      } catch {
        // ignore
      }

      // Redirect the user to the Home page ("/")
      try {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {
        // ignore
      }

      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'A network error occurred while connecting to Supabase. Please check your connection.'
      );
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await signInWithGoogle();

      if (error) {
        setErrorMessage(error.message || 'Failed to sign in with Google.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred while connecting to Google.');
    }
  };

  return (
    <div
      className={`w-full max-w-md mx-auto bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-2xl p-6 sm:p-7 text-[var(--text-primary)] shadow-lg relative overflow-hidden ${
        isModal ? '' : 'my-6 sm:my-10'
      }`}
    >

      {/* Studify Branding Header */}
      <div className="text-center space-y-3 relative z-10 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-blue-bg)] border border-[var(--border-divider)] flex items-center justify-center mx-auto text-[var(--accent-blue)]">
          <BookOpen className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-mint)] font-semibold">
            Studify Platform
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
            Continue your learning journey with verified past papers and exam resources.
          </p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      {onSwitchToSignUp && (
        <div className="flex bg-[var(--surface-elevated)] p-1 rounded-xl border border-[var(--border-divider)] mb-6 relative z-10">
          <button
            type="button"
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all bg-[var(--surface-main)] text-[var(--text-primary)] shadow-xs border border-[var(--border-divider)]"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            Sign Up
          </button>
        </div>
      )}

      {/* Success Message ABOVE the form if user comes from successful signup */}
      {infoMessage && (
        <div className="p-3.5 rounded-xl bg-[var(--accent-mint-bg)] border border-[var(--accent-mint)]/30 flex items-start gap-2.5 text-[var(--accent-mint)] text-xs text-left mb-4 relative z-10 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* SIGN IN FORM */}
      <form onSubmit={handleSignIn} className="space-y-4 relative z-10">
        {/* Email Address (Pre-filled from signup) */}
        <div className="space-y-1.5 text-left">
          <label htmlFor="signin-email" className="block text-xs font-medium text-[var(--text-secondary)]">
            Email address
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
            />
          </div>
        </div>

        {/* Password with Show/Hide toggle */}
        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between">
            <label htmlFor="signin-password" className="block text-xs font-medium text-[var(--text-secondary)]">
              Password
            </label>
            <button
              type="button"
              className="text-[11px] text-[var(--accent-blue)] hover:underline transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
            <input
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center gap-2 pt-1 text-left">
          <button
            type="button"
            role="checkbox"
            aria-checked={rememberMe}
            onClick={() => setRememberMe(!rememberMe)}
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
              rememberMe
                ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)] text-white dark:text-[#0A2640]'
                : 'bg-[var(--input-bg)] border-[var(--input-border)] hover:border-[var(--border-hover)]'
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

        {/* Prominent Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs sm:text-sm font-bold rounded-xl transition-opacity mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing In...' : 'Log In'}
        </button>

        {/* Error Message Display below form */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/25 flex items-start gap-2.5 text-[var(--color-red)] text-xs text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Divider */}
        <div className="relative my-3 flex items-center justify-center">
          <div className="w-full border-t border-[var(--border-divider)]" aria-hidden="true" />
          <span className="bg-[var(--surface-main)] px-2.5 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider relative z-10">
            or continue with
          </span>
        </div>

        {/* Google Sign-in */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-2 px-3.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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

        {/* Switch to Sign Up */}
        {onSwitchToSignUp && (
          <div className="pt-2 text-center text-xs text-[var(--text-secondary)]">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="font-semibold text-[var(--accent-blue)] hover:underline underline-offset-2 transition-colors ml-1 cursor-pointer"
            >
              Sign up
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default SignIn;
