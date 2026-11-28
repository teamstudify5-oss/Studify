import React, { useState, useEffect } from 'react';
import { Star, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { appFeedbackService, FeedbackSummary } from '../services/appFeedbackService';
import { useAuth } from '../context/AuthContext';

interface AppFeedbackBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedbackSaved?: (summary: FeedbackSummary) => void;
}

export const AppFeedbackBottomSheet: React.FC<AppFeedbackBottomSheetProps> = ({
  isOpen,
  onClose,
  onFeedbackSaved,
}) => {
  const { currentUser } = useAuth();
  const [selectedStars, setSelectedStars] = useState<number>(0);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [authorName, setAuthorName] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [isSavingRating, setIsSavingRating] = useState<boolean>(false);
  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);
  const [ratingSavedStatus, setRatingSavedStatus] = useState<string | null>(null);
  const [reviewSavedStatus, setReviewSavedStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load existing visitor feedback when opened
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    setRatingSavedStatus(null);
    setReviewSavedStatus(null);
    setSaveError(null);

    appFeedbackService.getFeedbackSummary().then((summary) => {
      if (!active) return;
      setSelectedStars(summary.userRating ?? 0);
      setCommentText(summary.userComment || '');
      setAuthorName(summary.userAuthorName || currentUser?.name || '');
    });

    return () => {
      active = false;
    };
  }, [isOpen, currentUser?.name]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSavingRating && !isSavingReview) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSavingRating, isSavingReview, onClose]);

  if (!isOpen) return null;

  const handleStarClick = async (starVal: number) => {
    setSelectedStars(starVal);
    setIsSavingRating(true);
    setRatingSavedStatus(null);
    setSaveError(null);

    const result = await appFeedbackService.submitFeedback({
      rating: starVal,
      authorName: authorName.trim() || currentUser?.name || undefined,
    });
    setIsSavingRating(false);

    if (!result.success) {
      setSaveError(
        result.error?.message || 'Could not save your rating right now. Please try again.'
      );
      return;
    }

    setRatingSavedStatus('Rating saved! Thank you.');
    const updatedSummary = await appFeedbackService.getFeedbackSummary();
    onFeedbackSaved?.(updatedSummary);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingReview) return;

    if (selectedStars < 1 || selectedStars > 5) {
      setSaveError('Please select a 1 to 5 star rating above first.');
      return;
    }

    setIsSavingReview(true);
    setReviewSavedStatus(null);
    setSaveError(null);

    const result = await appFeedbackService.submitFeedback({
      rating: selectedStars,
      comment: commentText,
      authorName: authorName.trim() || currentUser?.name || 'Student',
    });
    setIsSavingReview(false);

    if (!result.success) {
      setSaveError(
        result.error?.message || 'Could not save your review right now. Please try again.'
      );
      return;
    }

    setReviewSavedStatus('Review published! Thank you.');
    const updatedSummary = await appFeedbackService.getFeedbackSummary();
    onFeedbackSaved?.(updatedSummary);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const starLabels: Record<number, string> = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent!',
  };

  const currentDisplayStars = hoverStars !== null ? hoverStars : selectedStars;

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-[var(--modal-backdrop)] z-50 transition-opacity duration-200"
        onClick={() => {
          if (!isSavingRating && !isSavingReview) onClose();
        }}
        aria-hidden="true"
      />

      {/* Bottom Sheet Panel sliding up from the bottom */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-bottom-sheet-title"
        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-lg mx-auto bg-[var(--modal-bg)] border-t sm:border-x border-[var(--border-divider)] rounded-t-2xl shadow-xl p-5 sm:p-6 text-[var(--text-primary)]"
      >
        {/* Subtle drag handle bar */}
        <div className="w-10 h-1 bg-[var(--text-muted)]/30 rounded-full mx-auto mb-4" />

        {/* Header with Title and Close Button */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3
              id="feedback-bottom-sheet-title"
              className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]"
            >
              Rate &amp; Review Studify
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Public feedback visible to everyone · No sign-in required
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingRating || isSavingReview}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close feedback panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {saveError && (
          <div className="mb-3 p-2.5 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}

        {/* 5 Selectable Stars */}
        <div className="py-2 flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((starVal) => {
              const isFilled = starVal <= currentDisplayStars;
              return (
                <button
                  key={starVal}
                  type="button"
                  disabled={isSavingRating || isSavingReview}
                  onClick={() => handleStarClick(starVal)}
                  onMouseEnter={() => setHoverStars(starVal)}
                  onMouseLeave={() => setHoverStars(null)}
                  className="p-2 sm:p-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer bg-[var(--surface-secondary)] border border-[var(--border-divider)] disabled:opacity-60"
                  aria-label={`Rate ${starVal} out of 5 stars`}
                >
                  <Star
                    className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                      isFilled
                        ? 'text-[var(--color-yellow)] fill-[var(--color-yellow)]'
                        : 'text-[var(--text-muted)] opacity-35'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Rating label & feedback notice */}
          <div className="h-5 flex items-center justify-center text-xs">
            {isSavingRating ? (
              <span className="text-[var(--accent-blue)] flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving rating...</span>
              </span>
            ) : ratingSavedStatus ? (
              <span className="text-[var(--color-green)] font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{ratingSavedStatus}</span>
              </span>
            ) : currentDisplayStars > 0 ? (
              <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                {currentDisplayStars} / 5 — {starLabels[currentDisplayStars]}
              </span>
            ) : (
              <span className="text-[var(--text-muted)] text-[11px]">
                Tap a star to save your rating immediately
              </span>
            )}
          </div>
        </div>

        {/* Display Name & Review Comment Form */}
        <form
          onSubmit={handleReviewSubmit}
          className="mt-4 pt-3 border-t border-[var(--border-divider)] space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Display Name <span className="text-[var(--text-muted)] font-normal">(Optional — defaults to Student)</span>
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value.slice(0, 60))}
              placeholder="e.g., Aarav Sharma or Guest Student"
              className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center justify-between">
              <span>Your Public Review</span>
              <span className="text-[10px] text-[var(--text-muted)] font-normal tabular-nums">
                {commentText.length}/500
              </span>
            </label>
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
              placeholder="Share what helped you or what we can improve..."
              className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
            />
          </div>

          {reviewSavedStatus && (
            <div className="p-2 bg-[var(--accent-green-bg)] border border-[var(--color-green)]/30 rounded-lg text-xs text-[var(--color-green)] flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{reviewSavedStatus}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingRating || isSavingReview}
              className="px-3.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg border border-[var(--border-divider)] bg-[var(--surface-elevated)] cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSavingReview || isSavingRating || selectedStars < 1}
              className="px-4 py-2 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs font-semibold rounded-lg transition-opacity flex items-center gap-1.5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              {isSavingReview ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <span>Submit Review</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
