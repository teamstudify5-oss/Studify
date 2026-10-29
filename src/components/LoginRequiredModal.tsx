import React from 'react';
import { X, Sparkles, BookMarked, UploadCloud, MessageSquare, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
}

export const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
  onCreateAccount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#101B2D]/95 border border-white/[0.16] rounded-3xl max-w-md w-full p-6 sm:p-7 text-[#F8FAFC] shadow-2xl shadow-cyan-950/40 relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#A7B4C8] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Icon & Heading */}
        <div className="text-center space-y-3 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-400/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-6 h-6" />
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F8FAFC]">
            Make Studify Yours
          </h3>

          <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-xs mx-auto">
            Sign in to save papers, manage your library, upload resources, and join the discussion.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-6">
          <button
            onClick={() => {
              onClose();
              onSignIn();
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-cyan-500/25 active:scale-[0.99]"
          >
            Sign In
          </button>

          <button
            onClick={() => {
              onClose();
              onCreateAccount();
            }}
            className="w-full py-3 px-4 bg-[#0A1222] hover:bg-[#15233D] border border-white/[0.14] hover:border-white/[0.24] text-[#F8FAFC] text-xs font-semibold rounded-xl transition-all"
          >
            Create Account
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs text-[#A7B4C8] hover:text-white transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
