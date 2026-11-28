import React, { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>('button');
        firstFocusable?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Tab') {
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
        className="bg-[var(--surface-main)]/95 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl max-w-sm w-full p-6 text-[var(--text-primary)] shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="btn-quad-border p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2 pt-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>

          <h3 id="login-required-title" className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Make Studify Yours
          </h3>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
            Sign in to bookmark questions, manage your study workspace, upload resources, and collaborate.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-5">
          <button
            onClick={() => {
              onClose();
              onSignIn();
            }}
            className="btn-quad-border w-full py-2.5 px-4 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-opacity shadow-xs active:scale-[0.99] cursor-pointer"
          >
            Sign In
          </button>

          <button
            onClick={() => {
              onClose();
              onCreateAccount();
            }}
            className="btn-quad-border w-full py-2.5 px-4 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Create Account
          </button>

          <button
            onClick={onClose}
            className="btn-quad-border w-full py-2 px-4 bg-[var(--surface-secondary)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
