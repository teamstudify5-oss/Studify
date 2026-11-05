import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Clock, 
  Award, 
  Star, 
  Bookmark, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  FolderPlus, 
  ShieldAlert, 
  Flag, 
  Edit2, 
  Trash2,
  MessageSquare
} from 'lucide-react';
import { Paper } from '../types';
import { PaperViewer } from '../components/PaperViewer';
import { storageService } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { PaperCard } from '../components/PaperCard';
import { AddToProjectModal } from '../components/workspace/AddToProjectModal';
import { ReportRemovalModal } from '../components/ReportRemovalModal';
import { EditCommunityPyqModal } from '../components/EditCommunityPyqModal';
import { communityPyqService } from '../services/communityPyqService';
import { supabaseDb } from '../services/supabaseDb';

interface PaperDetailsPageProps {
  paper: Paper;
  allPapers: Paper[];
  onBack: () => void;
  onSelectPaper: (paper: Paper) => void;
  onDownloadPaper: (paper: Paper, e?: React.MouseEvent) => void;
  onBookmarkPaper: (paper: Paper, e: React.MouseEvent) => void;
  isBookmarked: boolean;
  onRequireLogin: () => void;
}

export const PaperDetailsPage: React.FC<PaperDetailsPageProps> = ({
  paper,
  allPapers,
  onBack,
  onSelectPaper,
  onDownloadPaper,
  onBookmarkPaper,
  isBookmarked,
  onRequireLogin,
}) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [currentPaper, setCurrentPaper] = useState<Paper>(paper);

  // Ratings & reviews state
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>(currentUser?.name || '');
  const [reviewSubmitted, setReviewSubmitted] = useState<boolean>(false);
  const [hasExistingUserRating, setHasExistingUserRating] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [, setRatingError] = useState<string | null>(null);

  // Discussion comments state
  const [commentText, setCommentText] = useState<string>('');
  const [commentSubmitted, setCommentSubmitted] = useState<boolean>(false);

  // Add to Project modal
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);
  const [projectToast, setProjectToast] = useState<string | null>(null);

  // Report & Removal Request state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportToast, setReportToast] = useState<string | null>(null);

  // Edit submission state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const isUploader = Boolean(currentUser?.id && currentPaper.submittedBy?.id === currentUser.id);

  const handleDeleteSubmission = async () => {
    if (!window.confirm('Are you sure you want to delete this community submission? This cannot be undone.')) return;
    try {
      await communityPyqService.deleteCommunityPyq(currentPaper.id, currentPaper.filePath || currentPaper.fileUrl);
      storageService.deletePaper(currentPaper.id);
      onBack();
    } catch {
      alert('Could not delete paper. Please try again.');
    }
  };

  useEffect(() => {
    storageService.recordView(paper.id);
    const refreshed = storageService.getPaperById(paper.id);
    if (refreshed) {
      setCurrentPaper(refreshed);
    } else {
      setCurrentPaper(paper);
    }

    supabaseDb.fetchPaperRatings(paper.id).then((realRatings: any) => {
      if (realRatings.ratingCount > 0 && realRatings.rating !== undefined) {
        setCurrentPaper((prev) => ({
          ...prev,
          rating: realRatings.rating,
          ratingCount: realRatings.ratingCount,
          reviews: realRatings.reviews as any,
        }));
      } else {
        setCurrentPaper((prev) => ({
          ...prev,
          rating: undefined,
          ratingCount: 0,
          reviews: realRatings.reviews || [],
        }));
      }

      if (realRatings.userRating) {
        setSelectedStars(realRatings.userRating);
        if (realRatings.userReviewText) setReviewText(realRatings.userReviewText);
        setHasExistingUserRating(true);
      }
    });
  }, [paper.id, currentUser]);

  useEffect(() => {
    if (currentUser?.name && !reviewerName) {
      setReviewerName(currentUser.name);
    }
  }, [currentUser]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }

    setIsSubmittingReview(true);
    setRatingError(null);

    const author = reviewerName.trim() || currentUser?.name || 'Student';
    const result = await supabaseDb.submitPaperRating(currentPaper.id, selectedStars, reviewText, author);

    if (!result.success) {
      setIsSubmittingReview(false);
      setRatingError(result.error?.message || 'Failed to submit rating. Please try again.');
      return;
    }

    const refreshed = await supabaseDb.fetchPaperRatings(currentPaper.id);
    setCurrentPaper((prev) => ({
      ...prev,
      rating: refreshed.rating,
      ratingCount: refreshed.ratingCount,
      reviews: refreshed.reviews as any,
    }));

    setHasExistingUserRating(true);
    setReviewSubmitted(true);
    setIsSubmittingReview(false);
    setTimeout(() => setReviewSubmitted(false), 3500);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    if (!commentText.trim()) return;

    const updated = storageService.addComment(
      currentPaper.id,
      commentText,
      currentUser!.name,
      currentUser!.email
    );
    if (updated) {
      setCurrentPaper(updated);
      setCommentSubmitted(true);
      setCommentText('');
      setTimeout(() => setCommentSubmitted(false), 3000);
    }
  };

  const relatedPapers = allPapers
    .filter(
      (p) =>
        p.id !== currentPaper.id &&
        p.status === 'approved' &&
        (p.subject === currentPaper.subject || p.examBoard === currentPaper.examBoard)
    )
    .slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Top Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] btn-quad-border"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to question papers</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Uploader Edit & Delete Controls */}
          {isUploader && (
            <>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer btn-quad-border"
                title="Edit this submission"
              >
                <Edit2 className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmission}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-red-bg)] text-[var(--color-red)] hover:opacity-90 border border-[var(--color-red)]/30 transition-colors flex items-center gap-1.5 cursor-pointer btn-quad-border"
                title="Delete your submission"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--color-red)] transition-colors flex items-center gap-1.5 cursor-pointer btn-quad-border"
            title="Report this paper and send removal request to the uploader"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Request Removal</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddToProjectOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer btn-quad-border"
            title="Attach to a Study Project"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            <span className="hidden sm:inline">Add to Project</span>
          </button>

          <button
            type="button"
            onClick={(e) => onBookmarkPaper(currentPaper, e)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer btn-quad-border ${
              isBookmarked
                ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                : 'bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'Bookmarked' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => onDownloadPaper(currentPaper)}
            className="px-3 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-opacity shadow-xs flex items-center gap-1.5 cursor-pointer btn-quad-border"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Document Header Card */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 sm:p-7 space-y-4 shadow-xs">
        {/* Metadata Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--accent-blue)]">{currentPaper.examBoard}</span>
          <span className="text-[var(--text-muted)] opacity-60">·</span>
          <span>{currentPaper.grade}</span>
          <span className="text-[var(--text-muted)] opacity-60">·</span>
          <span className="font-medium text-[var(--text-primary)]">{currentPaper.subject}</span>
          <span className="text-[var(--text-muted)] opacity-60">·</span>
          <span className="font-mono text-[var(--text-muted)]">{currentPaper.year}</span>
          {currentPaper.chapter && (
            <>
              <span className="text-[var(--text-muted)] opacity-60">·</span>
              <span className="text-[var(--color-green)] font-medium">{currentPaper.chapter}</span>
            </>
          )}
        </div>

        {/* Document Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-snug">
          {currentPaper.title}
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
          {currentPaper.description || `${currentPaper.subject} previous year examination paper with full question structure and official marking scheme.`}
        </p>

        {/* Technical Specs Strip */}
        <div className="pt-3 border-t border-[var(--border-divider)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-[var(--text-secondary)] font-mono text-[11px]">
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
              <span>{currentPaper.totalMarks} Marks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--color-green)]" />
              <span>{currentPaper.timeAllowedMinutes / 60} Hours</span>
            </div>
            <div className="flex items-center gap-1 text-[var(--color-yellow)]">
              <Star className={`w-3.5 h-3.5 ${currentPaper.rating ? 'fill-current' : 'opacity-40'}`} />
              <span>
                {currentPaper.rating
                  ? `${currentPaper.rating} (${currentPaper.ratingCount || 1})`
                  : 'Not rated yet'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-[var(--text-muted)] text-[11px]">
            <span>Uploaded by <strong className="text-[var(--text-primary)] font-medium">{currentPaper.submittedBy?.name || 'Community'}</strong></span>
            <span>·</span>
            <span>{currentPaper.downloadsCount || 0} Downloads</span>
            <span>·</span>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="text-[var(--color-red)] hover:underline flex items-center gap-1 font-medium cursor-pointer"
              title="Report issue and request review"
            >
              <Flag className="w-3 h-3" />
              <span>Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Study Workspace Viewer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Question Paper Preview
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            Full text questions and marking structure
          </span>
        </div>

        <PaperViewer
          paper={currentPaper}
          onDownload={() => onDownloadPaper(currentPaper)}
        />
      </div>

      {/* SECTION: RATINGS & REVIEWS */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Student Ratings & Reviews
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Leave feedback on readability and exam accuracy.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[var(--surface-elevated)] px-3 py-1.5 rounded-lg border border-[var(--border-divider)]">
            <div className="flex items-center gap-1 text-[var(--color-yellow)] font-mono text-sm font-semibold">
              <Star className={`w-3.5 h-3.5 ${currentPaper.rating ? 'fill-current' : 'opacity-50'}`} />
              <span>{currentPaper.rating ? currentPaper.rating : '—'}</span>
            </div>
            <span className="text-[var(--text-muted)] opacity-60">·</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {currentPaper.ratingCount && currentPaper.ratingCount > 0
                ? `${currentPaper.ratingCount} ${currentPaper.ratingCount === 1 ? 'rating' : 'ratings'}`
                : 'Not rated yet'}
            </span>
          </div>
        </div>

        {/* Submit Review Form */}
        <form onSubmit={handleReviewSubmit} className="bg-[var(--surface-elevated)]/70 border border-[var(--border-divider)] rounded-xl p-4 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="font-medium text-[var(--text-primary)]">Rate this paper:</span>
            
            {/* 1-5 Star Picker */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStars(s)}
                  className="p-1 hover:scale-110 transition-transform cursor-pointer"
                  title={`${s} star`}
                >
                  <Star
                    className={`w-4 h-4 ${
                      s <= selectedStars
                        ? 'fill-[var(--color-yellow)] text-[var(--color-yellow)]'
                        : 'text-[var(--text-muted)] opacity-40'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 font-mono text-[var(--color-yellow)] font-semibold">{selectedStars}.0</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-1">
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                type="text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Add a helpful note (e.g. Good numerical coverage for Section B)"
                className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {reviewSubmitted ? (
              <span className="text-xs text-[var(--color-green)] font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Rating recorded! Thank you.</span>
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)]">
                Community feedback helps verify question quality.
              </span>
            )}

            <button
              type="submit"
              disabled={isSubmittingReview}
              className="px-3.5 py-1.5 bg-[var(--accent-blue)] text-white font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer text-xs btn-quad-border"
            >
              {isSubmittingReview ? 'Saving...' : hasExistingUserRating ? 'Update Rating' : 'Submit Rating'}
            </button>
          </div>
        </form>

        {/* Existing Reviews List */}
        <div className="space-y-2.5 pt-1">
          {currentPaper.reviews && currentPaper.reviews.length > 0 ? (
            currentPaper.reviews.map((r) => (
              <div
                key={r.id}
                className="bg-[var(--surface-elevated)]/60 border border-[var(--border-divider)] rounded-lg p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <span>{r.authorName}</span>
                    <span className="text-[var(--text-muted)] opacity-60">·</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[var(--color-yellow)]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < r.stars ? 'fill-current' : 'opacity-30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {r.text && (
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    {r.text}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-xs text-[var(--text-muted)]">
              No written reviews yet. Be the first to share feedback!
            </div>
          )}
        </div>
      </div>

      {/* SECTION: DISCUSSION & COMMENTS */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Discussion & Questions
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Ask questions about specific solutions, formulas, or tricky problems.
          </p>
        </div>

        {/* Post Comment Input */}
        {isAuthenticated ? (
          <form onSubmit={handleCommentSubmit} className="space-y-2.5">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              placeholder="Ask about a specific question or solution step..."
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
            />
            <div className="flex items-center justify-between">
              {commentSubmitted ? (
                <span className="text-xs text-[var(--color-green)] font-medium">Comment posted!</span>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)]">Posting as {currentUser?.name}</span>
              )}
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-3.5 py-1.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer btn-quad-border"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Comment</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-[var(--surface-elevated)]/70 border border-[var(--border-divider)] rounded-xl p-5 text-center space-y-2.5">
            <MessageSquare className="w-6 h-6 text-[var(--accent-blue)] mx-auto opacity-70" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Join the Question Discussion</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Sign in to ask questions, help fellow students with answers, and bookmark papers.
            </p>
            <button
              type="button"
              onClick={onRequireLogin}
              className="px-4 py-1.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 cursor-pointer btn-quad-border"
            >
              Sign In to Comment
            </button>
          </div>
        )}

        {/* Existing Comments List */}
        <div className="space-y-2.5 pt-1">
          {currentPaper.comments && currentPaper.comments.length > 0 ? (
            currentPaper.comments.map((c) => (
              <div
                key={c.id}
                className="bg-[var(--surface-elevated)]/60 border border-[var(--border-divider)] rounded-lg p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-primary)]">{c.authorName}</span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {c.text}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-xs text-[var(--text-muted)]">
              No comments yet. Have a doubt? Start the discussion!
            </div>
          )}
        </div>
      </div>

      {/* Related Papers */}
      {relatedPapers.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[var(--border-divider)]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Related {currentPaper.subject} Papers
            </h2>
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] btn-quad-border"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedPapers.map((p) => (
              <PaperCard
                key={p.id}
                paper={p}
                onSelect={onSelectPaper}
                onDownload={onDownloadPaper}
                onBookmark={onBookmarkPaper}
                isBookmarked={storageService.isPaperSaved(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add To Project Modal */}
      <AddToProjectModal
        paper={currentPaper}
        isOpen={isAddToProjectOpen}
        onClose={() => setIsAddToProjectOpen(false)}
        onSuccess={(projName) => {
          setProjectToast(`Paper attached to ${projName}`);
          setTimeout(() => setProjectToast(null), 3000);
        }}
      />

      {/* Report & Removal Request Modal */}
      <ReportRemovalModal
        paper={currentPaper}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onRequestSubmitted={() => {
          setReportToast(`Removal request sent directly to ${currentPaper.submittedBy?.name || 'the uploader'}'s account.`);
          setTimeout(() => setReportToast(null), 4000);
        }}
      />

      {/* Project Toast */}
      {projectToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-main)] text-[var(--text-primary)] border border-[var(--border-divider)] text-xs px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in">
          <span>{projectToast}</span>
        </div>
      )}

      {/* Removal Request Toast */}
      {reportToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-main)] text-[var(--text-primary)] border border-[var(--color-yellow)]/40 text-xs px-3.5 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in">
          <span>{reportToast}</span>
        </div>
      )}

      {/* Edit Community Submission Modal */}
      {isUploader && (
        <EditCommunityPyqModal
          paper={currentPaper}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdated={(updated) => {
            setCurrentPaper(updated);
            const all = storageService.getPapers();
            storageService.savePapers(all.map((p) => (p.id === updated.id ? updated : p)));
          }}
        />
      )}
    </div>
  );
};
