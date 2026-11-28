import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  MessageSquarePlus,
  AlertCircle,
  RotateCcw,
  BadgeCheck,
  Reply,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  appFeedbackService,
  emptyBreakdown,
  FeedbackSummary,
  getVisitorId,
  StarTier,
} from '../services/appFeedbackService';
import { AppFeedbackBottomSheet } from './AppFeedbackBottomSheet';
import { useAuth } from '../context/AuthContext';

const STAR_TIERS: StarTier[] = [5, 4, 3, 2, 1];

const PartialStarRow: React.FC<{ value: number; sizeClass?: string }> = ({
  value,
  sizeClass = 'w-4 h-4',
}) => {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${clamped.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((idx) => {
        const fillPercent = Math.max(0, Math.min(1, clamped - (idx - 1))) * 100;
        return (
          <span key={idx} className={`relative inline-block ${sizeClass} shrink-0`}>
            <Star
              className={`${sizeClass} text-[var(--text-muted)] opacity-25`}
              aria-hidden="true"
            />
            {fillPercent > 0 && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillPercent}%` }}
              >
                <Star
                  className={`${sizeClass} text-[var(--color-yellow)] fill-[var(--color-yellow)]`}
                  aria-hidden="true"
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};

export const AppPerformanceFeedbackSection: React.FC = () => {
  const { isOwner } = useAuth();
  const [summary, setSummary] = useState<FeedbackSummary>({
    averageRating: null,
    totalRatings: 0,
    totalReviews: 0,
    ratingBreakdown: emptyBreakdown(),
    userRating: null,
    userComment: '',
    userAuthorName: '',
    items: [],
    loadError: null,
  });
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [starFilter, setStarFilter] = useState<StarTier | null>(null);
  const currentVisitorId = useMemo(() => getVisitorId(), []);

  // Studify Main Account (Owner-only) inline reply state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const loadFeedback = async () => {
    setIsLoading(true);
    const data = await appFeedbackService.getFeedbackSummary();
    setSummary(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFeedback();

    const handleOpen = () => setIsBottomSheetOpen(true);
    window.addEventListener('open-studify-feedback', handleOpen);
    return () => window.removeEventListener('open-studify-feedback', handleOpen);
  }, []);

  const handleFeedbackSaved = (updated: FeedbackSummary) => {
    setSummary(updated);
  };

  const handleStartReply = (reviewId: string, existingReply?: string | null) => {
    setReplyingToId(reviewId);
    setReplyDraft(existingReply || '');
    setReplyError(null);
  };

  const handleCancelReply = () => {
    if (isSubmittingReply) return;
    setReplyingToId(null);
    setReplyDraft('');
    setReplyError(null);
  };

  const handleSubmitReply = async (e: React.FormEvent, feedbackId: string) => {
    e.preventDefault();
    if (isSubmittingReply || !isOwner) return;

    const clean = replyDraft.trim();
    if (!clean) {
      setReplyError('Please enter a reply before posting.');
      return;
    }

    setIsSubmittingReply(true);
    setReplyError(null);

    const res = await appFeedbackService.replyToFeedback({
      feedbackId,
      replyText: clean,
    });

    setIsSubmittingReply(false);

    if (!res.success || !res.feedback) {
      setReplyError(res.error?.message || 'Could not post official reply.');
      return;
    }

    setSummary((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === res.feedback!.id ? res.feedback! : it)),
    }));
    setReplyingToId(null);
    setReplyDraft('');
  };

  const handleDeleteReply = async (feedbackId: string) => {
    if (!isOwner || deletingReplyId) return;
    setDeletingReplyId(feedbackId);
    setReplyError(null);

    const res = await appFeedbackService.deleteFeedbackReply(feedbackId);
    setDeletingReplyId(null);

    if (!res.success) {
      setReplyError(res.error?.message || 'Could not remove official reply.');
      return;
    }

    setSummary((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === feedbackId
          ? { ...it, replyText: null, replyAuthor: null, replyUpdatedAt: null }
          : it
      ),
    }));
  };

  const itemsWithComments = useMemo(
    () => summary.items.filter((item) => item.comment && item.comment.trim().length > 0),
    [summary.items]
  );

  const filteredReviews = useMemo(() => {
    if (starFilter === null) return itemsWithComments;
    return itemsWithComments.filter((item) => Math.round(item.rating) === starFilter);
  }, [itemsWithComments, starFilter]);

  const maxTierCount = useMemo(() => {
    const counts = STAR_TIERS.map((tier) => summary.ratingBreakdown[tier] || 0);
    return Math.max(...counts, summary.totalRatings, 1);
  }, [summary.ratingBreakdown, summary.totalRatings]);

  const getInitials = (name: string): string => {
    const clean = (name || 'Student').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase() || 'ST';
  };

  return (
    <section className="px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Description Above Rating Overview */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Ratings &amp; Reviews
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Live student ratings and public reviews for Studify&apos;s PYQ search speed, paper viewer, and study workspace. Anyone can rate and post a review — no sign-in required.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBottomSheetOpen(true)}
          className="px-4 py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs sm:text-sm font-semibold rounded-lg transition-opacity flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap self-start sm:self-auto"
        >
          <MessageSquarePlus className="w-4 h-4 shrink-0" />
          <span>
            {summary.userRating ? `Edit Your Review (${summary.userRating}/5)` : 'Rate & Review Studify'}
          </span>
        </button>
      </div>

      {/* Inline Error Banner if Supabase fetch failed */}
      {summary.loadError && (
        <div className="p-3.5 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{summary.loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadFeedback}
            className="px-2.5 py-1 rounded-lg bg-[var(--surface-main)] border border-[var(--border-divider)] text-[var(--text-primary)] hover:border-[var(--border-hover)] flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Play Store-Style Overall Rating & 5-to-1 Breakdown Card (Above Reviews) */}
      <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl p-5 sm:p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-4 space-y-2">
              <div className="h-12 w-24 rounded-lg bg-[var(--surface-secondary)]" />
              <div className="h-4 w-28 rounded bg-[var(--surface-secondary)]" />
              <div className="h-3 w-36 rounded bg-[var(--surface-secondary)]" />
            </div>
            <div className="md:col-span-8 space-y-2.5">
              {STAR_TIERS.map((tier) => (
                <div key={tier} className="h-3.5 rounded bg-[var(--surface-secondary)]" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Average Score Column */}
            <div className="md:col-span-4 flex flex-col items-start space-y-2 border-b md:border-b-0 md:border-r border-[var(--border-divider)] pb-5 md:pb-0 md:pr-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
                  {summary.averageRating !== null && summary.totalRatings > 0
                    ? summary.averageRating.toFixed(1)
                    : '—'}
                </span>
                <span className="text-sm font-medium text-[var(--text-muted)] tabular-nums">/ 5</span>
              </div>

              <PartialStarRow value={summary.averageRating ?? 0} sizeClass="w-4 h-4" />

              <p className="text-xs text-[var(--text-secondary)] tabular-nums pt-0.5">
                {summary.totalRatings} {summary.totalRatings === 1 ? 'rating' : 'ratings'} ·{' '}
                {summary.totalReviews} {summary.totalReviews === 1 ? 'review' : 'reviews'}
              </p>
            </div>

            {/* 5-to-1 Star Distribution Bars */}
            <div className="md:col-span-8 space-y-2">
              {STAR_TIERS.map((tier) => {
                const count = summary.ratingBreakdown[tier] || 0;
                const percent = summary.totalRatings > 0 ? Math.round((count / maxTierCount) * 100) : 0;
                const isActiveFilter = starFilter === tier;

                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setStarFilter((prev) => (prev === tier ? null : tier))}
                    className={`w-full flex items-center gap-3 px-2.5 py-1 rounded-lg text-left transition-colors cursor-pointer ${
                      isActiveFilter
                        ? 'bg-[var(--accent-blue-bg)] ring-1 ring-[var(--accent-blue)]/40'
                        : 'hover:bg-[var(--surface-secondary)]'
                    }`}
                    aria-pressed={isActiveFilter}
                    aria-label={`Filter reviews by ${tier} stars (${count} ratings)`}
                  >
                    <span className="w-8 flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)] tabular-nums shrink-0">
                      <span>{tier}</span>
                      <Star className="w-3 h-3 text-[var(--color-yellow)] fill-[var(--color-yellow)]" />
                    </span>

                    <div className="flex-1 h-2.5 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-yellow)] transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <span className="w-10 text-right text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Public Written Reviews Feed (Below Overall Rating & Breakdown) */}
      {!isLoading && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] tabular-nums">
              {starFilter !== null
                ? `${starFilter}-Star Public Reviews (${filteredReviews.length})`
                : `Public Reviews (${itemsWithComments.length})`}
            </h4>

            {starFilter !== null && (
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className="text-xs font-medium text-[var(--accent-blue)] hover:underline cursor-pointer whitespace-nowrap"
              >
                Show all reviews
              </button>
            )}
          </div>

          {replyError && replyingToId === null && (
            <div className="p-3 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{replyError}</span>
            </div>
          )}

          {filteredReviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredReviews.map((item) => {
                const isOwnReview = item.visitorId === currentVisitorId;
                const isReplyingHere = replyingToId === item.id;
                const hasReply = Boolean(item.replyText && item.replyText.trim().length > 0);

                return (
                  <article
                    key={item.id}
                    className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-divider)] flex items-center justify-center text-[11px] font-bold text-[var(--text-primary)] shrink-0">
                          {getInitials(item.authorName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {item.authorName}
                            </span>
                            {isOwnReview && (
                              <span className="text-[11px] text-[var(--accent-blue)] font-medium shrink-0">
                                (You)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-0.5 text-[var(--color-yellow)]">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3 h-3 ${
                                    s <= item.rating
                                      ? 'fill-current'
                                      : 'text-[var(--text-muted)] opacity-25'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                              {new Date(item.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {isOwnReview && (
                          <button
                            type="button"
                            onClick={() => setIsBottomSheetOpen(true)}
                            className="text-[11px] font-medium text-[var(--accent-blue)] hover:underline cursor-pointer whitespace-nowrap"
                          >
                            Edit
                          </button>
                        )}
                        {isOwner && !isReplyingHere && (
                          <button
                            type="button"
                            onClick={() => handleStartReply(item.id, item.replyText)}
                            className="text-[11px] font-semibold text-[var(--accent-blue)] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Reply className="w-3 h-3" />
                            <span>{hasReply ? 'Edit Reply' : 'Reply'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed break-words">
                      {item.comment}
                    </p>

                    {/* Official Studify Team Reply (nested hairline sub-block) */}
                    {hasReply && !isReplyingHere && (
                      <div className="mt-2.5 pt-2.5 px-3 pb-3 rounded-xl bg-[var(--surface-secondary)]/75 border border-[var(--border-divider)] space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                            <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
                              {item.replyAuthor || 'Studify Team'}
                            </span>
                            <BadgeCheck
                              className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0"
                              aria-label="Verified Owner"
                            />
                            <span className="text-[var(--text-muted)] whitespace-nowrap">
                              Verified Owner
                            </span>
                            {item.replyUpdatedAt && (
                              <>
                                <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
                                <span className="text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                                  {new Date(item.replyUpdatedAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                              </>
                            )}
                          </div>

                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReply(item.id)}
                              disabled={deletingReplyId === item.id}
                              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--color-red)] flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                              aria-label="Delete official reply"
                            >
                              {deletingReplyId === item.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed break-words">
                          {item.replyText}
                        </p>
                      </div>
                    )}

                    {/* Owner-Only Inline Reply Composer */}
                    {isOwner && isReplyingHere && (
                      <form
                        onSubmit={(e) => handleSubmitReply(e, item.id)}
                        className="mt-2.5 p-3 rounded-xl bg-[var(--surface-secondary)]/85 border border-[var(--border-divider)] space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                            <BadgeCheck className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                            <span>Replying as Studify Team</span>
                          </span>
                          <span className="text-[var(--text-muted)] tabular-nums">
                            {replyDraft.length}/500
                          </span>
                        </div>

                        {replyError && (
                          <div className="p-2 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[11px] text-[var(--color-red)] flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{replyError}</span>
                          </div>
                        )}

                        <textarea
                          rows={3}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value.slice(0, 500))}
                          disabled={isSubmittingReply}
                          placeholder="Write an official response from Studify Team..."
                          className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelReply}
                            disabled={isSubmittingReply}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-main)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap disabled:opacity-40"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingReply || !replyDraft.trim()}
                            className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white dark:text-[#0A2640] text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-40"
                          >
                            {isSubmittingReply ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Posting...</span>
                              </>
                            ) : (
                              <span>{hasReply ? 'Update Reply' : 'Post Reply'}</span>
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl p-6 text-center space-y-2">
              {starFilter !== null ? (
                <>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                    No {starFilter}-star written reviews yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStarFilter(null)}
                    className="text-xs font-medium text-[var(--accent-blue)] hover:underline cursor-pointer"
                  >
                    View all reviews
                  </button>
                </>
              ) : summary.totalRatings > 0 ? (
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] tabular-nums">
                  {summary.totalRatings} {summary.totalRatings === 1 ? 'star rating' : 'star ratings'} recorded — be the first to add a written review.
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                  No ratings yet. Be the first student to rate and review Studify!
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rating & Review Bottom Sheet Modal */}
      <AppFeedbackBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        onFeedbackSaved={handleFeedbackSaved}
      />
    </section>
  );
};
