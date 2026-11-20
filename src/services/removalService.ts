import { PaperRemovalRequest, ReportCategory, RemovalReasonCategory } from '../types/removal';
import { Paper } from '../types';
import { supabase } from '../supabaseClient.js';
import { supabaseDb } from './supabaseDb';

const REPORTS_CACHE_KEY = 'studify_reports_cache_v3';

// In-memory runtime store only — never persisted in localStorage
let inMemoryReports: PaperRemovalRequest[] = [];

function clearLegacyReportsCache() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REPORTS_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}

clearLegacyReportsCache();

export const removalService = {
  /**
   * Fetch all reports for the administrator queue from paper_reports table.
   */
  async getReportsForAdmin(): Promise<PaperRemovalRequest[]> {
    clearLegacyReportsCache();
    try {
      const res = await supabaseDb.fetchReportsWithStatus();
      if (res.synced) {
        const mapped: PaperRemovalRequest[] = res.reports.map((r: any) => ({
          id: r.id,
          paperId: r.paper_id,
          paperTitle: r.paper?.title || 'Question Paper',
          paperSubject: r.paper?.subject || '',
          paperExamBoard: r.paper?.exam_board || '',
          paperYear: r.paper?.year || 2024,
          uploaderId: '',
          uploaderName: r.paper?.uploader_display_name || 'Academic Contributor',
          reporterId: r.reporter_id,
          reporterName: r.reporter_name || 'Student',
          reporterEmail: r.reporter_email,
          reasonCategory: r.reason_category as RemovalReasonCategory,
          reasonDetails: r.reason_details,
          status: r.status,
          createdAt: r.created_at,
          resolvedAt: r.resolved_at,
          adminDecision: r.resolution_notes || r.admin_notes,
          adminNotes: r.resolution_notes || r.admin_notes,
        }));

        this.saveLocalReports(mapped);
        return mapped;
      }

      this.clearLocalReports();
      return [];
    } catch {
      this.clearLocalReports();
      return [];
    }
  },

  /**
   * Fetch reports targeted to or submitted by a specific user.
   */
  async getRequestsForUploader(uploaderId: string, uploaderEmail?: string): Promise<PaperRemovalRequest[]> {
    const all = await this.getReportsForAdmin();
    return all.filter((r) => r.uploaderId === uploaderId || (uploaderEmail && r.reporterEmail === uploaderEmail));
  },

  /**
   * Submit a new database-backed report. Fails explicitly if database insert fails.
   */
  async createRequest(params: {
    paper: Paper;
    reporterName?: string;
    reporterEmail?: string;
    reasonCategory: ReportCategory;
    reasonDetails: string;
    evidenceUrl?: string;
  }): Promise<{ success: boolean; error?: string; request?: PaperRemovalRequest }> {
    const submitRes = await supabaseDb.submitReport({
      paperId: params.paper.id,
      reasonCategory: params.reasonCategory,
      reasonDetails: params.reasonDetails,
      evidenceUrl: params.evidenceUrl,
      reporterEmail: params.reporterEmail || '',
      reporterName: params.reporterName || 'Student',
    });

    if (!submitRes.success) {
      return {
        success: false,
        error: submitRes.error?.message || 'Could not submit report to database.',
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    const newReport: PaperRemovalRequest = {
      id: `rep-${Date.now()}`,
      paperId: params.paper.id,
      paperTitle: params.paper.title,
      paperSubject: params.paper.subject,
      paperExamBoard: params.paper.examBoard,
      paperYear: params.paper.year,
      uploaderId: params.paper.submittedBy?.id || '',
      uploaderName: params.paper.uploaderDisplayName || params.paper.submittedBy?.name || 'Academic Contributor',
      reporterId: user?.id,
      reporterName: params.reporterName || user?.user_metadata?.name || 'Student',
      reporterEmail: params.reporterEmail || user?.email || '',
      reasonCategory: params.reasonCategory,
      reasonDetails: params.reasonDetails.trim(),
      evidenceUrl: params.evidenceUrl?.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.saveLocalReports([newReport, ...inMemoryReports]);

    return { success: true, request: newReport };
  },

  /**
   * Dismiss a report without taking down the paper.
   */
  async dismissRequest(requestId: string, adminNotes?: string): Promise<boolean> {
    const res = await supabaseDb.updateReportStatus(requestId, 'dismissed', adminNotes);
    if (!res.success) {
      return false;
    }

    const updated = inMemoryReports.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: 'dismissed' as const,
            resolvedAt: new Date().toISOString(),
            adminDecision: adminNotes || 'Dismissed by administrator',
            adminNotes: adminNotes,
          }
        : r
    );
    this.saveLocalReports(updated);
    return true;
  },

  /**
   * Complete takedown via admin procedure.
   */
  async removePaperViaRequest(requestId: string, paperId: string, reason?: string): Promise<boolean> {
    const res = await supabaseDb.takedownPaper(
      paperId,
      reason || 'Paper taken down following verified community report.'
    );
    if (!res.success) {
      return false;
    }

    const updated = inMemoryReports.map((r) =>
      r.id === requestId || r.paperId === paperId
        ? {
            ...r,
            status: 'removed' as const,
            resolvedAt: new Date().toISOString(),
            adminDecision: reason || 'Paper taken down',
            adminNotes: reason,
          }
        : r
    );
    this.saveLocalReports(updated);
    return true;
  },

  getLocalReports(): PaperRemovalRequest[] {
    return [...inMemoryReports];
  },

  saveLocalReports(reports: PaperRemovalRequest[]): void {
    inMemoryReports = Array.isArray(reports) ? [...reports] : [];
    clearLegacyReportsCache();
    try {
      window.dispatchEvent(new CustomEvent('studify:removal-requests-updated'));
    } catch {
      // ignore
    }
  },

  clearLocalReports(): void {
    inMemoryReports = [];
    clearLegacyReportsCache();
  },
};
