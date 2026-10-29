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

        <div className="bg-[#0A1222] border border-white/[0.1] rounded-2xl p-6 sm:p-8 shadow-xl">
          {step === 'request' && (
            <>
              <div className="mb-6 space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Reset password
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Enter your registered email address to receive password reset instructions.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-xs font-medium text-neutral-300 mb-1.5 text-left"
                  >
                    Email address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[#A7B4C8]/60 absolute left-3.5 pointer-events-none" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      disabled={isLoading}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#101B2D] border border-white/[0.1] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 transition-colors disabled:opacity-60"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-[#050914] text-xs sm:text-sm font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#050914]" />
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    'Send reset instructions'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
                <button
                  type="button"
                  onClick={() => onNavigateToLogin()}
                  className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
