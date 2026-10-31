import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Clock, 
  Award, 
  BookOpen, 
  Star, 
  Bookmark, 
  Share2, 
  MessageSquare, 
  Send, 
  User, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  FolderPlus,
  ShieldAlert,
  Flag,
  Edit2,
  Trash2
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

  // Ratings & reviews state (no login required)
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>(currentUser?.name || '');
  const [reviewSubmitted, setReviewSubmitted] = useState<boolean>(false);

  // Discussion comments state (login gated)
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
    } catch (e) {
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
  }, [paper.id]);

  useEffect(() => {
    if (currentUser?.name && !reviewerName) {
      setReviewerName(currentUser.name);
    }
  }, [currentUser]);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const author = reviewerName.trim() || currentUser?.name || 'Student';
    const updated = storageService.addReview(currentPaper.id, selectedStars, reviewText, author);
    if (updated) {
      setCurrentPaper(updated);
      setReviewSubmitted(true);
      setReviewText('');
      setTimeout(() => setReviewSubmitted(false), 3000);
    }
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Navigation Strip */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs text-[#A7B4C8] hover:text-[#F8FAFC] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to question papers</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Uploader Edit & Delete Controls */}
          {isUploader && (
            <>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white transition-all flex items-center gap-1.5"
                title="Edit this submission"
              >
                <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmission}
                className="px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition-all flex items-center gap-1.5"
                title="Delete your submission"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-400 text-rose-300 transition-all flex items-center gap-1.5"
            title="Report this paper and send removal request to the uploader"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Request Removal</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddToProjectOpen(true)}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium bg-[#101B2D] hover:bg-[#15233D] border border-white/[0.12] hover:border-cyan-400/40 text-[#A7B4C8] hover:text-[#F8FAFC] transition-all flex items-center gap-1.5"
            title="Attach to a Study Project"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Add to Project</span>
          </button>

          <button
            type="button"
            onClick={(e) => onBookmarkPaper(currentPaper, e)}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              isBookmarked
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                : 'bg-[#101B2D] hover:bg-[#15233D] border border-white/[0.12] text-[#A7B4C8] hover:text-[#F8FAFC]'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-cyan-400' : ''}`} />
            <span>{isBookmarked ? 'Bookmarked' : 'Save Paper'}</span>
          </button>

          <button
            onClick={() => onDownloadPaper(currentPaper)}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Floating Header Card */}
      <div className="bg-[#101B2D]/85 backdrop-blur-xl border border-white/[0.14] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/20 space-y-5 relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Metadata Strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A7B4C8]">
          <span className="font-bold text-cyan-400">{currentPaper.examBoard}</span>
          <span className="text-white/20">·</span>
          <span>{currentPaper.grade}</span>
          <span className="text-white/20">·</span>
          <span className="font-semibold text-white">{currentPaper.subject}</span>
          <span className="text-white/20">·</span>
          <span className="font-mono text-white/80">{currentPaper.year}</span>
          {currentPaper.chapter && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-teal-300">{currentPaper.chapter}</span>
            </>
          )}
        </div>

        {/* Document Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight leading-snug">
          {currentPaper.title}
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-2xl">
          {currentPaper.description || `${currentPaper.subject} previous year examination paper with full question structure and official marking scheme.`}
        </p>

        {/* Technical Specs Strip */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-5 text-[#A7B4C8]">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>{currentPaper.totalMarks} Marks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>{currentPaper.timeAllowedMinutes / 60} Hours</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-300">
              <Star className="w-4 h-4 fill-amber-300" />
              <span>{currentPaper.rating || '4.8'} ({currentPaper.ratingCount || 1} Reviews)</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[#A7B4C8] text-[11px]">
            <span>Uploaded by <strong className="text-white font-medium">{currentPaper.submittedBy?.name || 'Academic Contributor'}</strong></span>
            <span>·</span>
            <span>{currentPaper.downloadsCount || 0} Downloads · {currentPaper.viewsCount || 1} Views</span>
            <span>·</span>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 font-medium transition-colors"
              title="Report issue and request uploader to remove paper"
            >
              <Flag className="w-3 h-3" />
              <span>Report & Request Removal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Study Workspace Viewer */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#F8FAFC]">
            Interactive Question Workspace
          </h2>
          <span className="text-xs text-[#A7B4C8]">
            Zoom, navigate sections, and review questions
          </span>
        </div>

        <PaperViewer
          paper={currentPaper}
          onDownload={() => onDownloadPaper(currentPaper)}
        />
      </div>

      {/* SECTION: RATINGS & REVIEWS (NO LOGIN REQUIRED) */}
      <div className="bg-[#101B2D]/80 backdrop-blur-xl border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#F8FAFC]">
              Student Reviews & Rating
            </h2>
            <p className="text-xs text-[#A7B4C8] mt-0.5">
              Leave feedback on readability and exam accuracy. No login required.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#0A1222] px-3.5 py-2 rounded-2xl border border-white/[0.1]">
            <div className="flex items-center gap-1 text-amber-300 font-mono text-base font-bold">
              <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
              <span>{currentPaper.rating || '4.8'}</span>
            </div>
            <span className="text-white/20">·</span>
            <span className="text-xs text-[#A7B4C8]">
              {currentPaper.reviews?.length || 1} student ratings
            </span>
          </div>
        </div>

        {/* Submit Review Form */}
        <form onSubmit={handleReviewSubmit} className="bg-[#0A1222]/90 border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="font-medium text-[#F8FAFC]">How helpful was this paper?</span>
            
            {/* 1-5 Star Picker */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStars(s)}
                  className="p-1 hover:scale-110 transition-transform"
                  title={`${s} Stars`}
                >
                  <Star
                    className={`w-5 h-5 ${
                      s <= selectedStars
                        ? 'fill-amber-300 text-amber-300'
                        : 'text-white/20'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 font-mono text-amber-300 font-bold">{selectedStars}.0</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Your name or grade (optional)"
                className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.1] rounded-xl text-white placeholder-[#A7B4C8]/50 focus:outline-none focus:border-cyan-400 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                type="text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Add a helpful note (e.g. Good numerical coverage for Section B)"
                className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.1] rounded-xl text-white placeholder-[#A7B4C8]/50 focus:outline-none focus:border-cyan-400 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {reviewSubmitted ? (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Thank you! Your rating has been recorded.</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#A7B4C8]">
                Public feedback helps keep question papers verified.
              </span>
            )}

            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] font-bold rounded-xl transition-all shadow-sm"
            >
              Submit Rating
            </button>
          </div>
        </form>

        {/* Existing Reviews List */}
        <div className="space-y-3 pt-2">
          {currentPaper.reviews && currentPaper.reviews.length > 0 ? (
            currentPaper.reviews.map((r) => (
              <div
                key={r.id}
                className="bg-[#0A1222]/60 border border-white/[0.06] rounded-2xl p-4 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>{r.authorName}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-[11px] font-mono text-[#A7B4C8]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-300">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < r.stars ? 'fill-amber-300 text-amber-300' : 'text-white/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {r.text && (
                  <p className="text-[#A7B4C8] leading-relaxed">
                    {r.text}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-[#A7B4C8]">
              No written reviews yet. Be the first to share feedback!
            </div>
          )}
        </div>
      </div>

      {/* SECTION: DISCUSSION & COMMENTS (LOGIN REQUIRED TO POST) */}
      <div className="bg-[#101B2D]/80 backdrop-blur-xl border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">
            Discussion & Questions
          </h2>
          <p className="text-xs text-[#A7B4C8] mt-0.5">
            Ask questions about specific solutions, formulas, or tricky problems.
          </p>
        </div>

        {/* Post Comment Input */}
        {isAuthenticated ? (
          <form onSubmit={handleCommentSubmit} className="space-y-3">
            <div className="relative">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                placeholder="Ask about a specific question or solution step..."
                className="w-full p-3.5 bg-[#0A1222] border border-white/[0.1] rounded-2xl text-xs text-white placeholder-[#A7B4C8]/50 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div className="flex items-center justify-between">
              {commentSubmitted ? (
                <span className="text-xs text-emerald-400 font-medium">Comment posted!</span>
              ) : (
                <span className="text-[11px] text-[#A7B4C8]">Posting as {currentUser?.name}</span>
              )}
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Comment</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-[#0A1222] border border-white/[0.08] rounded-2xl p-5 text-center space-y-3">
            <MessageSquare className="w-8 h-8 text-cyan-400/50 mx-auto" />
            <h3 className="text-sm font-bold text-[#F8FAFC]">Join the Question Discussion</h3>
            <p className="text-xs text-[#A7B4C8] max-w-sm mx-auto">
              Sign in to ask questions, help fellow students with answers, and bookmark papers to your library.
            </p>
            <button
              onClick={onRequireLogin}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20"
            >
              Sign In to Comment
            </button>
          </div>
        )}

        {/* Existing Comments List */}
        <div className="space-y-3 pt-2">
          {currentPaper.comments && currentPaper.comments.length > 0 ? (
            currentPaper.comments.map((c) => (
              <div
                key={c.id}
                className="bg-[#0A1222]/60 border border-white/[0.06] rounded-2xl p-4 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{c.authorName}</span>
                  <span className="text-[11px] font-mono text-[#A7B4C8]">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[#F8FAFC] leading-relaxed">
                  {c.text}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-[#A7B4C8]">
              No comments yet. Have a doubt? Start the discussion!
            </div>
          )}
        </div>
      </div>

      {/* Related Papers */}
      {relatedPapers.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/[0.08]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F8FAFC]">
              Related {currentPaper.subject} Papers
            </h2>
            <button
              onClick={onBack}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
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

      {/* Removal Request Toast */}
      {reportToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#101B2D] text-[#F8FAFC] border border-amber-400/40 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
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
