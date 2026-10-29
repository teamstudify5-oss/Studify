export type ExamBoard = 'CBSE' | 'ICSE' | 'JEE Main' | 'JEE Advanced' | 'NEET UG';

export type GradeLevel = 'Class 9' | 'Class 10' | 'Class 11' | 'Class 12' | 'Competitive';

export type PaperStatus = 'pending' | 'approved' | 'rejected';

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
}

export interface PaperComment {
  id: string;
  authorName: string;
  authorEmail?: string;
  text: string;
  createdAt: string;
}

export interface Paper {
  id: string;
  title: string;
  examBoard: ExamBoard;
  grade: GradeLevel;
  subject: string;
  year: number;
  chapter?: string;
  totalMarks: number;
  timeAllowedMinutes: number;
  description: string;
  status: PaperStatus;
  rejectionReason?: string;
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
  sections: PaperSection[];
  tags: string[];
  rating?: number;
  ratingCount?: number;
  reviews?: PaperReview[];
  comments?: PaperComment[];
}

export type UserRole = 'student' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  institution?: string;
  joinedDate: string;
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
