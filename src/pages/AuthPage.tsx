import React from 'react';
import { ArrowLeft, BookOpen, ShieldCheck, Sparkles, FileText } from 'lucide-react';
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
    <div className="min-h-[85vh] flex flex-col justify-center px-4 sm:px-6 py-10 sm:py-16 relative">
      {/* Top back navigation button */}
      <div className="max-w-md mx-auto w-full mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateToHome}
          className="inline-flex items-center gap-2 text-xs text-[#A7B4C8] hover:text-[#F8FAFC] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Studify</span>
        </button>

        <button
          type="button"
          onClick={onNavigateToBrowse}
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Explore Past Papers
        </button>
      </div>

      {/* Main Authentication Card */}
      <AuthCard
        initialMode={initialMode}
        isModal={false}
        onSuccess={onNavigateToHome}
        onSwitchMode={onSwitchMode}
      />

      {/* Reassuring Educational Notice */}
      <div className="max-w-md mx-auto w-full text-center mt-6 text-xs text-[#A7B4C8]/70 flex items-center justify-center gap-3">
        <span>100% Free Public Student Repository</span>
        <span className="text-white/20">·</span>
        <span>No paywalls or forced credentials</span>
      </div>
    </div>
  );
};
