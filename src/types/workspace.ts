import { ExamBoard, GradeLevel, Paper } from './index';

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
}

export interface ProjectNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isPinned?: boolean;
}

export interface ProjectResource {
  id: string;
  title: string;
  url: string;
  type: 'link' | 'video' | 'doc' | 'book';
  notes?: string;
}

export interface StudyProject {
  id: string;
  title: string;
  subject: string;
  examBoard?: ExamBoard | string;
  targetExam?: string;
  targetDate?: string;
  color: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'sky';
  icon?: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  paperIds: string[]; // IDs of attached Studify PYQs
  tasks: ProjectTask[];
  notes: ProjectNote[];
  resources: ProjectResource[];
}

export type QuickCaptureType = 'thought' | 'formula' | 'doubt' | 'resource';

export interface QuickCaptureItem {
  id: string;
  content: string;
  title?: string;
  type: QuickCaptureType;
  projectId?: string; // Optional association with a project
  tags: string[];
  createdAt: string;
  isResolved?: boolean;
}

export interface WorkspaceSession {
  lastActiveTab: string;
  activeProjectId?: string;
  lastViewedPaperId?: string;
  lastAction?: string;
  timestamp: string;
}

export interface TopicWeightage {
  chapter: string;
  weightPercent: number;
  predictedQuestionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  recurringConcepts: string[];
  estimatedMarks: number;
}

export interface ExamPredictionResult {
  id: string;
  board: ExamBoard;
  grade: GradeLevel;
  subject: string;
  targetYear: number;
  confidenceScore: number;
  totalMarks: number;
  timeAllowedMinutes: number;
  topicWeightages: TopicWeightage[];
  assembledPaper: Paper;
  preparationStrategy: string[];
}
