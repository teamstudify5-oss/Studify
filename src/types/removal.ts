export type RemovalReasonCategory =
  | 'copyright'
  | 'incorrect_content'
  | 'poor_quality'
  | 'duplicate'
  | 'spam'
  | 'unsafe_file'
  | 'privacy_violation'
  | 'other'
  | 'incorrect_solution'
  | 'inappropriate'
  | 'outdated_syllabus';

export type ReportCategory = RemovalReasonCategory;

export interface PaperRemovalRequest {
  id: string;
  paperId: string;
  paperTitle: string;
  paperSubject: string;
  paperExamBoard: string;
  paperYear: number;
  uploaderId: string;
  uploaderName: string;
  uploaderEmail?: string;
  reporterId?: string;
  reporterName: string;
  reporterEmail?: string;
  reasonCategory: RemovalReasonCategory;
  reasonDetails: string;
  evidenceUrl?: string;
  status: 'pending' | 'resolved' | 'dismissed' | 'removed' | 'open' | 'actioned';
  createdAt: string;
  resolvedAt?: string;
  adminDecision?: string;
  adminNotes?: string;
  uploaderResponse?: string;
}

