export type RemovalReasonCategory =
  | 'copyright'
  | 'incorrect_solution'
  | 'poor_quality'
  | 'duplicate'
  | 'outdated_syllabus'
  | 'inappropriate'
  | 'other';

export interface PaperRemovalRequest {
  id: string;
  paperId: string;
  paperTitle: string;
  paperSubject: string;
  paperExamBoard: string;
  paperYear: number;
  uploaderId: string;
  uploaderName: string;
  uploaderEmail: string;
  reporterName: string;
  reporterEmail?: string;
  reasonCategory: RemovalReasonCategory;
  reasonDetails: string;
  status: 'pending' | 'resolved' | 'dismissed' | 'removed';
  createdAt: string;
  resolvedAt?: string;
  uploaderResponse?: string;
}
