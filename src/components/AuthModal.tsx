import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from './AuthCard';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && isAuthModalOpen) {
      closeAuthModal();
    }
  }, [isAuthenticated, isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-md my-auto">
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label="Close authentication dialog"
          className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-[#101B2D] border border-white/[0.2] text-[#A7B4C8] hover:text-white flex items-center justify-center shadow-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* AuthCard with Supabase Auth */}
        <AuthCard initialMode={authModalMode} isModal={true} onSuccess={closeAuthModal} />
      </div>
    </div>
  );
};
