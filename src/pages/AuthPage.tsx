import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { AuthCard } from '../components/AuthCard';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  onNavigateToHome: () => void;
  onNavigateToBrowse: () => void;
  onSwitchMode?: (mode: 'login' | 'signup') => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onNavigateToHome,
  onNavigateToBrowse,
  onSwitchMode,
}) => {
  return (
    <div className="min-h-[85vh] flex flex-col justify-center px-4 sm:px-6 py-10 sm:py-16 relative text-[var(--text-primary)]">
      {/* Top back navigation button */}
      <div className="max-w-md mx-auto w-full mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateToHome}
          className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors group cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] btn-quad-border"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Studify</span>
        </button>

        <button
          type="button"
          onClick={onNavigateToBrowse}
          className="text-xs text-[var(--accent-blue)] hover:underline transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] btn-quad-border"
        >
          Explore Library
        </button>
      </div>

      {/* Main Authentication Card */}
      <AuthCard
        initialMode={initialMode}
        isModal={false}
        onSuccess={onNavigateToHome}
        onSwitchMode={onSwitchMode}
      />

      {/* Educational Notice */}
      <div className="max-w-md mx-auto w-full text-center mt-6 text-xs text-[var(--text-secondary)] flex items-center justify-center gap-3">
        <span>Free Public Student Repository</span>
        <span>·</span>
        <span>No paywalls or forced credentials</span>
      </div>
    </div>
  );
};
