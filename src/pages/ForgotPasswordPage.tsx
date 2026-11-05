import React, { useState } from 'react';
import { Loader2, ArrowLeft, CheckCircle2, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient.js';

interface ForgotPasswordPageProps {
  onNavigateToLogin: (prefilledEmail?: string) => void;
  onNavigateToHome?: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigateToLogin,
  onNavigateToHome,
}) => {
  const [step, setStep] = useState<'request' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid, active email address.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setErrorMessage(error.message || 'Unable to send reset instructions. Please check the email address.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setStep('success');
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'A network error occurred while connecting. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center items-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm">
        <button
          onClick={() => (onNavigateToHome ? onNavigateToHome() : onNavigateToLogin())}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to log in</span>
        </button>

        <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-2xl p-6 sm:p-7 shadow-lg">
          {step === 'request' && (
            <>
              <div className="mb-5 space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  Reset password
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                  Enter your registered email address to receive password reset instructions.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-2.5 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1 text-left"
                  >
                    Email address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 pointer-events-none" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      disabled={isLoading}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-60"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-2.5 px-4 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#1C2530] text-xs font-semibold rounded-lg transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    'Send reset instructions'
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-[var(--border-divider)] text-center">
                <button
                  type="button"
                  onClick={() => onNavigateToLogin()}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  Remember your password? Log in
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-white">
                  Reset link sent
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-xs mx-auto">
                  If an account exists for <span className="text-white font-medium">{email}</span>, you will receive an email with instructions to reset your password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToLogin(email)}
                className="w-full py-2.5 px-4 bg-white hover:bg-neutral-200 text-black text-xs sm:text-sm font-semibold rounded-xl transition-all mt-4 cursor-pointer"
              >
                Return to log in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
