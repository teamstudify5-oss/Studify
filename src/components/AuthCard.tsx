import React, { useState, useEffect } from 'react';
import { BookOpen, Eye, EyeOff, Lock, Mail, User as UserIcon, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
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

  // Check URL query parameters and storage on mount to pre-fill email and show success message if coming from signup
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

  // Sync internal mode if initialMode prop updates
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

  // =========================================================================
  // SIGN IN HANDLER
  // =========================================================================
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return; // Prevent duplicate submissions

    setLoginError(null);

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email || !password) {
      setLoginError('Please enter both your email address and password.');
      return;
    }

    setLoginLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const lowerMsg = (error.message || '').toLowerCase();
        if (lowerMsg.includes('email not confirmed')) {
          setLoginError('Your email address has not been confirmed yet. Please check your inbox for the confirmation email.');
        } else if (lowerMsg.includes('invalid login credentials')) {
          setLoginError('Incorrect email or password. Please verify your credentials and try again.');
        } else {
          setLoginError(error.message || 'Unable to sign in. Please verify your credentials.');
        }
        setLoginLoading(false);
        return;
      }

      // Only redirect when a real session exists after login
      if (!data?.session) {
        setLoginError('Please check your email and confirm your account before logging in.');
        setLoginLoading(false);
        return;
      }

      setLoginLoading(false);

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
      setLoginError(
        err?.message || 'A network error occurred while connecting to authentication service. Please check your connection.'
      );
      setLoginLoading(false);
    }
  };

  // =========================================================================
  // SIGN UP HANDLER
  // =========================================================================
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupLoading) return; // Prevent duplicate submissions

    setSignupError(null);
    setSignupSuccessMessage(null);

    const email = signupEmail.trim();
    const password = signupPassword;
    const confirmPassword = signupConfirmPassword;
    const trimmedName = signupName.trim();

    if (!email || !password) {
      setSignupError('Please provide an email address and password.');
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setSignupError('Please enter a valid email address (e.g. yourname@gmail.com).');
      return;
    }

    if (password.length < 6) {
      setSignupError('Password must be at least 6 characters long.');
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setSignupError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setSignupLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: trimmedName || undefined,
            name: trimmedName || undefined,
          },
        },
      });

      if (error) {
        const errorLower = (error.message || '').toLowerCase();
        if (errorLower.includes('valid') || errorLower.includes('invalid') || error.status === 422) {
          setSignupError('Please provide a valid, active email address (e.g. student@gmail.com).');
        } else if (errorLower.includes('rate limit') || error.status === 429) {
          setSignupError('Too many attempts. Please wait a moment before trying again.');
        } else if (errorLower.includes('already registered')) {
          setSignupError('An account with this email address already exists. Please log in instead.');
        } else {
          setSignupError(error.message || 'Unable to create account. Please check the information provided.');
        }
        setSignupLoading(false);
        return;
      }

      // Check if user already exists (Supabase email enumeration protection returns empty identities array)
      if (data?.user?.identities && data.user.identities.length === 0) {
        setSignupError('An account with this email address already exists. Please log in instead.');
        setSignupLoading(false);
        return;
      }

      // If Supabase automatically creates an active session (e.g. email confirmation disabled or auto-confirmed)
      if (data?.session) {
        setSignupLoading(false);
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/';
        }
        return;
      }

      // Otherwise, an email verification link was sent
      setSignupLoading(false);
      const successMsg =
        'Account created successfully! Please check your email inbox and verify your address before logging in.';

      setLoginEmail(email);
      setLoginSuccessMessage(successMsg);
      setSignupSuccessMessage(successMsg);
      setSignupError(null);
      setLoginError(null);

      try {
        sessionStorage.setItem('pyq_registered_email', email);
        sessionStorage.setItem('pyq_registered_message', successMsg);

        const url = new URL(window.location.href);
        url.pathname = '/login';
        url.searchParams.set('email', email);
        url.searchParams.set('registered', 'true');
        window.history.pushState({ email, registered: true }, '', url.toString());
      } catch {
        // ignore
      }

      setMode('login');
      if (onSwitchMode) {
        onSwitchMode('login');
      }
    } catch (err: any) {
      setSignupError(
        err?.message || 'A network error occurred while connecting. Please try again.'
      );
      setSignupLoading(false);
    }
  };

  // =========================================================================
  // GOOGLE OAUTH HANDLER
  // =========================================================================
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
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-xs mx-auto">
            {mode === 'login'
              ? 'Continue your learning journey with verified past papers and exam resources.'
              : 'Join Studify to find past papers, organize resources, and prepare for your exams.'}
          </p>
        </div>
      </div>

      {/* Screen Mode Tabs (Login / Sign Up) */}
      <div className="flex bg-[#0A1222]/80 p-1 rounded-2xl border border-white/[0.08] mb-6 relative z-10">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            mode === 'login'
              ? 'bg-[#15233D] text-cyan-300 shadow-md border border-cyan-400/30'
              : 'text-[#A7B4C8] hover:text-[#F8FAFC]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode('signup')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            mode === 'signup'
              ? 'bg-[#15233D] text-cyan-300 shadow-md border border-cyan-400/30'
              : 'text-[#A7B4C8] hover:text-[#F8FAFC]'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SIGN IN / LOGIN FORM UI */}
      {/* ========================================================================= */}
      {mode === 'login' ? (
        <div className="space-y-4 relative z-10">
          {/* Clear success message ABOVE the form when user comes from a successful signup */}
          {loginSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs text-left animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{loginSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email Address (Pre-filled from signup) */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="login-email" className="block text-xs font-medium text-[#A7B4C8]">
                Email address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loginLoading}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password with Show/Hide toggle */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-medium text-[#A7B4C8]">
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
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={loginLoading}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 text-[#A7B4C8] hover:text-[#F8FAFC] p-1 transition-colors cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
              disabled={loginLoading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-[#050914] text-xs sm:text-sm font-extrabold rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.99] mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loginLoading ? 'Signing In...' : 'Log In'}
            </button>

            {/* Error Message Display under the form */}
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs text-left animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
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
            <div className="pt-2 text-center text-xs text-[#A7B4C8]">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors ml-1 cursor-pointer"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ========================================================================= */
        /* SIGN UP FORM UI */
        /* ========================================================================= */
        <form onSubmit={handleSignUp} className="space-y-3.5 relative z-10">
          {/* Full Name */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-name" className="block text-xs font-medium text-[#A7B4C8]">
              Full name
            </label>
            <div className="relative flex items-center">
              <UserIcon className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                disabled={signupLoading}
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-email" className="block text-xs font-medium text-[#A7B4C8]">
              Email address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                disabled={signupLoading}
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password with Show/Hide toggle */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-password" className="block text-xs font-medium text-[#A7B4C8]">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
              <input
                id="signup-password"
                type={showSignupPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={signupLoading}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Create a strong password (min 6 chars)"
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword(!showSignupPassword)}
                aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 text-[#A7B4C8] hover:text-[#F8FAFC] p-1 transition-colors cursor-pointer"
              >
                {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5 text-left">
            <label htmlFor="signup-confirm-password" className="block text-xs font-medium text-[#A7B4C8]">
              Confirm password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
              <input
                id="signup-confirm-password"
                type={showSignupConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={signupLoading}
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                aria-label={showSignupConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 text-[#A7B4C8] hover:text-[#F8FAFC] p-1 transition-colors cursor-pointer"
              >
                {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>


          {/* Prominent Create Account Button */}
          <button
            type="submit"
            disabled={signupLoading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-[#050914] text-xs sm:text-sm font-extrabold rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.99] mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {signupLoading ? 'Creating Account...' : 'Create Account'}
          </button>

          {/* Email Confirmation Message Display under the form */}
          {signupSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs text-left animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{signupSuccessMessage}</span>
            </div>
          )}

          {/* Error Message Display under the form */}
          {signupError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-300 text-xs text-left animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{signupError}</span>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t border-white/[0.08]" aria-hidden="true" />
            <span className="bg-[#101B2D] px-3 text-[11px] font-mono text-[#A7B4C8] uppercase tracking-wider relative z-10">
              or sign up with
            </span>
          </div>

          {/* Google Sign-up */}
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
            <span>Sign up with Google</span>
          </button>

          {/* Switch to Login */}
          <div className="pt-2 text-center text-xs text-[#A7B4C8]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors ml-1 cursor-pointer"
            >
              Log in
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
