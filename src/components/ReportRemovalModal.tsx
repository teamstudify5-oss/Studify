import React, { useState } from 'react';
import { X, AlertTriangle, Send, CheckCircle2, ShieldAlert, FileText, User } from 'lucide-react';
import { Paper } from '../types';
import { RemovalReasonCategory } from '../types/removal';
import { removalService } from '../services/removalService';
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
    label: 'Copyright or Ownership Dispute',
    description: 'This document infringes intellectual property or proprietary rights.',
  },
  {
    value: 'incorrect_solution',
    label: 'Incorrect Answer Key / Solution',
    description: 'The marking scheme or answers contain errors or misleading guidance.',
  },
  {
    value: 'poor_quality',
    label: 'Illegible Scan / Poor Quality',
    description: 'Unreadable text, blurry handwriting, or truncated pages.',
  },
  {
    value: 'duplicate',
    label: 'Duplicate Paper',
    description: 'This exact question paper already exists on the platform.',
  },
  {
    value: 'outdated_syllabus',
    label: 'Outdated or Inaccurate Syllabus / Metadata',
    description: 'Incorrect year, board, subject tag, or deleted curriculum topics.',
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Spam, non-educational material, or offensive marks.',
  },
  {
    value: 'other',
    label: 'Other Reason',
    description: 'Another specific issue requiring uploader intervention.',
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      setErrorMessage('Please provide a specific reason explaining why this paper should be removed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await removalService.createRequest({
        paper,
        reporterName: reporterName.trim() || 'Student Contributor',
        reporterEmail: reporterEmail.trim(),
        reasonCategory: category,
        reasonDetails: details.trim(),
      });

      setIsSuccess(true);
      if (onRequestSubmitted) {
        onRequestSubmitted();
      }
    } catch (err) {
      console.error('Failed to create removal request', err);
      setErrorMessage('Could not deliver removal request. Please try again.');
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

  const uploaderName = paper.submittedBy?.name || 'Uploader';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={handleResetAndClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0D1526] border border-white/[0.14] rounded-2xl shadow-2xl overflow-hidden text-[#F8FAFC]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-[#101B2D]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">
                Request Paper Removal
              </h2>
              <p className="text-xs text-[#A7B4C8]">
                Sent directly to the uploader's account
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-[#A7B4C8] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#F8FAFC]">
              Removal Request Sent
            </h3>
            <p className="text-xs sm:text-sm text-[#A7B4C8] max-w-md mx-auto leading-relaxed">
              Your removal request has been delivered directly to{' '}
              <span className="font-semibold text-white">{uploaderName}</span>'s account inbox.
              They have been prompted to review your feedback and remove or update the paper.
            </p>
            <div className="pt-2">
              <button
                onClick={handleResetAndClose}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Target Paper & Uploader Context Box */}
            <div className="p-3.5 rounded-xl bg-[#142036] border border-white/[0.08] text-xs space-y-1.5">
              <div className="font-semibold text-[#F8FAFC] line-clamp-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{paper.title}</span>
              </div>
              <div className="text-[11px] text-[#A7B4C8] flex flex-wrap items-center gap-2">
                <span>{paper.examBoard}</span>
                <span>·</span>
                <span>{paper.subject} ({paper.year})</span>
                <span>·</span>
                <span className="text-amber-300 font-medium">
                  Posted by: {uploaderName}
                </span>
              </div>
            </div>

            {/* Explanatory Notice */}
            <p className="text-xs text-[#A7B4C8] leading-relaxed">
              Found an issue or need this paper removed? Select the reason below. Your request will be
              delivered to <strong className="text-white">{uploaderName}</strong>'s account dashboard,
              giving them the option to delete or update the document.
            </p>

            {/* Reason Category Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#F8FAFC]">
                Reason for Removal Request <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {REASON_CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      category === cat.value
                        ? 'bg-cyan-500/10 border-cyan-400/50 text-[#F8FAFC]'
                        : 'bg-[#101B2D]/60 border-white/[0.08] hover:border-white/[0.16] text-[#A7B4C8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="removalCategory"
                      value={cat.value}
                      checked={category === cat.value}
                      onChange={() => setCategory(cat.value)}
                      className="mt-0.5 text-cyan-400 focus:ring-cyan-500"
                    />
                    <div>
                      <div className="font-semibold text-[#F8FAFC]">{cat.label}</div>
                      <div className="text-[11px] text-[#A7B4C8] mt-0.5">{cat.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Detailed Reason Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#F8FAFC]">
                Specific Explanation & Details <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Explain why this paper should be removed (e.g. specific question errors, copyright claim, illegible pages)..."
                rows={3}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#101B2D] border border-white/[0.14] focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs text-[#F8FAFC] placeholder-[#A7B4C8]/60 transition-all outline-none"
              />
            </div>

            {/* Reporter Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#A7B4C8]">
                  Your Name
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="e.g. Rahul S."
                  className="w-full px-3 py-2 rounded-xl bg-[#101B2D] border border-white/[0.14] focus:border-cyan-400 text-xs text-[#F8FAFC] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#A7B4C8]">
                  Your Email (optional)
                </label>
                <input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-[#101B2D] border border-white/[0.14] focus:border-cyan-400 text-xs text-[#F8FAFC] outline-none"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 text-xs font-semibold text-[#A7B4C8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-950/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending Request...' : 'Send Request to Uploader'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
