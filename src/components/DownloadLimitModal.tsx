import React from 'react';
import { Lock, UploadCloud, X, ArrowRight, BookOpen, CheckCircle2, User } from 'lucide-react';
import { DownloadQuota } from '../services/downloadQuotaService';

interface DownloadLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota: DownloadQuota | null;
  isAuthenticated: boolean;
  onNavigateToUpload: () => void;
  onRequireLogin: () => void;
}

export const DownloadLimitModal: React.FC<DownloadLimitModalProps> = ({
  isOpen,
  onClose,
  quota,
  isAuthenticated,
  onNavigateToUpload,
  onRequireLogin,
}) => {
  if (!isOpen) return null;

  const currentUploads = quota?.currentCycleUploads || 0;
  const progressPercent = Math.min(100, Math.round((currentUploads / 2) * 100));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-limit-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-auto bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-3xl shadow-2xl p-6 text-[var(--text-primary)] space-y-5 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header with lock icon */}
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-2xl bg-[var(--color-yellow)]/15 border border-[var(--color-yellow)]/30 text-[var(--color-yellow)] flex items-center justify-center shadow-xs">
            <Lock className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message required by prompt */}
        <div className="space-y-2">
          <h3
            id="download-limit-title"
            className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] leading-snug"
          >
            You've used your 10 free downloads. Upload 2 PDFs to unlock your next 10 downloads!
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Studify is a student-powered community. To keep past papers accessible for everyone, upload 2 unique past question papers or solutions from your school or college.
          </p>
        </div>

        {/* Contribution Progress Tracker: 0/2, 1/2, 2/2 */}
        <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-divider)] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              Contribution Progress
            </span>
            <span className="font-mono font-bold text-[var(--accent-blue)]">
              {currentUploads}/2 PDFs uploaded
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden border border-[var(--border-divider)]">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-yellow)] to-[var(--color-green)] transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>{currentUploads === 0 ? 'Upload 2 PDFs' : currentUploads === 1 ? '1 more PDF needed' : 'Unlocked!'}</span>
            <span>Unlocks +10 Downloads</span>
          </div>
        </div>

        {/* Notice that browsing remains 100% active */}
        <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)] bg-[var(--color-green)]/10 border border-[var(--color-green)]/20 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
          <span>
            You can still browse, search, and read all question papers directly in the web reader. Only direct PDF downloads are locked.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToUpload();
              }}
              className="btn-quad-border w-full py-3 px-4 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload PDF to Unlock ({currentUploads}/2)</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequireLogin();
              }}
              className="btn-quad-border w-full py-3 px-4 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <User className="w-4 h-4" />
              <span>Sign In & Upload 2 PDFs</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-center"
          >
            Continue Browsing Library
          </button>
        </div>
      </div>
    </>
  );
};
