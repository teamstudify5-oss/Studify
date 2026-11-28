import React, { useEffect, useState } from 'react';
import { Paper } from '../types';
import { useAuth } from '../context/AuthContext';
import { communityPyqService } from '../services/communityPyqService';
import { FolderClosed, PlusCircle, Trash2, Eye, Edit2 } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { EditCommunityPyqModal } from '../components/EditCommunityPyqModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface SubmissionsPageProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onNavigateToUpload: () => void;
  onPaperDeleted: (id: string) => void;
  onPaperUpdated?: (updated: Paper) => void;
  onRedirectToLogin?: () => void;
}

export const SubmissionsPage: React.FC<SubmissionsPageProps> = ({
  papers,
  onSelectPaper,
  onNavigateToUpload,
  onPaperDeleted,
  onPaperUpdated,
  onRedirectToLogin,
}) => {
  const { currentUser, isAuthenticated, openAuthModal } = useAuth();
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [confirmDeletePaper, setConfirmDeletePaper] = useState<Paper | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fetchedSubmissions, setFetchedSubmissions] = useState<Paper[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (window.location.pathname !== '/login') {
          window.history.pushState(null, '', '/login');
        }
        if (onRedirectToLogin) {
          onRedirectToLogin();
        } else {
          window.location.href = '/login';
        }
      }
    });
  }, [onRedirectToLogin]);

  const papersSyncKey = papers
    .map(
      (p) =>
        `${p.id}:${p.title}:${p.subject}:${p.grade}:${p.examBoard}:${p.year}:${p.chapter || ''}:${p.status}:${p.totalMarks || ''}:${p.timeAllowedMinutes || ''}`
    )
    .join('|');

  useEffect(() => {
    if (!currentUser?.id) {
      setFetchedSubmissions([]);
      return;
    }
    let active = true;
    communityPyqService.fetchUserCommunitySubmissions(currentUser.id).then((rows) => {
      if (active) setFetchedSubmissions(rows);
    });
    return () => {
      active = false;
    };
  }, [currentUser?.id, papersSyncKey]);

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-2xl flex items-center justify-center mx-auto text-[var(--accent-blue)]">
          <FolderClosed className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Sign in to view your papers
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Sign in to manage question papers you have contributed to the community.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="px-5 py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer btn-quad-border"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Show all submissions authored by active user (active, pending, rejected, removed)
  const userSubmissions =
    fetchedSubmissions.length > 0
      ? fetchedSubmissions
      : papers.filter((p) => p.submittedBy.id === currentUser.id);

  const handleDelete = async (paper: Paper) => {
    if (deletingId) return;

    setDeletingId(paper.id);
    setDeleteError(null);
    try {
      const res = await communityPyqService.deleteCommunityPyq(paper.id, paper.filePath || paper.fileUrl);
      if (res.success) {
        setFetchedSubmissions((prev) => prev.filter((p) => p.id !== paper.id));
        setConfirmDeletePaper(null);
        onPaperDeleted(paper.id);
      } else {
        const failedDetail =
          res.failedPaths && res.failedPaths.length > 0
            ? ` Failed files: ${res.failedPaths.map((f) => f.path).join(', ')}`
            : '';
        setDeleteError((res.error?.message || 'Could not delete paper.') + failedDetail);
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete paper.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            My Uploaded Papers
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Manage the question papers you have published to the Community Library.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToUpload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all self-start sm:self-auto cursor-pointer btn-quad-border"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Upload Another Paper</span>
        </button>
      </div>

      {deleteError && !confirmDeletePaper && (
        <div className="p-3 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] text-xs flex items-center justify-between gap-2">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Submissions List */}
      {userSubmissions.length > 0 ? (
        <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl overflow-hidden shadow-xs">
          <div className="divide-y divide-[var(--border-divider)]">
            {userSubmissions.map((paper) => (
              <div
                key={paper.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--surface-secondary)]/50 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center text-xs text-[var(--text-secondary)] gap-1.5">
                    <span className="font-semibold text-[var(--text-primary)]">{paper.examBoard}</span>
                    <span>·</span>
                    <span>{paper.grade}</span>
                    <span>·</span>
                    <span className="text-[var(--accent-blue)]">{paper.subject}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{paper.year}</span>
                    {(paper.status === 'takedown' || paper.status === 'removed') && (
                      <>
                        <span>·</span>
                        <span className="text-[var(--color-red)] font-semibold">Removed by Administrator</span>
                      </>
                    )}
                    {paper.status === 'pending' && (
                      <>
                        <span>·</span>
                        <span className="text-[var(--color-yellow)] font-semibold">Pending Review</span>
                      </>
                    )}
                    {paper.status === 'rejected' && (
                      <>
                        <span>·</span>
                        <span className="text-[var(--color-red)] font-semibold">Rejected</span>
                      </>
                    )}
                  </div>

                  <h3
                    onClick={() => onSelectPaper(paper)}
                    className="text-sm sm:text-base font-semibold text-[var(--text-primary)] hover:text-[var(--accent-blue)] cursor-pointer transition-colors truncate"
                  >
                    {paper.title}
                  </h3>

                  {paper.status === 'removed' && paper.removalReason && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5">
                      <strong>Administrator reason:</strong> {paper.removalReason}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center text-xs text-[var(--text-secondary)] gap-3 font-mono tabular-nums">
                    <span>{paper.viewsCount} Views</span>
                    <span>·</span>
                    <span>{paper.downloadsCount} Downloads</span>
                    <span>·</span>
                    <span>
                      {paper.rating && paper.ratingCount && paper.ratingCount > 0
                        ? `Rating: ${Number(paper.rating).toFixed(1)} (${paper.ratingCount})`
                        : 'Not rated'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectPaper(paper)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer btn-quad-border"
                  >
                    <Eye className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                    <span>View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingPaper(paper)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer btn-quad-border"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmDeletePaper(paper);
                    }}
                    disabled={deletingId === paper.id}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--color-red)]/30 bg-[var(--accent-red-bg)] hover:opacity-90 text-[var(--color-red)] text-xs font-semibold transition-opacity flex items-center gap-1 disabled:opacity-50 cursor-pointer btn-quad-border"
                    title="Delete Paper"
                    aria-label="Delete Paper"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deletingId === paper.id ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-[var(--surface-secondary)] rounded-2xl flex items-center justify-center mx-auto text-[var(--accent-blue)]">
            <FolderClosed className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]">No uploads yet</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              You haven't contributed any past examination papers yet. Uploading helps thousands of fellow students prepare effectively.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToUpload}
            className="px-5 py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-2 cursor-pointer btn-quad-border"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Upload Your First Paper</span>
          </button>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingPaper && (
        <EditCommunityPyqModal
          isOpen={true}
          paper={editingPaper}
          onClose={() => setEditingPaper(null)}
          onUpdated={(updated) => {
            setFetchedSubmissions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            if (onPaperUpdated) onPaperUpdated(updated);
            setEditingPaper(null);
          }}
        />
      )}

      {confirmDeletePaper && (
        <ConfirmDialog
          isOpen={true}
          title="Delete Paper Permanently"
          description={`Delete "${confirmDeletePaper.title}"? This will permanently delete the document record and purge its file from storage.`}
          confirmLabel="Delete Permanently"
          isBusy={Boolean(deletingId)}
          errorMessage={deleteError}
          onConfirm={() => handleDelete(confirmDeletePaper)}
          onCancel={() => {
            if (!deletingId) {
              setConfirmDeletePaper(null);
              setDeleteError(null);
            }
          }}
        />
      )}
    </div>
  );
};
