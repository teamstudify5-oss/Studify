import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  X,
  Flag,
  AlertTriangle,
  History,
  FileText,
  UserX,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Paper } from '../types';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { communityPyqService } from '../services/communityPyqService';
import { clearStudifyContentCaches } from '../services/localCacheReset';
import { supabaseDb, DbReport, DbModerationLog } from '../services/supabaseDb';
import { supabase } from '../supabaseClient.js';
import { ConfirmDialog } from '../components/ConfirmDialog';

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
  const { currentUser, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<'reports' | 'submissions' | 'removed' | 'logs'>('reports');
  const [submissionFilter, setSubmissionFilter] = useState<'pending' | 'all'>('pending');

  // Full moderation catalog (pending, rejected, active, removed)
  const [moderationPapers, setModerationPapers] = useState<Paper[]>(papers);
  const [removedPapers, setRemovedPapers] = useState<Paper[]>([]);
  const [isLoadingModeration, setIsLoadingModeration] = useState(false);

  // Restore confirmation dialog state
  const [confirmRestorePaper, setConfirmRestorePaper] = useState<Paper | null>(null);
  const [restoringPaperId, setRestoringPaperId] = useState<string | null>(null);

  // Reports state
  const [reports, setReports] = useState<DbReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState<'pending' | 'all'>('pending');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<DbModerationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Modals state
  const [rejectModalPaper, setRejectModalPaper] = useState<Paper | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [takedownModalReport, setTakedownModalReport] = useState<DbReport | null>(null);
  const [takedownReason, setTakedownReason] = useState('');

  const [suspendModalUser, setSuspendModalUser] = useState<{ userId: string; userEmail?: string } | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [suspensionDays, setSuspensionDays] = useState<number>(7);

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [confirmDeletePaper, setConfirmDeletePaper] = useState<Paper | null>(null);

  // Owner-only Factory Reset modal state
  const [isFactoryResetOpen, setIsFactoryResetOpen] = useState(false);
  const [factoryResetPreview, setFactoryResetPreview] = useState<any | null>(null);
  const [isLoadingResetPreview, setIsLoadingResetPreview] = useState(false);
  const [isExecutingReset, setIsExecutingReset] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');
  const [resetPreserveModeration, setResetPreserveModeration] = useState(false);
  const [factoryResetError, setFactoryResetError] = useState<string | null>(null);

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

  const loadModerationPapers = async () => {
    setIsLoadingModeration(true);
    try {
      const [allMod, removedList] = await Promise.all([
        communityPyqService.fetchAdminModerationPyqs(),
        communityPyqService.fetchAdminRemovedPyqs(),
      ]);
      if (allMod.length > 0 || papers.length === 0) {
        setModerationPapers(allMod);
      } else {
        setModerationPapers(papers);
      }
      setRemovedPapers(
        removedList.length > 0
          ? removedList
          : allMod.filter((p) => p.status === 'removed' || p.isRemoved)
      );
    } catch (err) {
      console.error('Failed to load moderation queue', err);
    } finally {
      setIsLoadingModeration(false);
    }
  };

  const loadReports = async () => {
    setIsLoadingReports(true);
    try {
      const data = await supabaseDb.fetchReports();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const data = await supabaseDb.fetchModerationLogs();
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadReports();
    loadModerationPapers();
  }, []);

  const showToast = (msg: string) => {
    setActionErrorMsg(null);
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const showError = (msg: string) => {
    setActionErrorMsg(msg);
  };

  const handleOpenFactoryReset = async () => {
    setIsFactoryResetOpen(true);
    setFactoryResetPreview(null);
    setFactoryResetError(null);
    setResetConfirmationInput('');
    setIsLoadingResetPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('studify-factory-reset', {
        body: { mode: 'preview' },
      });
      if (error) {
        throw new Error(error.message || 'Could not reach factory reset Edge Function.');
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      setFactoryResetPreview(data);
    } catch (err: any) {
      setFactoryResetError(err?.message || 'Unable to load factory reset preview.');
    } finally {
      setIsLoadingResetPreview(false);
    }
  };

  const handleExecuteFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmationInput !== 'RESET STUDIFY TEST DATA') {
      setFactoryResetError('Please type RESET STUDIFY TEST DATA exactly to confirm.');
      return;
    }
    setIsExecutingReset(true);
    setFactoryResetError(null);
    try {
      const { data, error } = await supabase.functions.invoke('studify-factory-reset', {
        body: {
          mode: 'execute',
          confirmationPhrase: resetConfirmationInput,
          preserveModerationRecords: resetPreserveModeration,
        },
      });
      if (error) {
        throw new Error(error.message || 'Factory reset Edge Function request failed.');
      }
      if (!data?.success) {
        const errDetails = Array.isArray(data?.errors) && data.errors.length > 0
          ? data.errors.join('; ')
          : data?.error || 'Factory reset completed with errors.';
        throw new Error(errDetails);
      }

      clearStudifyContentCaches();
      setIsFactoryResetOpen(false);
      setResetConfirmationInput('');
      loadReports();
      loadModerationPapers();
      loadAuditLogs();
      showToast('Factory data reset completed. Auth users and schemas preserved.');
    } catch (err: any) {
      setFactoryResetError(err?.message || 'Factory reset failed.');
    } finally {
      setIsExecutingReset(false);
    }
  };

  const handleApprove = async (paper: Paper) => {
    setActionErrorMsg(null);
    const res = await communityPyqService.updateCommunityPyqStatus(paper.id, 'approved');
    if (res.error || !res.paper) {
      showError(res.error?.message || `Could not approve "${paper.title}".`);
      return;
    }
    storageService.savePaper(res.paper);
    onPaperUpdated(res.paper);
    loadModerationPapers();
    showToast(`Approved "${paper.title}"`);
  };

  const handleConfirmReject = async () => {
    if (!rejectModalPaper) return;
    setActionErrorMsg(null);
    const reason = rejectionReason.trim() || 'Did not meet quality standards.';
    const res = await communityPyqService.updateCommunityPyqStatus(
      rejectModalPaper.id,
      'rejected',
      reason
    );
    if (res.error || !res.paper) {
      showError(res.error?.message || `Could not reject "${rejectModalPaper.title}".`);
      return;
    }
    storageService.savePaper(res.paper);
    onPaperUpdated(res.paper);
    loadModerationPapers();
    showToast(`Rejected "${rejectModalPaper.title}"`);
    setRejectModalPaper(null);
    setRejectionReason('');
  };

  const handleDelete = async (paper: Paper) => {
    if (deletingPaperId) return;

    setDeletingPaperId(paper.id);
    setActionErrorMsg(null);
    try {
      const res = await communityPyqService.deleteCommunityPyq(paper.id, paper.filePath || paper.fileUrl);
      if (!res.success || res.error) {
        const failedDetail =
          res.failedPaths && res.failedPaths.length > 0
            ? ` Failed files: ${res.failedPaths.map((f) => f.path).join(', ')}`
            : '';
        showError((res.error?.message || 'Could not delete paper.') + failedDetail);
        return;
      }

      setConfirmDeletePaper(null);
      onPaperDeleted(paper.id);
      loadModerationPapers();
      loadAuditLogs();
      showToast('Paper permanently deleted.');
    } catch (err: any) {
      showError(err?.message || 'Could not delete paper.');
    } finally {
      setDeletingPaperId(null);
    }
  };

  const handleConfirmRestore = async (paper: Paper) => {
    if (restoringPaperId) return;

    setRestoringPaperId(paper.id);
    setActionErrorMsg(null);
    try {
      const res = await communityPyqService.restoreCommunityPyqByAdmin(paper.id);
      if (res.error || !res.paper) {
        showError(res.error?.message || `Could not restore "${paper.title}".`);
        return;
      }
      storageService.savePaper(res.paper);
      onPaperUpdated(res.paper);
      setConfirmRestorePaper(null);
      await Promise.all([loadModerationPapers(), loadAuditLogs()]);
      showToast(`Restored "${res.paper.title}" to public library.`);
    } catch (err: any) {
      showError(err?.message || 'Could not restore paper.');
    } finally {
      setRestoringPaperId(null);
    }
  };

  const handleResolveReport = async (report: DbReport) => {
    try {
      const res = await supabaseDb.updateReportStatus(report.id, 'resolved', 'Reviewed by moderator');
      if (!res.success || res.error) {
        showError('Failed to resolve report: ' + (res.error?.message || 'unknown error'));
        return;
      }
      showToast('Report marked as resolved.');
      loadReports();
      loadAuditLogs();
    } catch (err: any) {
      console.error(err);
      showError('Failed to resolve report: ' + (err.message || 'unknown error'));
    }
  };

  const handleDismissReport = async (report: DbReport) => {
    try {
      const res = await supabaseDb.updateReportStatus(report.id, 'dismissed', 'Dismissed - content complies');
      if (!res.success || res.error) {
        showError('Failed to dismiss report: ' + (res.error?.message || 'unknown error'));
        return;
      }
      showToast('Report dismissed.');
      loadReports();
      loadAuditLogs();
    } catch (err: any) {
      console.error(err);
      showError('Failed to dismiss report: ' + (err.message || 'unknown error'));
    }
  };

  const handleConfirmTakedown = async () => {
    if (!takedownModalReport) return;
    const cleanReason = takedownReason.trim() || 'Infringing or disputed material taken down';
    try {
      const res = await supabaseDb.takedownPaper(takedownModalReport.paper_id, cleanReason);
      if (!res.success || res.error) {
        showError('Takedown action failed: ' + (res.error?.message || 'unknown error'));
        return;
      }

      // Mark originating report as taken_down/resolved best-effort
      await supabaseDb
        .updateReportStatus(
          takedownModalReport.id,
          'takedown',
          cleanReason,
          takedownModalReport.paper_id
        )
        .catch(() => {});

      const existingPaper =
        moderationPapers.find((p) => p.id === takedownModalReport.paper_id) ||
        papers.find((p) => p.id === takedownModalReport.paper_id);
      if (existingPaper) {
        onPaperUpdated({
          ...existingPaper,
          status: 'removed',
          isRemoved: true,
          removalReason: cleanReason,
          removedBy: currentUser?.email || 'Studify Administrator',
          removedAt: new Date().toISOString(),
        });
      }

      showToast('Paper unpublished reversibly and moved to Removed / Unpublished Papers.');
      setTakedownModalReport(null);
      setTakedownReason('');
      await Promise.all([loadModerationPapers(), loadReports(), loadAuditLogs()]);
    } catch (err: any) {
      console.error(err);
      showError('Takedown action failed: ' + (err.message || 'unknown error'));
    }
  };

  const handleConfirmSuspend = async () => {
    if (!suspendModalUser) return;
    try {
      const res = await supabaseDb.suspendUser(
        suspendModalUser.userId,
        suspendModalUser.userEmail,
        suspensionReason || 'Violation of content upload policy',
        suspensionDays
      );
      if (!res.success || res.error) {
        showError('Suspension failed: ' + (res.error?.message || 'unknown error'));
        return;
      }
      showToast(`User suspended for ${suspensionDays > 365 ? '1+ years' : `${suspensionDays} days`}.`);
      setSuspendModalUser(null);
      setSuspensionReason('');
      loadAuditLogs();
    } catch (err: any) {
      console.error(err);
      showError('Suspension failed: ' + (err.message || 'unknown error'));
    }
  };

  const activeCatalog = moderationPapers.length > 0 ? moderationPapers : papers;
  const nonRemovedSubmissions = activeCatalog.filter((p) => p.status !== 'removed' && !p.isRemoved);

  const displayedSubmissions = nonRemovedSubmissions.filter((p) => {
    if (submissionFilter === 'pending') return p.status === 'pending';
    return true;
  });

  const displayedReports = reports.filter((r) => {
    if (reportFilter === 'pending') return r.status === 'pending';
    return true;
  });

  const pendingSubmissionsCount = nonRemovedSubmissions.filter((p) => p.status === 'pending').length;
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-main)] text-[var(--text-primary)] border border-[var(--color-green)] text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-divider)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)] border border-[var(--color-yellow)]/30">
              Admin & Owner
            </span>
            <span className="text-xs text-[var(--text-secondary)]">{currentUser?.email}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-1">
            Moderation & Review Panel
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage reports, take down infringing papers, review pending student uploads, and inspect audit logs.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[var(--surface-main)]/85 backdrop-blur-md p-1 rounded-xl border border-[var(--border-divider)] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border ${
              activeTab === 'reports'
                ? 'bg-[var(--accent-red-bg)] text-[var(--color-red)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Reports ({pendingReportsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('submissions');
              loadModerationPapers();
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border ${
              activeTab === 'submissions'
                ? 'bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Submissions ({pendingSubmissionsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('removed');
              loadModerationPapers();
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border ${
              activeTab === 'removed'
                ? 'bg-rose-500/15 text-rose-400 font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Removed / Unpublished ({removedPapers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('logs');
              loadAuditLogs();
            }}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border ${
              activeTab === 'logs'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={handleOpenFactoryReset}
              className="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 bg-[var(--accent-red-bg)] text-[var(--color-red)] border border-[var(--color-red)]/30 hover:opacity-90 transition-opacity cursor-pointer"
              title="Owner-only factory reset for test data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Factory Reset</span>
            </button>
          )}
        </div>
      </div>

      {actionErrorMsg && !confirmDeletePaper && !confirmRestorePaper && (
        <div className="p-3 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] text-xs flex items-center justify-between gap-2">
          <span>{actionErrorMsg}</span>
          <button
            type="button"
            onClick={() => setActionErrorMsg(null)}
            className="underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: REPORTS & MODERATION */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Filter:</span>
              <button
                onClick={() => setReportFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  reportFilter === 'pending'
                    ? 'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-divider)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Pending ({pendingReportsCount})
              </button>
              <button
                onClick={() => setReportFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  reportFilter === 'all'
                    ? 'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border-divider)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Reports ({reports.length})
              </button>
            </div>

            <button
              onClick={loadReports}
              disabled={isLoadingReports}
              className="p-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg border border-[var(--border-divider)] flex items-center gap-1 cursor-pointer"
              title="Refresh reports list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {displayedReports.length > 0 ? (
            <div className="space-y-3">
              {displayedReports.map((report) => {
                const targetPaper =
                  activeCatalog.find((p) => p.id === report.paper_id) ||
                  papers.find((p) => p.id === report.paper_id);
                return (
                  <div
                    key={report.id}
                    className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl p-4 sm:p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[var(--accent-red-bg)] text-[var(--color-red)] border border-[var(--color-red)]/30">
                            {report.reason_category.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            report.status === 'pending'
                              ? 'bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)]'
                              : report.status === 'taken_down'
                              ? 'bg-[var(--accent-red-bg)] text-[var(--color-red)]'
                              : 'bg-[var(--accent-green-bg)] text-[var(--color-green)]'
                          }`}>
                            Status: {report.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            {new Date(report.created_at).toLocaleString()}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                          {targetPaper ? targetPaper.title : `Paper ID: ${report.paper_id}`}
                        </h3>

                        {/* Report Details Evidence */}
                        <div className="p-3 bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-lg text-xs text-[var(--text-primary)] space-y-1">
                          <div className="font-semibold text-[var(--color-red)] flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Report Details & Evidence:</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{report.reason_details}</p>
                        </div>

                        {/* Reporter & Uploader details */}
                        <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap gap-3 pt-0.5">
                          <div>
                            Reporter: <strong className="text-[var(--text-primary)]">{report.reporter_name || 'Anonymous'}</strong>{' '}
                            {report.reporter_email && `(${report.reporter_email})`}
                          </div>
                          {targetPaper && (
                            <div>
                              Uploader: <strong className="text-[var(--text-primary)]">{targetPaper.submittedBy.name}</strong>{' '}
                              ({targetPaper.submittedBy.email})
                            </div>
                          )}
                        </div>

                        {report.moderator_notes && (
                          <div className="text-xs text-[var(--accent-blue)] bg-[var(--accent-blue-bg)] p-2.5 rounded-lg border border-[var(--accent-blue)]/20">
                            Moderator note: {report.moderator_notes}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0 self-start">
                        {targetPaper && (
                          <button
                            onClick={() => onSelectPaper(targetPaper)}
                            className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors flex items-center gap-1 border border-[var(--border-divider)] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                            <span>Inspect</span>
                          </button>
                        )}

                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setTakedownModalReport(report);
                                setTakedownReason(`Taken down due to verified report: ${report.reason_category}`);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-[var(--accent-red-bg)] hover:opacity-90 border border-[var(--color-red)]/30 text-[var(--color-red)] rounded-lg transition-opacity flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Take Down</span>
                            </button>

                            <button
                              onClick={() => handleResolveReport(report)}
                              className="px-2.5 py-1 text-xs font-medium bg-[var(--accent-green-bg)] hover:opacity-90 border border-[var(--color-green)]/30 text-[var(--color-green)] rounded-lg transition-opacity flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Resolve</span>
                            </button>

                            <button
                              onClick={() => handleDismissReport(report)}
                              className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors flex items-center gap-1 border border-[var(--border-divider)] cursor-pointer"
                            >
                              <span>Dismiss</span>
                            </button>
                          </>
                        )}

                        {targetPaper?.submittedBy?.id && (
                          <button
                            onClick={() =>
                              setSuspendModalUser({
                                userId: targetPaper.submittedBy.id,
                                userEmail: targetPaper.submittedBy.email,
                              })
                            }
                            className="px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--accent-red-bg)] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Suspend Uploader</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6">
              No reports found in this view.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING & ALL SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5 text-xs shrink-0">
              <button
                onClick={() => setSubmissionFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer ${
                  submissionFilter === 'pending'
                    ? 'bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)] font-semibold'
                    : 'bg-[var(--surface-main)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Pending ({pendingSubmissionsCount})
              </button>
              <button
                onClick={() => setSubmissionFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer ${
                  submissionFilter === 'all'
                    ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
                    : 'bg-[var(--surface-main)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Active & Pending ({nonRemovedSubmissions.length})
              </button>
            </div>
            <button
              type="button"
              onClick={loadModerationPapers}
              disabled={isLoadingModeration}
              className="p-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg border border-[var(--border-divider)] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModeration ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {displayedSubmissions.length > 0 ? (
            <div className="space-y-3">
              {displayedSubmissions.map((paper) => (
                <div
                  key={paper.id}
                  className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl p-4 sm:p-5 shadow-xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--accent-blue)] text-xs">{paper.examBoard}</span>
                        <span className="text-[var(--text-muted)] opacity-60">·</span>
                        <span className="text-xs text-[var(--text-secondary)]">{paper.grade}</span>
                        <span className="text-[var(--text-muted)] opacity-60">·</span>
                        <span className="text-xs font-mono text-[var(--text-muted)]">{paper.year}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                        {paper.title}
                      </h3>

                      <div className="text-xs text-[var(--text-secondary)] pt-0.5">
                        Uploader: <strong className="text-[var(--text-primary)]">{paper.submittedBy.name}</strong> ({paper.submittedBy.email})
                      </div>

                      <div className="text-xs text-[var(--text-secondary)]">
                        Submitted: {new Date(paper.submittedAt).toLocaleDateString()} · Status:{' '}
                        <span className={`font-semibold ${
                          paper.status === 'approved'
                            ? 'text-[var(--color-green)]'
                            : paper.status === 'pending'
                            ? 'text-[var(--color-yellow)]'
                            : 'text-[var(--color-red)]'
                        }`}>
                          {paper.status === 'approved' ? 'Approved' : paper.status === 'pending' ? 'Waiting for review' : 'Rejected'}
                        </span>
                      </div>

                      {paper.rejectionReason && (
                        <div className="text-xs text-[var(--color-red)] bg-[var(--accent-red-bg)] p-2.5 border border-[var(--color-red)]/20 rounded-lg mt-1.5">
                          Reason: {paper.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0 self-start">
                      {paper.status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(paper)}
                          className="px-3 py-1 text-xs font-semibold bg-[var(--color-green)] text-white dark:text-[#1C2530] rounded-lg transition-opacity hover:opacity-90 flex items-center gap-1 cursor-pointer"
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
                          className="px-3 py-1 text-xs font-medium bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      )}

                      <button
                        onClick={() => onSelectPaper(paper)}
                        className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors flex items-center gap-1 border border-[var(--border-divider)] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                        <span>View file</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionErrorMsg(null);
                          setConfirmDeletePaper(paper);
                        }}
                        disabled={deletingPaperId === paper.id}
                        className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--color-red)] hover:bg-[var(--accent-red-bg)] rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{deletingPaperId === paper.id ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6">
              No papers found in this queue.
            </div>
          )}
        </div>
      )}

      {/* TAB 2B: REMOVED / UNPUBLISHED PAPERS */}
      {activeTab === 'removed' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Removed / Unpublished Papers
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Reversibly unpublished submissions stay hidden from students with their storage files, reviews, ratings, and bookmarks preserved. Restore to republish the original record, or delete permanently.
              </p>
            </div>
            <button
              type="button"
              onClick={loadModerationPapers}
              disabled={isLoadingModeration}
              className="p-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg border border-[var(--border-divider)] flex items-center gap-1 cursor-pointer self-start sm:self-center shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModeration ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {removedPapers.length > 0 ? (
            <div className="space-y-3">
              {removedPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="bg-[var(--surface-main)] border border-rose-500/30 rounded-xl p-4 sm:p-5 shadow-xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Removed / Unpublished
                        </span>
                        <span className="font-semibold text-[var(--accent-blue)]">{paper.examBoard}</span>
                        <span className="text-[var(--text-muted)] opacity-60">·</span>
                        <span className="text-[var(--text-secondary)]">{paper.grade}</span>
                        <span className="text-[var(--text-muted)] opacity-60">·</span>
                        <span className="font-mono text-[var(--text-muted)]">{paper.year}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                        {paper.title}
                      </h3>

                      <div className="text-xs text-[var(--text-secondary)] flex flex-wrap gap-3">
                        <span>
                          Uploader:{' '}
                          <strong className="text-[var(--text-primary)]">
                            {paper.uploaderDisplayName || paper.submittedBy?.name || 'Community'}
                          </strong>
                          {paper.submittedBy?.email ? ` (${paper.submittedBy.email})` : ''}
                        </span>
                        <span>
                          Removed Date:{' '}
                          <strong className="text-[var(--text-primary)] font-mono">
                            {paper.removedAt ? new Date(paper.removedAt).toLocaleString() : 'Recorded'}
                          </strong>
                        </span>
                        <span>
                          Administrator:{' '}
                          <strong className="text-[var(--text-primary)]">
                            {paper.removedBy || 'Studify Administrator'}
                          </strong>
                        </span>
                      </div>

                      <div className="text-xs text-rose-300 bg-rose-500/10 p-2.5 border border-rose-500/20 rounded-lg">
                        <strong>Removal Reason:</strong> {paper.removalReason || 'Removed by Administrator'}
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => {
                          setActionErrorMsg(null);
                          setConfirmRestorePaper(paper);
                        }}
                        disabled={restoringPaperId === paper.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent-blue)] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{restoringPaperId === paper.id ? 'Restoring...' : 'Restore Paper'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectPaper(paper)}
                        className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors flex items-center gap-1 border border-[var(--border-divider)] cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                        <span>Inspect File</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionErrorMsg(null);
                          setConfirmDeletePaper(paper);
                        }}
                        disabled={deletingPaperId === paper.id}
                        className="px-2.5 py-1 text-xs text-[var(--color-red)] bg-[var(--accent-red-bg)] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1 border border-[var(--color-red)]/30 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{deletingPaperId === paper.id ? 'Deleting...' : 'Delete Permanently'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6">
              No removed or unpublished papers at this time.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL & LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Administrative Audit Trail
            </h2>
            <button
              onClick={loadAuditLogs}
              disabled={isLoadingLogs}
              className="p-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg border border-[var(--border-divider)] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {auditLogs.length > 0 ? (
            <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[var(--text-primary)]">
                  <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border-divider)] text-[11px] text-[var(--text-secondary)] uppercase">
                    <tr>
                      <th className="p-3 font-semibold">Timestamp</th>
                      <th className="p-3 font-semibold">Action</th>
                      <th className="p-3 font-semibold">Target</th>
                      <th className="p-3 font-semibold">Moderator</th>
                      <th className="p-3 font-semibold">Details / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--surface-elevated)]/50 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            log.action.includes('restore')
                              ? 'bg-[var(--accent-green-bg)] text-[var(--color-green)]'
                              : log.action.includes('takedown') || log.action.includes('suspend') || log.action.includes('remove') || log.action.includes('delete')
                              ? 'bg-[var(--accent-red-bg)] text-[var(--color-red)]'
                              : 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)]'
                          }`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-xs">
                          {log.target_type}: {log.target_id}
                        </td>
                        <td className="p-3 text-[11px] text-[var(--text-secondary)]">
                          {log.moderator_email ||
                            log.metadata?.moderatorEmail ||
                            log.metadata?.removedBy ||
                            log.metadata?.restoredBy ||
                            log.moderator_id}
                        </td>
                        <td className="p-3 text-xs text-[var(--text-primary)] max-w-md">
                          {log.reason || (log.metadata ? JSON.stringify(log.metadata) : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6">
              No audit logs recorded yet.
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalPaper && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-xl max-w-sm w-full p-5 space-y-3.5 text-xs text-[var(--text-primary)] shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-divider)]">
              <h3 id="reject-modal-title" className="font-semibold text-sm text-[var(--text-primary)]">
                Reject Submission
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalPaper(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed">
              Provide feedback explaining why <strong className="text-[var(--text-primary)]">{rejectModalPaper.title}</strong> cannot be published.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-red)] resize-none"
              placeholder="Reason for not approving"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectModalPaper(null)}
                className="px-3 py-1.5 border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-3.5 py-1.5 bg-[var(--color-red)] text-white font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Takedown Modal */}
      {takedownModalReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="takedown-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-xl max-w-md w-full p-5 space-y-3.5 text-xs text-[var(--text-primary)] shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-divider)]">
              <h3 id="takedown-modal-title" className="font-semibold text-sm text-[var(--color-red)] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirm Paper Takedown</span>
              </h3>
              <button
                type="button"
                onClick={() => setTakedownModalReport(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed">
              This will immediately unpublish and remove document <strong className="text-[var(--text-primary)]">ID: {takedownModalReport.paper_id}</strong> from the public library.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block">
                Official Takedown Reason:
              </label>
              <textarea
                value={takedownReason}
                onChange={(e) => setTakedownReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-red)] resize-none"
                placeholder="Reason recorded in moderation history"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTakedownModalReport(null)}
                className="px-3 py-1.5 border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTakedown}
                className="px-3.5 py-1.5 bg-[var(--color-red)] text-white font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
              >
                Execute Takedown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Suspension Modal */}
      {suspendModalUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspend-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-xl max-w-md w-full p-5 space-y-3.5 text-xs text-[var(--text-primary)] shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-divider)]">
              <h3 id="suspend-modal-title" className="font-semibold text-sm text-[var(--color-red)] flex items-center gap-1.5">
                <UserX className="w-4 h-4" />
                <span>Account Suspension</span>
              </h3>
              <button
                type="button"
                onClick={() => setSuspendModalUser(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed">
              Suspend user <strong className="text-[var(--text-primary)]">{suspendModalUser.userEmail || suspendModalUser.userId}</strong> from uploading documents.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block">
                Suspension Duration:
              </label>
              <select
                value={suspensionDays}
                onChange={(e) => setSuspensionDays(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-xs cursor-pointer"
              >
                <option value={3}>3 Days (Warning / First Offense)</option>
                <option value={7}>7 Days (Temporary)</option>
                <option value={30}>30 Days (Repeat Infringement)</option>
                <option value={365}>1 Year (Severe Violation)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block">
                Suspension Reason:
              </label>
              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-red)] resize-none"
                placeholder="Specific violation details"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSuspendModalUser(null)}
                className="px-3 py-1.5 border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspend}
                className="px-3.5 py-1.5 bg-[var(--color-red)] text-white font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
              >
                Apply Suspension
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Owner-Only Factory Data Reset Modal */}
      {isFactoryResetOpen && isOwner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="factory-reset-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-xl max-w-lg w-full p-5 space-y-4 text-xs text-[var(--text-primary)] shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-divider)]">
              <h3 id="factory-reset-title" className="font-semibold text-sm text-[var(--color-red)] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>Owner Factory Data Reset</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFactoryResetOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed">
              Permanently deletes all test papers, uploaded PDF/image objects in storage, reviews, bookmarks, workspace projects, notes, and feedback while preserving <strong className="text-[var(--text-primary)]">auth.users</strong>, <strong className="text-[var(--text-primary)]">user_roles</strong>, schemas, RLS policies, and buckets.
            </p>

            {isLoadingResetPreview ? (
              <div className="p-4 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-center text-[var(--text-secondary)]">
                Inspecting live database & storage counts...
              </div>
            ) : factoryResetPreview ? (
              <div className="space-y-2 p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] font-mono text-[11px]">
                <div className="font-semibold text-[var(--text-primary)]">Dry-Run Preview:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(factoryResetPreview.storageBuckets || []).map((b: any) => (
                    <div key={b.bucket} className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">bucket/{b.bucket}:</span>
                      <span className="font-semibold">{b.objectCount} files</span>
                    </div>
                  ))}
                  {(factoryResetPreview.databaseTables || [])
                    .filter((t: any) => t.exists && t.rowCount > 0)
                    .map((t: any) => (
                      <div key={t.table} className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">{t.table}:</span>
                        <span className="font-semibold">{t.rowCount} rows</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {factoryResetError && (
              <div className="p-2.5 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-[var(--color-red)]">
                {factoryResetError}
              </div>
            )}

            <form onSubmit={handleExecuteFactoryReset} className="space-y-3">
              <label className="flex items-center gap-2 text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetPreserveModeration}
                  onChange={(e) => setResetPreserveModeration(e.target.checked)}
                />
                <span>Preserve moderation logs & reports</span>
              </label>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                  Type <code className="text-[var(--text-primary)] font-bold">RESET STUDIFY TEST DATA</code> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmationInput}
                  onChange={(e) => setResetConfirmationInput(e.target.value)}
                  placeholder="RESET STUDIFY TEST DATA"
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-red)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsFactoryResetOpen(false)}
                  className="px-3 py-1.5 border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExecutingReset || resetConfirmationInput !== 'RESET STUDIFY TEST DATA'}
                  className="px-3.5 py-1.5 bg-[var(--color-red)] text-white font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  {isExecutingReset ? 'Resetting...' : 'Execute Factory Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeletePaper && (
        <ConfirmDialog
          isOpen={true}
          title="Delete Submission Permanently"
          description={`Are you sure you want to permanently delete "${confirmDeletePaper.title}" from the database and storage? This action cannot be undone.`}
          confirmLabel="Delete Permanently"
          isBusy={Boolean(deletingPaperId)}
          errorMessage={actionErrorMsg}
          onConfirm={() => handleDelete(confirmDeletePaper)}
          onCancel={() => {
            if (!deletingPaperId) {
              setConfirmDeletePaper(null);
              setActionErrorMsg(null);
            }
          }}
        />
      )}

      {confirmRestorePaper && (
        <ConfirmDialog
          isOpen={true}
          title="Restore Unpublished Paper"
          description={`Restore "${confirmRestorePaper.title}" to its previous published state? Existing storage files, ratings, reviews, and student bookmarks will be preserved, and the public removal notice will be cleared.`}
          confirmLabel="Restore Paper"
          tone="primary"
          busyLabel="Restoring..."
          isBusy={Boolean(restoringPaperId)}
          errorMessage={actionErrorMsg}
          onConfirm={() => handleConfirmRestore(confirmRestorePaper)}
          onCancel={() => {
            if (!restoringPaperId) {
              setConfirmRestorePaper(null);
              setActionErrorMsg(null);
            }
          }}
        />
      )}
    </div>
  );
};
