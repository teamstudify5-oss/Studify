import { PaperRemovalRequest, RemovalReasonCategory } from '../types/removal';
import { Paper } from '../types';
import { storageService } from './storage';
import { supabase } from '../supabaseClient.js';

const REMOVAL_REQUESTS_KEY = 'studify_removal_requests_v1';

export const removalService = {
  getRequests(): PaperRemovalRequest[] {
    try {
      const stored = localStorage.getItem(REMOVAL_REQUESTS_KEY);
      if (!stored) {
        // Initial sample requests for demo verification
        const initial: PaperRemovalRequest[] = [
          {
            id: 'req-sample-1',
            paperId: 'pyq-cbse-12-phy-2024',
            paperTitle: 'CBSE Class 12 Physics Board Examination 2024 (Theory)',
            paperSubject: 'Physics',
            paperExamBoard: 'CBSE',
            paperYear: 2024,
            uploaderId: 'owner-studify-admin',
            uploaderName: 'Studify Academic Team',
            uploaderEmail: 'admin@studify.org',
            reporterName: 'Priya Sharma (Student)',
            reporterEmail: 'priya.s@student.edu',
            reasonCategory: 'incorrect_solution',
            reasonDetails: 'Question 14 numerical solution step uses wrong permittivity constant value (8.85 vs 8.854), resulting in a slight mismatch with official answer key.',
            status: 'pending',
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          },
        ];
        localStorage.setItem(REMOVAL_REQUESTS_KEY, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  saveRequests(requests: PaperRemovalRequest[]): void {
    try {
      localStorage.setItem(REMOVAL_REQUESTS_KEY, JSON.stringify(requests));
      window.dispatchEvent(new CustomEvent('studify:removal-requests-updated'));
    } catch (e) {
      console.error('Failed to save removal requests', e);
    }
  },

  /**
   * Create a new removal request targeted directly to the paper's uploader account
   */
  async createRequest(params: {
    paper: Paper;
    reporterName: string;
    reporterEmail?: string;
    reasonCategory: RemovalReasonCategory;
    reasonDetails: string;
  }): Promise<PaperRemovalRequest> {
    const requests = this.getRequests();

    const uploaderId = params.paper.submittedBy?.id || 'owner-studify-admin';
    const uploaderName = params.paper.submittedBy?.name || 'Academic Contributor';
    const uploaderEmail = params.paper.submittedBy?.email || 'contributor@studify.org';

    const newRequest: PaperRemovalRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      paperId: params.paper.id,
      paperTitle: params.paper.title,
      paperSubject: params.paper.subject,
      paperExamBoard: params.paper.examBoard,
      paperYear: params.paper.year,
      uploaderId,
      uploaderName,
      uploaderEmail,
      reporterName: params.reporterName.trim() || 'Anonymous Student',
      reporterEmail: params.reporterEmail?.trim(),
      reasonCategory: params.reasonCategory,
      reasonDetails: params.reasonDetails.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    requests.unshift(newRequest);
    this.saveRequests(requests);

    // Attempt to store in Supabase if table exists
    try {
      await supabase.from('removal_requests').insert([
        {
          id: newRequest.id,
          paper_id: newRequest.paperId,
          uploader_id: newRequest.uploaderId,
          uploader_email: newRequest.uploaderEmail,
          reporter_name: newRequest.reporterName,
          reporter_email: newRequest.reporterEmail,
          reason_category: newRequest.reasonCategory,
          reason_details: newRequest.reasonDetails,
          status: newRequest.status,
          created_at: newRequest.createdAt,
        },
      ]);
    } catch (e) {
      // Graceful local-first fallback
    }

    return newRequest;
  },

  /**
   * Get all removal requests received by a specific uploader (by user ID or email)
   */
  getRequestsForUploader(userId: string, userEmail?: string): PaperRemovalRequest[] {
    const all = this.getRequests();
    return all.filter((r) => {
      if (r.uploaderId === userId) return true;
      if (userEmail && r.uploaderEmail && r.uploaderEmail.toLowerCase() === userEmail.toLowerCase()) {
        return true;
      }
      return false;
    });
  },

  /**
   * Count pending removal requests for a specific uploader
   */
  getPendingCountForUploader(userId: string, userEmail?: string): number {
    const requests = this.getRequestsForUploader(userId, userEmail);
    return requests.filter((r) => r.status === 'pending').length;
  },

  /**
   * Get all requests for a specific paper
   */
  getRequestsForPaper(paperId: string): PaperRemovalRequest[] {
    const all = this.getRequests();
    return all.filter((r) => r.paperId === paperId);
  },

  /**
   * The uploader chooses to dismiss the request (keep the paper)
   */
  dismissRequest(requestId: string, uploaderResponse?: string): boolean {
    const requests = this.getRequests();
    const target = requests.find((r) => r.id === requestId);
    if (!target) return false;

    target.status = 'dismissed';
    target.resolvedAt = new Date().toISOString();
    if (uploaderResponse) {
      target.uploaderResponse = uploaderResponse.trim();
    }

    this.saveRequests(requests);

    // Supabase sync
    Promise.resolve(
      supabase
        .from('removal_requests')
        .update({ status: 'dismissed', resolved_at: target.resolvedAt, uploader_response: uploaderResponse })
        .eq('id', requestId)
    ).catch(() => {});

    return true;
  },

  /**
   * The uploader accepts the request and removes/deletes the paper from the platform
   */
  removePaperViaRequest(requestId: string, paperId: string, uploaderResponse?: string): boolean {
    // 1. Delete paper using standard storageService
    storageService.deletePaper(paperId);

    // 2. Mark this and any other requests for this paper as 'removed'
    const requests = this.getRequests();
    requests.forEach((r) => {
      if (r.id === requestId || r.paperId === paperId) {
        r.status = 'removed';
        r.resolvedAt = new Date().toISOString();
        if (uploaderResponse) {
          r.uploaderResponse = uploaderResponse.trim();
        }
      }
    });

    this.saveRequests(requests);

    // Supabase sync
    Promise.resolve(
      supabase
        .from('removal_requests')
        .update({ status: 'removed', resolved_at: new Date().toISOString() })
        .eq('paper_id', paperId)
    ).catch(() => {});

    return true;
  },
};
