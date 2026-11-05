import { PaperRemovalRequest, ReportCategory, RemovalReasonCategory } from '../types/removal';
import { Paper } from '../types';
import { supabase } from '../supabaseClient.js';
import { supabaseDb } from './supabaseDb';

const REPORTS_CACHE_KEY = 'studify_reports_cache_v3';

export const removalService = {
  /**
   * Fetch all reports for the administrator queue from community_reports table.
   */
  async getReportsForAdmin(): Promise<PaperRemovalRequest[]> {
    try {
      const reports = await supabaseDb.fetchReports();
      if (reports && reports.length > 0) {
        const mapped: PaperRemovalRequest[] = reports.map((r: any) => ({
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
          adminDecision: r.admin_notes,
          adminNotes: r.admin_notes,
        }));

        this.saveLocalReports(mapped);
        return mapped;
      }

      return this.getLocalReports();
    } catch {
      return this.getLocalReports();
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
   * Submit a new database-backed report.
   */
  async createRequest(params: {
    paper: Paper;
    reporterName?: string;
    reporterEmail?: string;
    reasonCategory: ReportCategory;
    reasonDetails: string;
    evidenceUrl?: string;
  }): Promise<{ success: boolean; error?: string; request?: PaperRemovalRequest }> {
    try {
      await supabaseDb.submitReport({
        paperId: params.paper.id,
        reasonCategory: params.reasonCategory,
        reasonDetails: params.reasonDetails,
        reporterEmail: params.reporterEmail || '',
        reporterName: params.reporterName || 'Student',
      });
    } catch (err: any) {
      return { success: false, error: err.message };
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

    const existing = this.getLocalReports();
    this.saveLocalReports([newReport, ...existing]);

    return { success: true, request: newReport };
  },

  /**
   * Dismiss a report without taking down the paper.
   */
  async dismissRequest(requestId: string, adminNotes?: string): Promise<boolean> {
    try {
      await supabaseDb.updateReportStatus(requestId, 'dismissed', adminNotes);
    } catch (err) {
      console.warn('Dismiss report warning:', err);
    }

    const all = this.getLocalReports();
    const updated = all.map((r) =>
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
    try {
      await supabaseDb.takedownPaper(paperId, reason || 'Paper taken down following verified community report.');
    } catch (err) {
      console.warn('Admin takedown warning:', err);
    }

    const all = this.getLocalReports();
    const updated = all.map((r) =>
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
    try {
      const stored = localStorage.getItem(REPORTS_CACHE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveLocalReports(reports: PaperRemovalRequest[]): void {
    try {
      localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(reports));
      window.dispatchEvent(new CustomEvent('studify:removal-requests-updated'));
    } catch {
      // ignore
    }
  },
};
