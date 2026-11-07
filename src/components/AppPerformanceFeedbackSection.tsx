import React, { useState, useEffect } from 'react';
import { Star, MessageSquarePlus, Activity } from 'lucide-react';
import { appFeedbackService, FeedbackSummary } from '../services/appFeedbackService';
import { AppFeedbackBottomSheet } from './AppFeedbackBottomSheet';

export const AppPerformanceFeedbackSection: React.FC = () => {
  const [summary, setSummary] = useState<FeedbackSummary>({
    averageRating: null,
    totalRatings: 0,
    userRating: null,
    userComment: '',
    items: [],
  });
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFeedback();

    const handleOpen = () => setIsBottomSheetOpen(true);
    window.addEventListener('open-studify-feedback', handleOpen);
    return () => window.removeEventListener('open-studify-feedback', handleOpen);
  }, []);

  const loadFeedback = async () => {
    setIsLoading(true);
    const data = await appFeedbackService.getFeedbackSummary();
    setSummary(data);
    setIsLoading(false);
  };

  const handleFeedbackSaved = (updated: FeedbackSummary) => {
    setSummary(updated);
  };

  const itemsWithComments = summary.items.filter((item) => item.comment && item.comment.trim().length > 0);

  return (
    <section className="px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
      {/* Small, clearly visible rating banner on main page */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent-blue)]">
              <Activity className="w-3.5 h-3.5" />
              <span>Studify Experience</span>
            </span>

            {/* Display actual average rating only if actual ratings exist */}
            {summary.averageRating !== null && summary.totalRatings > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-xs font-mono font-bold text-[var(--color-yellow)]">
                <Star className="w-3 h-3 fill-current" />
                <span>{summary.averageRating.toFixed(1)}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-normal">
                  ({summary.totalRatings} {summary.totalRatings === 1 ? 'rating' : 'ratings'})
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                (No ratings yet)
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Rate Your Studify Experience
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md">
            Help us improve search speed, reading tools, and mobile usability. Completely open to visitors — no account needed.
          </p>
        </div>

        {/* Small visible star button trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsBottomSheetOpen(true)}
            className="btn-quad-border px-4 py-2.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Star className="w-4 h-4 text-[var(--color-yellow)] fill-[var(--color-yellow)]" />
            <span>{summary.userRating ? `Your Rating (${summary.userRating}★)` : 'Rate Studify'}</span>
          </button>
        </div>
      </div>

      {/* Actual reviews only — strictly NO fabricated data */}
      {itemsWithComments.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Community Feedback ({itemsWithComments.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {itemsWithComments.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--surface-main)]/80 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1 text-[var(--color-yellow)]">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s <= item.rating ? 'fill-current' : 'text-[var(--text-muted)] opacity-30'
                        }`}
                      />
                    ))}
                    <span className="font-mono text-[var(--text-primary)] font-semibold ml-1">
                      {item.rating}.0
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-[var(--text-primary)] leading-relaxed">
                  "{item.comment}"
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bottom Sheet Modal */}
      <AppFeedbackBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        onFeedbackSaved={handleFeedbackSaved}
      />
    </section>
  );
};
