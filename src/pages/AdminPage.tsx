import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Trash2, Eye, X, User } from 'lucide-react';
import { Paper } from '../types';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { supabase } from '../supabaseClient.js';

interface AdminPageProps {
  papers: Paper[];
  onPaperUpdated: (updated: Paper) => void;
  onPaperDeleted: (id: string) => void;
  onSelectPaper: (paper: Paper) => void;
  onRedirectToLogin?: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  papers,
  onPaperUpdated,
  onPaperDeleted,
  onSelectPaper,
  onRedirectToLogin,
}) => {
  const { isOwner } = useAuth();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [rejectModalPaper, setRejectModalPaper] = useState<Paper | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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

  if (!isOwner) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 bg-[#101B2D] border border-white/[0.14] rounded-2xl flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-950/30">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-[#F8FAFC]">
          Restricted Moderator Area
        </h1>
        <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-sm mx-auto">
          This approval queue is strictly restricted to verified platform administrators.
        </p>
      </div>
    );
  }

  const displayedPapers = papers.filter((p) => {
    if (filter === 'pending') return p.status === 'pending';
    return true;
  });

  const handleApprove = (paper: Paper) => {
    const updated = storageService.updatePaperStatus(paper.id, 'approved');
    if (updated) {
      onPaperUpdated(updated);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectModalPaper) return;
    const updated = storageService.updatePaperStatus(
      rejectModalPaper.id,
      'rejected',
      rejectionReason || 'Does not meet submission guidelines.'
    );
    if (updated) {
      onPaperUpdated(updated);
    }
    setRejectModalPaper(null);
    setRejectionReason('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this paper permanently?')) {
      storageService.deletePaper(id);
      onPaperDeleted(id);
    }
  };

  const pendingCount = papers.filter((p) => p.status === 'pending').length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
            Moderator Review Queue
          </h1>
          <p className="text-xs sm:text-sm text-[#A7B4C8] mt-1">
            Owner administration dashboard to review student submissions before public display.
          </p>
        </div>

        <div className="flex gap-2 text-xs shrink-0">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-2 rounded-xl transition-all font-semibold ${
              filter === 'pending'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-400/40 shadow-sm'
                : 'bg-[#101B2D] border border-white/[0.1] text-[#A7B4C8] hover:text-white'
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 rounded-xl transition-all font-semibold ${
              filter === 'all'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'bg-[#101B2D] border border-white/[0.1] text-[#A7B4C8] hover:text-white'
            }`}
          >
            All Submissions ({papers.length})
          </button>
        </div>
      </div>

      {displayedPapers.length > 0 ? (
        <div className="space-y-3.5">
          {displayedPapers.map((paper) => (
            <div
              key={paper.id}
              className="bg-[#101B2D]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-5 sm:p-6 shadow-xl space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400 text-xs">{paper.examBoard}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-xs text-[#A7B4C8]">{paper.grade}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-xs font-mono text-white/70">{paper.year}</span>
                  </div>

                  <h3 className="text-base font-bold text-[#F8FAFC]">
                    {paper.title}
                  </h3>

                  <div className="text-xs text-[#A7B4C8] pt-1">
                    Uploader: <strong className="text-white">{paper.submittedBy.name}</strong> ({paper.submittedBy.email})
                  </div>

                  <div className="text-xs text-[#A7B4C8]">
                    Submitted: {new Date(paper.submittedAt).toLocaleDateString()} · Status:{' '}
                    <span className={`font-semibold ${
                      paper.status === 'approved'
                        ? 'text-emerald-400'
                        : paper.status === 'pending'
                        ? 'text-amber-300'
                        : 'text-rose-400'
                    }`}>
                      {paper.status === 'approved' ? 'Approved' : paper.status === 'pending' ? 'Waiting for review' : 'Rejected'}
                    </span>
                  </div>

                  {paper.rejectionReason && (
                    <div className="text-xs text-rose-200 bg-rose-950/20 p-3 border border-rose-500/20 rounded-xl mt-2">
                      Reason: {paper.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 self-start">
                  {paper.status !== 'approved' && (
                    <button
                      onClick={() => handleApprove(paper)}
                      className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#050914] rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {paper.status === 'pending' && (
                    <button
                      onClick={() => {
                        setRejectModalPaper(paper);
                        setRejectionReason('The scanned pages are incomplete or illegible.');
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectPaper(paper)}
                    className="px-3 py-1.5 text-xs text-[#A7B4C8] hover:text-white hover:bg-white/[0.08] rounded-xl transition-colors flex items-center gap-1.5 border border-white/[0.08]"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View file</span>
                  </button>

                  <button
                    onClick={() => handleDelete(paper.id)}
                    className="px-3 py-1.5 text-xs text-[#A7B4C8] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-xs text-[#A7B4C8] border border-white/[0.1] rounded-3xl bg-[#101B2D]/70 p-8">
          No papers waiting for review in this queue.
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#101B2D] border border-white/[0.16] rounded-3xl max-w-sm w-full p-6 space-y-4 text-xs text-[#F8FAFC] shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h3 className="font-bold text-sm text-[#F8FAFC]">
                Reject Submission
              </h3>
              <button
                onClick={() => setRejectModalPaper(null)}
                className="text-[#A7B4C8] hover:text-[#F8FAFC] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#A7B4C8] leading-relaxed">
              Provide feedback to the student explaining why <strong className="text-white">{rejectModalPaper.title}</strong> cannot be published.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full p-3 bg-[#0A1222] border border-white/[0.1] rounded-xl text-xs text-[#F8FAFC] placeholder-[#A7B4C8]/50 focus:outline-none focus:border-rose-400"
              placeholder="Reason for not approving"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setRejectModalPaper(null)}
                className="px-3.5 py-2 border border-white/[0.1] hover:bg-white/[0.08] text-[#A7B4C8] hover:text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl transition-all shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
