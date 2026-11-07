import React, { useState, useEffect } from 'react';
import { Star, X, Check, Loader2 } from 'lucide-react';
import { appFeedbackService, FeedbackSummary } from '../services/appFeedbackService';

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
  const [selectedStars, setSelectedStars] = useState<number>(0);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [isSavingRating, setIsSavingRating] = useState<boolean>(false);
  const [isSavingComment, setIsSavingComment] = useState<boolean>(false);
  const [ratingSavedStatus, setRatingSavedStatus] = useState<string | null>(null);
  const [commentSavedStatus, setCommentSavedStatus] = useState<string | null>(null);

  // Load existing visitor feedback when opened
  useEffect(() => {
    if (isOpen) {
      appFeedbackService.getFeedbackSummary().then((summary) => {
        if (summary.userRating) {
          setSelectedStars(summary.userRating);
        }
        if (summary.userComment) {
          setCommentText(summary.userComment);
        }
      });
      setRatingSavedStatus(null);
      setCommentSavedStatus(null);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStarClick = async (starVal: number) => {
    setSelectedStars(starVal);
    setIsSavingRating(true);
    setRatingSavedStatus(null);

    const result = await appFeedbackService.saveStarRating(starVal);
    setIsSavingRating(false);

    if (result.success) {
      setRatingSavedStatus('Rating saved! Thank you.');
      const updatedSummary = await appFeedbackService.getFeedbackSummary();
      if (onFeedbackSaved) {
        onFeedbackSaved(updatedSummary);
      }
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSavingComment(true);
    setCommentSavedStatus(null);

    const result = await appFeedbackService.saveComment(commentText);
    setIsSavingComment(false);

    if (result.success) {
      setCommentSavedStatus('Comment saved!');
      const updatedSummary = await appFeedbackService.getFeedbackSummary();
      if (onFeedbackSaved) {
        onFeedbackSaved(updatedSummary);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    }
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
        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Panel sliding up from the bottom */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-bottom-sheet-title"
        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-lg mx-auto bg-[var(--surface-main)] border-t sm:border-x border-[var(--border-divider)] rounded-t-3xl shadow-2xl p-5 sm:p-6 text-[var(--text-primary)] transition-transform duration-300 ease-out transform translate-y-0"
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
              How has your experience been with Studify?
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Public feedback on the platform · No sign-in required
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
            aria-label="Close feedback panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 5 Selectable Stars */}
        <div className="py-2 flex flex-col items-center justify-center space-y-2">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((starVal) => {
              const isFilled = starVal <= currentDisplayStars;
              return (
                <button
                  key={starVal}
                  type="button"
                  onClick={() => handleStarClick(starVal)}
                  onMouseEnter={() => setHoverStars(starVal)}
                  onMouseLeave={() => setHoverStars(null)}
                  className="p-2 sm:p-2.5 rounded-xl hover:scale-110 active:scale-95 transition-all cursor-pointer bg-[var(--surface-secondary)] border border-[var(--border-divider)]"
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
              <span className="font-semibold text-[var(--text-primary)] font-mono">
                {currentDisplayStars} Stars — {starLabels[currentDisplayStars]}
              </span>
            ) : (
              <span className="text-[var(--text-muted)] text-[11px]">
                Tap a star to save your rating instantly
              </span>
            )}
          </div>
        </div>

        {/* Optional Comment Section */}
        <form onSubmit={handleCommentSubmit} className="mt-4 pt-3 border-t border-[var(--border-divider)] space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center justify-between">
              <span>Tell us what you liked or how we can improve</span>
              <span className="text-[10px] text-[var(--text-muted)] font-normal">Optional</span>
            </label>
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value.slice(0, 350))}
              placeholder="Share your thoughts on speed, navigation, or PYQ coverage..."
              className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] resize-none"
            />
            <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--text-muted)]">
              <span>Star rating is already saved. Comments are optional.</span>
              <span>{commentText.length}/350</span>
            </div>
          </div>

          {commentSavedStatus && (
            <div className="p-2 bg-[var(--color-green)]/15 border border-[var(--color-green)]/30 rounded-lg text-xs text-[var(--color-green)] flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{commentSavedStatus}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-quad-border px-3.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSavingComment || !commentText.trim()}
              className="btn-quad-border px-4 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              {isSavingComment ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Comment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
