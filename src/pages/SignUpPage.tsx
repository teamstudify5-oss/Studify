import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { AuthCard } from '../components/AuthCard';

interface SignUpPageProps {
  onNavigateToHome?: () => void;
  onNavigateToLogin?: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({
  onNavigateToHome = () => {
    window.location.href = '/';
  },
  onNavigateToLogin = () => {
    window.location.href = '/login';
  },
}) => {
  return (
    <div className="min-h-[85vh] flex flex-col justify-center px-4 sm:px-6 py-10 sm:py-16 relative">
      <div className="max-w-md mx-auto w-full mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateToHome}
          className="inline-flex items-center gap-2 text-xs text-[#A7B4C8] hover:text-[#F8FAFC] transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Studify</span>
        </button>
      </div>

      <AuthCard
        initialMode="signup"
        onSwitchMode={onNavigateToLogin ? () => onNavigateToLogin() : undefined}
        onSuccess={onNavigateToHome}
      />
    </div>
  );
};

export default SignUpPage;
