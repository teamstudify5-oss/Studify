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
  MessageSquare,
  RotateCcw,
  X
} from 'lucide-react';
import { Paper, PaperRemovalNotice } from '../types';
import { PaperViewer } from '../components/PaperViewer';
import { storageService } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { PaperCard } from '../components/PaperCard';
import { AddToProjectModal } from '../components/workspace/AddToProjectModal';
import { ReportRemovalModal } from '../components/ReportRemovalModal';
import { EditCommunityPyqModal } from '../components/EditCommunityPyqModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
  onPaperUpdated?: (updated: Paper) => void;
  onPaperDeleted?: (id: string) => void;
  downloadingPaperIds?: Set<string>;
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
  onPaperUpdated,
  onPaperDeleted,
  downloadingPaperIds,
}) => {
  const { currentUser, isAuthenticated, isOwner } = useAuth();
  const [currentPaper, setCurrentPaper] = useState<Paper>(paper);
  const [removalNotice, setRemovalNotice] = useState<PaperRemovalNotice | null>(null);

  // Ratings & reviews state
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>(currentUser?.name || '');
  const [reviewSubmitted, setReviewSubmitted] = useState<boolean>(false);
  const [hasExistingUserRating, setHasExistingUserRating] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(false);
  const [reviewsLoadError, setReviewsLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  const isAdmin = Boolean(
    isOwner ||
      currentUser?.role === 'owner' ||
      currentUser?.email?.toLowerCase().trim() === 'teamstudify5@gmail.com'
  );

  // Admin removal & restore state
  const [isAdminRemoveModalOpen, setIsAdminRemoveModalOpen] = useState(false);
  const [adminRemovalReason, setAdminRemovalReason] = useState('');
  const [isRemovingAdmin, setIsRemovingAdmin] = useState(false);
  const [adminRemoveError, setAdminRemoveError] = useState<string | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isRestoringAdmin, setIsRestoringAdmin] = useState(false);
  const [adminRestoreError, setAdminRestoreError] = useState<string | null>(null);

  const handleAdminRemoval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRemovalReason.trim()) {
      setAdminRemoveError('Please enter a reason before confirming removal.');
      return;
    }
    setIsRemovingAdmin(true);
    setAdminRemoveError(null);
    try {
      const cleanReason = adminRemovalReason.trim();
      const res = await communityPyqService.removeCommunityPyqByAdmin(
        currentPaper.id,
        cleanReason,
        currentUser?.email || 'teamstudify5@gmail.com'
      );
      if (!res.success || res.error) {
        throw res.error || new Error('Failed to remove paper.');
      }

      const updatedPaper: Paper = {
        ...currentPaper,
        status: 'removed',
        isRemoved: true,
        removalReason: cleanReason,
        removedBy: currentUser?.email || 'Studify Administrator',
        removedAt: new Date().toISOString(),
      };
      setCurrentPaper(updatedPaper);
      onPaperUpdated?.(updatedPaper);

      setIsAdminRemoveModalOpen(false);
      setAdminRemovalReason('');
      setReportToast('Paper marked as Removed by Administrator.');
      setTimeout(() => setReportToast(null), 4000);
    } catch (err: any) {
      setAdminRemoveError(err.message || 'Removal failed. Please check network.');
    } finally {
      setIsRemovingAdmin(false);
    }
  };

  const handleAdminRestore = async () => {
    if (isRestoringAdmin) return;
    setIsRestoringAdmin(true);
    setAdminRestoreError(null);
    try {
      const res = await communityPyqService.restoreCommunityPyqByAdmin(currentPaper.id);
      if (res.error || !res.paper) {
        throw res.error || new Error('Could not restore paper.');
      }
      setCurrentPaper(res.paper);
      setRemovalNotice(null);
      storageService.savePaper(res.paper);
      onPaperUpdated?.(res.paper);
      setIsRestoreConfirmOpen(false);
      setReportToast('Paper restored to published library.');
      setTimeout(() => setReportToast(null), 4000);
    } catch (err: any) {
      setAdminRestoreError(err?.message || 'Restoration failed.');
    } finally {
      setIsRestoringAdmin(false);
    }
  };

  const handleDeleteSubmission = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await communityPyqService.deleteCommunityPyq(
        currentPaper.id,
        currentPaper.filePath || currentPaper.fileUrl
      );
      if (!res.success || res.error) {
        const failedDetail =
          res.failedPaths && res.failedPaths.length > 0
            ? ` Failed storage files: ${res.failedPaths.map((f) => f.path).join(', ')}`
            : '';
        setDeleteError((res.error?.message || 'Could not delete paper. Please try again.') + failedDetail);
        return;
      }

      setIsDeleteConfirmOpen(false);
      if (onPaperDeleted) {
        onPaperDeleted(currentPaper.id);
      } else {
        storageService.removePaperFromLocalCache(currentPaper.id);
        onBack();
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete paper. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadRatingsForPaper = async (targetPaperId: string, isStillCurrent?: () => boolean) => {
    setIsLoadingReviews(true);
    setReviewsLoadError(null);
    const realRatings = await supabaseDb.fetchPaperRatings(targetPaperId);
    if (isStillCurrent && !isStillCurrent()) return;

    setIsLoadingReviews(false);

    if (realRatings.error) {
      setReviewsLoadError(realRatings.error.message || 'Unable to load reviews right now.');
      return;
    }

    setReviewsLoadError(null);
    if (realRatings.ratingCount > 0 && realRatings.rating !== undefined) {
      setCurrentPaper((prev) => ({
        ...prev,
        rating: realRatings.rating,
        ratingCount: realRatings.ratingCount,
        reviews: realRatings.reviews,
      }));
    } else {
      setCurrentPaper((prev) => ({
        ...prev,
        rating: undefined,
        ratingCount: 0,
        reviews: [],
      }));
    }

    if (realRatings.userRating) {
      setSelectedStars(realRatings.userRating);
      setReviewText(realRatings.userReviewText || '');
      setHasExistingUserRating(true);
    } else {
      setSelectedStars(5);
      setReviewText('');
      setHasExistingUserRating(false);
    }
  };

  useEffect(() => {
    let active = true;
    setDeleteError(null);
    setRatingError(null);
    setReviewSubmitted(false);
    setRemovalNotice(null);

    const refreshed = storageService.getPaperById(paper.id);
    const initial = refreshed || paper;
    setCurrentPaper(initial);

    if (initial.status === 'removed' || initial.isRemoved) {
      communityPyqService.getPaperRemovalNotice(paper.id).then((notice) => {
        if (active && notice) setRemovalNotice(notice);
      });
      if (!isAdmin && !isUploader) {
        return () => {
          active = false;
        };
      }
    } else {
      // Verify live accessibility (if paper was just unpublished remotely, load safe notice)
      communityPyqService.getCommunityPyqById(paper.id).then((livePaper) => {
        if (!active) return;
        if (livePaper) {
          setCurrentPaper(livePaper);
          if (livePaper.status !== 'removed') {
            storageService.recordView(livePaper.id);
          }
        } else {
          communityPyqService.getPaperRemovalNotice(paper.id).then((notice) => {
            if (active && notice) {
              setRemovalNotice(notice);
              setCurrentPaper((prev) => ({
                ...prev,
                status: 'removed',
                isRemoved: true,
                removalReason: notice.removalReason,
                removedAt: notice.removedAt,
                removedBy: notice.removedBy,
              }));
            }
          });
        }
      });
    }

    loadRatingsForPaper(paper.id, () => active);

    return () => {
      active = false;
    };
  }, [paper.id, paper.status, currentUser?.id, isAdmin, isUploader]);

  useEffect(() => {
    setCurrentPaper((prev) => {
      if (prev.id !== paper.id) return prev;
      return {
        ...prev,
        title: paper.title,
        subject: paper.subject,
        grade: paper.grade,
        examBoard: paper.examBoard,
        year: paper.year,
        chapter: paper.chapter,
        description: paper.description,
        totalMarks: paper.totalMarks,
        timeAllowedMinutes: paper.timeAllowedMinutes,
      };
    });
  }, [
    paper.id,
    paper.title,
    paper.subject,
    paper.grade,
    paper.examBoard,
    paper.year,
    paper.chapter,
    paper.description,
    paper.totalMarks,
    paper.timeAllowedMinutes,
  ]);

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
    setReviewSubmitted(false);

    const author = reviewerName.trim() || currentUser?.name || 'Student';
    const result = await supabaseDb.submitPaperRating(currentPaper.id, selectedStars, reviewText, author);

    if (!result.success) {
      setIsSubmittingReview(false);
      setRatingError(result.error?.message || 'Failed to submit rating. Please try again.');
      return;
    }

    const refreshed = await supabaseDb.fetchPaperRatings(currentPaper.id);
    if (refreshed.error) {
      setReviewsLoadError(refreshed.error.message);
    } else {
      setReviewsLoadError(null);
      setCurrentPaper((prev) => ({
        ...prev,
        rating: refreshed.rating,
        ratingCount: refreshed.ratingCount,
        reviews: refreshed.reviews,
      }));
    }

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

  const isPaperRemoved = currentPaper.status === 'removed' || Boolean(currentPaper.isRemoved) || Boolean(removalNotice);
  const canInspectRemovedContent = !isPaperRemoved || isAdmin || isUploader;
  const isDownloading = Boolean(downloadingPaperIds?.has(currentPaper.id));
  const downloadActionLabel = isDownloading
    ? 'Preparing Download...'
    : currentPaper.isImageBased
    ? (currentPaper.imagePaths?.length || currentPaper.imageUrls?.length || 1) > 1
      ? 'Download Photos (.zip)'
      : 'Download Photo'
    : currentPaper.fileName?.toLowerCase().endsWith('.zip')
    ? 'Download ZIP'
    : 'Download PDF';

  if (isPaperRemoved && !canInspectRemovedContent) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--surface-main)] border border-[var(--border-divider)]"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to question papers</span>
        </button>

        <div className="bg-[var(--surface-main)] border border-[var(--color-red)]/35 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 flex items-center justify-center shrink-0 text-[var(--color-red)]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-red)]">
                Official Administrator Notice
              </span>
              <h1 className="font-display text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                {removalNotice?.title || currentPaper.title}
              </h1>
              <div className="text-xs text-[var(--text-secondary)] flex flex-wrap gap-1.5 tabular-nums">
                <span>{removalNotice?.examBoard || currentPaper.examBoard}</span>
                <span>·</span>
                <span>{removalNotice?.grade || currentPaper.grade}</span>
                <span>·</span>
                <span>{removalNotice?.subject || currentPaper.subject}</span>
                <span>·</span>
                <span className="font-mono">{removalNotice?.year || currentPaper.year}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/25 space-y-1.5 text-xs">
            <div className="font-semibold text-[var(--color-red)]">
              This question paper has been unpublished by an administrator and is no longer available for preview or download.
            </div>
            <div className="text-[var(--text-primary)] whitespace-pre-line">
              <strong>Reason:</strong> {removalNotice?.removalReason || currentPaper.removalReason || 'Removed following moderation review.'}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] pt-1 flex flex-wrap gap-3 tabular-nums">
              <span>Action by: {removalNotice?.removedBy || 'Studify Administrator'}</span>
              {(removalNotice?.removedAt || currentPaper.removedAt) && (
                <span>Date: {new Date((removalNotice?.removedAt || currentPaper.removedAt)!).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Top Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--surface-main)] border border-[var(--border-divider)]"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to question papers</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Uploader Edit & Uploader/Admin Delete Controls */}
          {isUploader && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Edit this submission"
            >
              <Edit2 className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
              <span>Edit</span>
            </button>
          )}
          {(isUploader || isAdmin) && (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setIsDeleteConfirmOpen(true);
              }}
              disabled={isDeleting}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-red-bg)] text-[var(--color-red)] hover:opacity-90 border border-[var(--color-red)]/30 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Delete submission permanently"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          )}

          {/* Administrator Remove / Restore Control */}
          {isAdmin && !isPaperRemoved && (
            <button
              type="button"
              onClick={() => setIsAdminRemoveModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-red-bg)] hover:opacity-90 text-[var(--color-red)] border border-[var(--color-red)]/30 transition-opacity flex items-center gap-1.5 cursor-pointer"
              title="Administrator: Remove paper from library with mandatory reason"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin Remove</span>
            </button>
          )}

          {isAdmin && isPaperRemoved && (
            <button
              type="button"
              onClick={() => {
                setAdminRestoreError(null);
                setIsRestoreConfirmOpen(true);
              }}
              disabled={isRestoringAdmin}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Administrator: Restore paper back to published library"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRestoringAdmin ? 'Restoring...' : 'Restore Paper'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--color-red)] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Report this paper and send removal request to the uploader"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Request Removal</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddToProjectOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Attach to a Study Project"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            <span className="hidden sm:inline">Add to Project</span>
          </button>

          <button
            type="button"
            onClick={(e) => onBookmarkPaper(currentPaper, e)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              isBookmarked
                ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                : 'bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'Bookmarked' : 'Save'}</span>
          </button>

          <button
            type="button"
            disabled={isDownloading}
            onClick={() => onDownloadPaper(currentPaper)}
            className="px-3 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs font-semibold rounded-lg transition-opacity shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadActionLabel}</span>
          </button>
        </div>
      </div>

      {/* Inline Deletion Error Banner (shown when dialog is closed) */}
      {deleteError && !isDeleteConfirmOpen && (
        <div className="p-3.5 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] text-xs flex items-center justify-between gap-2">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Moderation Warning Banner for Removed Papers (Admin / Uploader view) */}
      {isPaperRemoved && (
        <div className="p-4 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-[var(--color-red)] shrink-0" />
              <span>Removed / Unpublished by Administrator</span>
            </div>
            <div className="text-xs text-[var(--text-secondary)] whitespace-pre-line pl-6 font-mono">
              Reason: {currentPaper.removalReason || removalNotice?.removalReason || 'Removed following moderation review.'}
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setAdminRestoreError(null);
                setIsRestoreConfirmOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white dark:text-[#0A2640] hover:opacity-90 flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Paper</span>
            </button>
          )}
        </div>
      )}

      {/* Document Header Card */}
      <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-2xl p-5 sm:p-7 space-y-4 shadow-xs">
        {/* Metadata Strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)] tabular-nums">
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
              <span className="text-[var(--accent-mint)] font-medium">{currentPaper.chapter}</span>
            </>
          )}
        </div>

        {/* Document Title */}
        <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-snug">
          {currentPaper.title}
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
          {currentPaper.description || `${currentPaper.subject} previous year examination paper with full question structure and official marking scheme.`}
        </p>

        {/* Technical Specs Strip - Strictly conditional */}
        <div className="pt-3 border-t border-[var(--border-divider)] flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex items-center gap-4 text-[var(--text-secondary)] font-mono text-[11px]">
            {currentPaper.totalMarks && currentPaper.totalMarks > 0 ? (
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                <span>{currentPaper.totalMarks} Marks</span>
              </div>
            ) : null}
            {currentPaper.timeAllowedMinutes && currentPaper.timeAllowedMinutes > 0 ? (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--accent-mint)]" />
                <span>{currentPaper.timeAllowedMinutes / 60} Hours</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1 text-[var(--text-primary)]">
              <Star className={`w-3.5 h-3.5 text-[var(--color-yellow)] ${currentPaper.rating ? 'fill-current' : 'opacity-40'}`} />
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
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Question Paper Preview
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            Full text questions and marking structure
          </span>
        </div>

        <PaperViewer
          paper={currentPaper}
          onDownload={() => onDownloadPaper(currentPaper)}
          isDownloading={isDownloading}
        />
      </div>

      {/* SECTION: RATINGS & REVIEWS */}
      <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Student Ratings &amp; Reviews
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Leave feedback on readability and exam accuracy.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[var(--surface-elevated)] px-3 py-1.5 rounded-lg border border-[var(--border-divider)] tabular-nums">
            <div className="flex items-center gap-1 text-[var(--text-primary)] font-mono text-sm font-semibold">
              <Star className={`w-3.5 h-3.5 text-[var(--color-yellow)] ${currentPaper.rating ? 'fill-current' : 'opacity-40'}`} />
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
        <form onSubmit={handleReviewSubmit} className="bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-xl p-4 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span className="font-medium text-[var(--text-primary)]">Rate this paper:</span>
            
            {/* 1-5 Star Picker */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStars(s)}
                  className="p-1 hover:scale-105 transition-transform cursor-pointer"
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
              <span className="ml-2 font-mono tabular-nums text-[var(--text-primary)] font-semibold">{selectedStars}.0</span>
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

          {ratingError && (
            <div className="p-2.5 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] text-xs">
              {ratingError}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {reviewSubmitted ? (
              <span className="text-xs text-[var(--accent-mint)] font-medium flex items-center gap-1">
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
              className="px-3.5 py-1.5 bg-[var(--accent-blue)] text-white dark:text-[#0A2640] font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer text-xs"
            >
              {isSubmittingReview ? 'Saving...' : hasExistingUserRating ? 'Update Rating' : 'Submit Rating'}
            </button>
          </div>
        </form>

        {/* Existing Reviews List */}
        <div className="space-y-2.5 pt-1">
          {isLoadingReviews ? (
            <div className="text-center py-4 text-xs text-[var(--text-muted)]">
              Loading reviews...
            </div>
          ) : reviewsLoadError ? (
            <div className="p-3 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-center justify-between gap-2">
              <span>Could not load reviews: {reviewsLoadError}</span>
              <button
                type="button"
                onClick={() => loadRatingsForPaper(currentPaper.id)}
                className="px-2.5 py-1 rounded bg-[var(--surface-main)] border border-[var(--border-divider)] text-[var(--text-primary)] font-medium cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          ) : currentPaper.reviews && currentPaper.reviews.length > 0 ? (
            currentPaper.reviews.map((r) => (
              <div
                key={r.id}
                className="bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-lg p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <span>{r.authorName}</span>
                    <span className="text-[var(--text-muted)] opacity-60">·</span>
                    <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
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
      <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div>
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Discussion &amp; Questions
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
                <span className="text-xs text-[var(--accent-mint)] font-medium">Comment posted!</span>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)]">Posting as {currentUser?.name}</span>
              )}
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-3.5 py-1.5 bg-[var(--accent-blue)] text-white dark:text-[#0A2640] text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Comment</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-xl p-5 text-center space-y-2.5">
            <MessageSquare className="w-6 h-6 text-[var(--accent-blue)] mx-auto opacity-75" />
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">Join the Question Discussion</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Sign in to ask questions, help fellow students with answers, and bookmark papers.
            </p>
            <button
              type="button"
              onClick={onRequireLogin}
              className="px-4 py-1.5 bg-[var(--accent-blue)] text-white dark:text-[#0A2640] text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 cursor-pointer"
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
                className="bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-lg p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-primary)]">{c.authorName}</span>
                  <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
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
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Related {currentPaper.subject} Papers
            </h2>
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg bg-[var(--surface-main)] border border-[var(--border-divider)]"
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
      {isUploader && isEditModalOpen && (
        <EditCommunityPyqModal
          paper={currentPaper}
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          onUpdated={(updated) => {
            setIsEditModalOpen(false);
            setCurrentPaper(updated);
            storageService.savePaper(updated);
            onPaperUpdated?.(updated);
          }}
        />
      )}

      {/* Studify Team Administrator Removal Modal */}
      {isAdminRemoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)]">
          <div className="bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--color-red)]" />
                <span>Remove Paper as Administrator</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAdminRemoveModalOpen(false);
                  setAdminRemoveError(null);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              This action will unpublish the paper from the public library and display the official administrator removal notice with your entered reason.
            </p>

            <form onSubmit={handleAdminRemoval} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Mandatory Reason for Removal *
                </label>
                <textarea
                  value={adminRemovalReason}
                  onChange={(e) => setAdminRemovalReason(e.target.value)}
                  placeholder="e.g. Copyright infringement / Low scan quality / Inappropriate content"
                  rows={3}
                  required
                  className="w-full p-2.5 text-xs rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-red)] placeholder-[var(--text-muted)]"
                />
              </div>

              {adminRemoveError && (
                <div className="p-2.5 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] text-xs">
                  {adminRemoveError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminRemoveModalOpen(false);
                    setAdminRemoveError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRemovingAdmin || !adminRemovalReason.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-red)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs transition-opacity"
                >
                  {isRemovingAdmin ? 'Removing...' : 'Confirm Removal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <ConfirmDialog
          isOpen={true}
          title="Delete Submission Permanently"
          description={`Are you sure you want to permanently delete "${currentPaper.title}" and remove its stored document files? This action cannot be undone.`}
          confirmLabel="Delete Permanently"
          isBusy={isDeleting}
          errorMessage={deleteError}
          onConfirm={handleDeleteSubmission}
          onCancel={() => {
            if (!isDeleting) {
              setIsDeleteConfirmOpen(false);
              setDeleteError(null);
            }
          }}
        />
      )}

      {isRestoreConfirmOpen && (
        <ConfirmDialog
          isOpen={true}
          title="Restore Unpublished Paper"
          description={`Restore "${currentPaper.title}" back to its previous published state? Existing reviews, ratings, bookmarks, and files will remain intact, and the public removal notice will be cleared.`}
          confirmLabel="Restore Paper"
          tone="primary"
          busyLabel="Restoring..."
          isBusy={isRestoringAdmin}
          errorMessage={adminRestoreError}
          onConfirm={handleAdminRestore}
          onCancel={() => {
            if (!isRestoringAdmin) {
              setIsRestoreConfirmOpen(false);
              setAdminRestoreError(null);
            }
          }}
        />
      )}
    </div>
  );
};
