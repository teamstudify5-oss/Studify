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
      className={`w-full max-w-md mx-auto bg-[#101B2D]/95 border border-white/[0.14] rounded-3xl p-6 sm:p-8 text-[#F8FAFC] shadow-2xl shadow-cyan-950/40 relative overflow-hidden backdrop-blur-xl ${
        isModal ? '' : 'my-8 sm:my-12'
      }`}
    >
      {/* Subtle Ambient Decorative Lighting */}
      <div
        className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-teal-500/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Studify Branding Header */}
      <div className="text-center space-y-3 relative z-10 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-teal-500/15 to-emerald-500/10 border border-cyan-400/30 flex items-center justify-center mx-auto text-cyan-300 shadow-lg shadow-cyan-500/15">
          <BookOpen className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
            Studify Platform
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-xs mx-auto">
            Continue your learning journey with verified past papers and exam resources.
          </p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      {onSwitchToSignUp && (
        <div className="flex bg-[#0A1222]/80 p-1 rounded-2xl border border-white/[0.08] mb-6 relative z-10">
          <button
            type="button"
            className="flex-1 py-2 text-xs font-semibold rounded-xl transition-all bg-[#15233D] text-cyan-300 shadow-md border border-cyan-400/30"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="flex-1 py-2 text-xs font-semibold rounded-xl transition-all text-[#A7B4C8] hover:text-[#F8FAFC] cursor-pointer"
          >
            Sign Up
          </button>
        </div>
      )}

      {/* Success Message ABOVE the form if user comes from successful signup */}
      {infoMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs text-left mb-4 relative z-10 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* SIGN IN FORM */}
      <form onSubmit={handleSignIn} className="space-y-4 relative z-10">
        {/* Email Address (Pre-filled from signup) */}
        <div className="space-y-1.5 text-left">
          <label htmlFor="signin-email" className="block text-xs font-medium text-[#A7B4C8]">
            Email address
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
            />
          </div>
        </div>

        {/* Password with Show/Hide toggle */}
        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between">
            <label htmlFor="signin-password" className="block text-xs font-medium text-[#A7B4C8]">
              Password
            </label>
            <button
              type="button"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
            <input
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 text-[#A7B4C8] hover:text-[#F8FAFC] p-1 transition-colors cursor-pointer"
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
            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
              rememberMe
                ? 'bg-cyan-500 border-cyan-400 text-[#050914]'
                : 'bg-[#0A1222] border-white/[0.2] hover:border-white/[0.3]'
            }`}
          >
            {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
          </button>
          <label
            onClick={() => setRememberMe(!rememberMe)}
            className="text-xs text-[#A7B4C8] cursor-pointer select-none"
          >
            Remember me
          </label>
        </div>

        {/* Prominent Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-[#050914] text-xs sm:text-sm font-extrabold rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.99] mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing In...' : 'Log In'}
        </button>

        {/* Error Message Display below form */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t border-white/[0.08]" aria-hidden="true" />
          <span className="bg-[#101B2D] px-3 text-[11px] font-mono text-[#A7B4C8] uppercase tracking-wider relative z-10">
            or continue with
          </span>
        </div>

        {/* Google Sign-in */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-2.5 px-4 bg-[#0A1222] hover:bg-[#15233D] border border-white/[0.12] hover:border-white/[0.2] text-[#F8FAFC] text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer"
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
          <div className="pt-2 text-center text-xs text-[#A7B4C8]">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors ml-1 cursor-pointer"
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
