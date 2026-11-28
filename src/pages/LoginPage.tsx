import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { AuthCard } from '../components/AuthCard';

interface LoginPageProps {
  onNavigateToHome?: () => void;
  onNavigateToSignUp?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateToHome = () => {
    window.location.href = '/';
  },
  onNavigateToSignUp = () => {
    window.location.href = '/signup';
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
        initialMode="login"
        onSwitchMode={onNavigateToSignUp ? () => onNavigateToSignUp() : undefined}
        onSuccess={onNavigateToHome}
      />
    </div>
  );
};

export default LoginPage;
