export type ExamBoard = 'CBSE' | 'ICSE' | 'JEE Main' | 'JEE Advanced' | 'NEET UG';

export type GradeLevel = 'Class 9' | 'Class 10' | 'Class 11' | 'Class 12' | 'Competitive';

export type PaperStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'flagged' | 'archived' | 'takedown' | 'removed';

export interface QuestionChoice {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface Question {
  id: string;
  number: number;
  section: string;
  text: string;
  marks: number;
  type?: 'mcq' | 'short_answer' | 'long_answer' | 'numerical';
  choices?: QuestionChoice[];
  formula?: string;
  solutionHint?: string;
}

export interface PaperSection {
  id: string;
  name: string;
  title: string;
  instructions: string;
  totalMarks: number;
  questions: Question[];
}

export interface PaperReview {
  id: string;
  stars: number;
  text?: string;
  authorName: string;
  createdAt: string;
  userId?: string;
}

export interface PaperComment {
  id: string;
  authorName: string;
  authorEmail?: string;
  text: string;
  createdAt: string;
}

export interface PaperRemovalNotice {
  id: string;
  title: string;
  subject: string;
  examBoard: string;
  grade: string;
  year: number;
  removalReason: string;
  removedAt: string;
  removedBy: string;
}

export interface Paper {
  id: string;
  title: string;
  examBoard: ExamBoard;
  grade: GradeLevel;
  subject: string;
  year: number;
  chapter?: string;
  eventName?: string;
  totalMarks?: number;
  timeAllowedMinutes?: number;
  description: string;
  status: PaperStatus;
  previousStatus?: string;
  isRemoved?: boolean;
  rejectionReason?: string;
  removalReason?: string;
  removedBy?: string;
  removedAt?: string;
  submittedBy: {
    id: string;
    name: string;
    email: string;
  };
  submittedAt: string;
  approvedAt?: string;
  viewsCount: number;
  downloadsCount: number;
  fileName: string;
  fileSizeBytes: number;
  fileUrl?: string;
  filePath?: string;
  isImageBased?: boolean;
  imageUrls?: string[];
  imagePaths?: string[];
  pageCount?: number;
  uploaderDisplayName?: string;
  sections: PaperSection[];
  tags: string[];
  rating?: number;
  ratingCount?: number;
  reviews?: PaperReview[];
  comments?: PaperComment[];
  isFlagged?: boolean;
  reportCount?: number;
  moderationNotes?: string;
}

export type DeletePaperErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'STORAGE_PERMISSION_ERROR'
  | 'STORAGE_NETWORK_ERROR'
  | 'STORAGE_PARTIAL_DELETE'
  | 'STORAGE_ERROR'
  | 'DB_DELETE_FAILED_AFTER_STORAGE_DELETE'
  | 'DB_ERROR';

export type DeletePaperOutcomeCode =
  | 'DELETED'
  | 'DELETED_WITH_MISSING_STORAGE'
  | DeletePaperErrorCode;

export interface DeleteCommunityPyqResult {
  success: boolean;
  code: DeletePaperOutcomeCode;
  error: Error | null;
  storageDeleted: boolean;
  dbDeleted: boolean;
  deletedPaths: string[];
  missingPaths: string[];
  failedPaths?: { path: string; reason: string }[];
  storagePartiallyDeleted?: boolean;
}

export type UserRole = 'student' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  institution?: string;
  joinedDate?: string;
  createdAt: string | null;
}

export interface AppAdmin {
  user_id: string;
  role: 'owner' | 'moderator';
  assigned_at: string;
}

export interface FilterState {
  searchQuery: string;
  board: string;
  grade: string;
  subject: string;
  year: string;
  chapter: string;
  sortBy: 'latest' | 'popular' | 'marks' | 'yearDesc' | 'yearAsc';
}
