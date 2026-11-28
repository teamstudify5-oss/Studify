import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  isBusy?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Delete Permanently',
  busyLabel = 'Processing...',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isBusy = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const isBusyRef = useRef(isBusy);

  onCancelRef.current = onCancel;
  isBusyRef.current = isBusy;

  useEffect(() => {
    if (!isOpen) {
      if (triggerRef.current) {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
      return;
    }

    triggerRef.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    const timer = setTimeout(() => cancelBtnRef.current?.focus(), 40);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusyRef.current) {
        onCancelRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isPrimary = tone === 'primary';

  const dialogContent = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs"
      role="presentation"
      onClick={() => {
        if (!isBusy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-2xl max-w-md w-full p-5 space-y-4 text-xs text-[var(--text-primary)] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-divider)]">
          <h3
            id="confirm-dialog-title"
            className={`font-semibold text-sm flex items-center gap-2 ${
              isPrimary ? 'text-[var(--accent-blue)]' : 'text-[var(--color-red)]'
            }`}
          >
            {isPrimary ? (
              <RotateCcw className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg cursor-pointer disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{description}</p>

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] break-words">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="px-3.5 py-1.5 border border-[var(--border-divider)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer disabled:opacity-40 btn-quad-border"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`px-4 py-1.5 text-white font-semibold rounded-lg transition-opacity shadow-xs cursor-pointer disabled:opacity-50 btn-quad-border ${
              isPrimary ? 'bg-[var(--accent-blue)] hover:opacity-90' : 'bg-[var(--color-red)] hover:opacity-90'
            }`}
          >
            {isBusy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(dialogContent, document.body);
  }

  return dialogContent;
};
