import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Send, CheckCircle2, ShieldAlert, FileText, User } from 'lucide-react';
import { Paper } from '../types';
import { RemovalReasonCategory } from '../types/removal';
import { removalService } from '../services/removalService';
import { supabaseDb } from '../services/supabaseDb';
import { useAuth } from '../context/AuthContext';

interface ReportRemovalModalProps {
  paper: Paper;
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted?: () => void;
}

const REASON_CATEGORIES: { value: RemovalReasonCategory; label: string; description: string }[] = [
  {
    value: 'copyright',
    label: 'Copyright concern',
    description: 'Document infringes intellectual property or proprietary rights.',
  },
  {
    value: 'incorrect_content',
    label: 'Incorrect content',
    description: 'The questions, marking schemes, or answers contain errors or misleading guidance.',
  },
  {
    value: 'poor_quality',
    label: 'Poor quality',
    description: 'Unreadable text, blurry scan, illegible handwriting, or missing pages.',
  },
  {
    value: 'duplicate',
    label: 'Duplicate document',
    description: 'This exact question paper already exists on Studify.',
  },
  {
    value: 'spam',
    label: 'Spam',
    description: 'Promotional material, irrelevant advertising, or non-educational content.',
  },
  {
    value: 'unsafe_file',
    label: 'Unsafe file',
    description: 'Corrupted document, harmful scripts, suspicious redirects, or malicious code.',
  },
  {
    value: 'privacy_violation',
    label: 'Privacy violation',
    description: 'Contains confidential student information, personal contact numbers, or unredacted IDs.',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Another specific issue requiring administrative review.',
  },
];

export const ReportRemovalModal: React.FC<ReportRemovalModalProps> = ({
  paper,
  isOpen,
  onClose,
  onRequestSubmitted,
}) => {
  const { currentUser } = useAuth();
  const [category, setCategory] = useState<RemovalReasonCategory>('copyright');
  const [details, setDetails] = useState('');
  const [reporterName, setReporterName] = useState(currentUser?.name || '');
  const [reporterEmail, setReporterEmail] = useState(currentUser?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Capture trigger element and manage focus / escape key (Bug 18)
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement;
      // Focus first interactive element inside modal
      const timer = setTimeout(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
          focusable[0].focus();
        }
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleResetAndClose();
        } else if (e.key === 'Tab') {
          // Focus trap
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else if (triggerElementRef.current) {
      triggerElementRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      setErrorMessage('Please provide a specific explanation describing the issue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Submit report to Supabase DB
      await supabaseDb.submitReport({
        paperId: paper.id,
        reasonCategory: category,
        reasonDetails: details.trim(),
        reporterEmail: reporterEmail.trim(),
        reporterName: reporterName.trim() || 'Student Contributor',
      });

      // 2. Also register in local removalService for notifications
      try {
        await removalService.createRequest({
          paper,
          reporterName: reporterName.trim() || 'Student Contributor',
          reporterEmail: reporterEmail.trim(),
          reasonCategory: category,
          reasonDetails: details.trim(),
        });
      } catch (localErr) {
        console.warn('Local removal service synced via DB', localErr);
      }

      setIsSuccess(true);
      if (onRequestSubmitted) {
        onRequestSubmitted();
      }
    } catch (err: any) {
      console.error('Failed to submit report', err);
      if (err?.message?.includes('already been submitted')) {
        setErrorMessage('A report for this document is already under review by moderators.');
      } else {
        setErrorMessage(err?.message || 'Could not deliver report. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setIsSuccess(false);
    setDetails('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={handleResetAndClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="relative w-full max-w-lg bg-[var(--surface-main)]/95 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl shadow-xl overflow-hidden text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-divider)] bg-[var(--surface-elevated)]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-red)]/15 border border-[var(--accent-red)]/30 flex items-center justify-center text-[var(--color-red)]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 id="report-modal-title" className="text-base font-bold text-[var(--text-primary)]">
                Report Document
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Submit evidence for administrative moderation and review
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer btn-quad-border"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-green)]/15 border border-[var(--color-green)]/30 text-[var(--color-green)] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              Report Submitted for Review
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
              Your report has been securely registered in the moderation queue. The document team will review the issue and take action if guidelines are violated.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-6 py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer btn-quad-border"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Paper Overview */}
            <div className="p-3 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl flex items-center gap-3">
              <FileText className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[var(--text-primary)] truncate text-xs">
                  {paper.title}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {paper.examBoard} · {paper.grade} · {paper.subject} ({paper.year})
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-[var(--accent-red)]/15 border border-[var(--accent-red)]/30 rounded-xl text-xs text-[var(--accent-red)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--accent-red)]" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Reason Category Picker */}
            <div className="space-y-1.5">
              <label htmlFor="report-category" className="font-semibold text-[var(--text-primary)] block">
                Primary Issue Category <span className="text-[var(--accent-red)]">*</span>
              </label>
              <select
                id="report-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as RemovalReasonCategory)}
                className="w-full px-3 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] text-xs cursor-pointer"
              >
                {REASON_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {REASON_CATEGORIES.find((c) => c.value === category)?.description}
              </p>
            </div>

            {/* Reason Details */}
            <div className="space-y-1.5">
              <label htmlFor="report-details" className="font-semibold text-[var(--text-primary)] block">
                Describe the specific issue <span className="text-[var(--accent-red)]">*</span>
              </label>
              <textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Please describe page numbers, incorrect questions, or copyright details..."
                rows={3}
                required
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-blue)] text-xs resize-none"
              />
            </div>

            {/* Reporter Info (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label htmlFor="reporter-name" className="text-[11px] text-[var(--text-secondary)] block">
                  Your Name (optional)
                </label>
                <input
                  id="reporter-name"
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Anonymous Student"
                  className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] text-xs"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="reporter-email" className="text-[11px] text-[var(--text-secondary)] block">
                  Your Email (for updates)
                </label>
                <input
                  id="reporter-email"
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] text-xs"
                />
              </div>
            </div>

            {/* Form Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-divider)]">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[var(--border-divider)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer btn-quad-border"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !details.trim()}
                className="px-5 py-2 bg-[var(--color-red)] hover:opacity-90 text-white font-semibold rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer btn-quad-border"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
