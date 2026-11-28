import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from './AuthCard';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, isAuthenticated } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const input = modalRef.current?.querySelector<HTMLInputElement>('input');
        input?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeAuthModal();
        } else if (e.key === 'Tab') {
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
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
  }, [isAuthModalOpen, closeAuthModal]);

  useEffect(() => {
    if (isAuthenticated && isAuthModalOpen) {
      closeAuthModal();
    }
  }, [isAuthenticated, isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] overflow-y-auto"
      onClick={closeAuthModal}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account Authentication"
        className="relative w-full max-w-md my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label="Close authentication dialog"
          className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-[var(--surface-main)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center shadow-md transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* AuthCard with Supabase Auth */}
        <AuthCard initialMode={authModalMode} isModal={true} onSuccess={closeAuthModal} />
      </div>
    </div>
  );
};
