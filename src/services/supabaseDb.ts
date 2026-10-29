import { supabase } from '../supabaseClient.js';
import { StudyProject, QuickCaptureItem } from '../types/workspace';
import { Paper } from '../types';
import { supabaseStorage } from './supabaseStorage';

/**
 * Supabase Database Service
 * Provides direct CRUD queries for User Projects, Quick Captures, Bookmarks, and Papers
 * Protected by Row Level Security (RLS) enforcing auth.uid() = user_id
 */
export const supabaseDb = {
  // =========================================================================
  // 1. STUDY PROJECTS
  // =========================================================================

  /**
   * Load current authenticated user's projects from Supabase
   */
  async loadProjects(): Promise<StudyProject[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('study_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase loadProjects error:', error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      examBoard: row.exam_board,
      targetExam: row.target_exam,
      targetDate: row.target_date,
      color: row.color,
      icon: row.icon,
      description: row.description,
      status: row.status,
      paperIds: row.paper_ids || [],
      tasks: row.tasks || [],
      notes: row.notes || [],
      resources: row.resources || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * Create a new project for the current authenticated user
   */
  async createProject(project: StudyProject): Promise<StudyProject | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const row = {
      id: project.id,
      user_id: user.id,
      title: project.title,
      subject: project.subject,
      exam_board: project.examBoard,
      target_exam: project.targetExam,
      target_date: project.targetDate,
      color: project.color,
      icon: project.icon,
      description: project.description,
      status: project.status,
      paper_ids: project.paperIds,
      tasks: project.tasks,
      notes: project.notes,
      resources: project.resources,
      created_at: project.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('study_projects')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.warn('Supabase createProject error:', error.message);
      return null;
    }

    return project;
  },

  /**
   * Update an existing project belonging to the user
   */
  async updateProject(id: string, updates: Partial<StudyProject>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.subject !== undefined) payload.subject = updates.subject;
    if (updates.examBoard !== undefined) payload.exam_board = updates.examBoard;
    if (updates.targetExam !== undefined) payload.target_exam = updates.targetExam;
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.icon !== undefined) payload.icon = updates.icon;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.paperIds !== undefined) payload.paper_ids = updates.paperIds;
    if (updates.tasks !== undefined) payload.tasks = updates.tasks;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.resources !== undefined) payload.resources = updates.resources;

    const { error } = await supabase
      .from('study_projects')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Supabase updateProject error:', error.message);
      return false;
    }

    return true;
  },

  /**
   * Delete a project belonging to the user
   */
  async deleteProject(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('study_projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Supabase deleteProject error:', error.message);
      return false;
    }

    return true;
  },

  // =========================================================================
  // 2. QUICK CAPTURES (INBOX & SCRATCHPAD)
  // =========================================================================

  /**
   * Load user quick captures from Supabase
   */
  async loadQuickCaptures(): Promise<QuickCaptureItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('quick_captures')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase loadQuickCaptures error:', error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      projectId: row.project_id,
      tags: row.tags || [],
      createdAt: row.created_at,
      isResolved: row.is_resolved,
    }));
  },

  /**
   * Create a new quick capture
   */
  async createQuickCapture(item: QuickCaptureItem): Promise<QuickCaptureItem | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const row = {
      id: item.id,
      user_id: user.id,
      title: item.title || '',
      content: item.content,
      type: item.type,
      project_id: item.projectId || null,
      tags: item.tags,
      is_resolved: item.isResolved || false,
      created_at: item.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from('quick_captures')
      .insert([row]);

    if (error) {
      console.warn('Supabase createQuickCapture error:', error.message);
      return null;
    }

    return item;
  },

  /**
   * Update quick capture status or contents
   */
  async updateQuickCapture(id: string, updates: Partial<QuickCaptureItem>): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const payload: Record<string, any> = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.content !== undefined) payload.content = updates.content;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.isResolved !== undefined) payload.is_resolved = updates.isResolved;

    const { error } = await supabase
      .from('quick_captures')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Supabase updateQuickCapture error:', error.message);
      return false;
    }

    return true;
  },

  /**
   * Delete a quick capture item
   */
  async deleteQuickCapture(id: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('quick_captures')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Supabase deleteQuickCapture error:', error.message);
      return false;
    }

    return true;
  },

  // =========================================================================
  // 3. SAVED PAPERS / BOOKMARKS
  // =========================================================================

  /**
   * Load IDs of papers bookmarked by current user
   */
  async loadSavedPaperIds(): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('saved_papers')
      .select('paper_id')
      .eq('user_id', user.id);

    if (error) {
      console.warn('Supabase loadSavedPaperIds error:', error.message);
      return [];
    }

    return (data || []).map((row) => row.paper_id);
  },

  /**
   * Bookmark a paper
   */
  async savePaper(paperId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('saved_papers')
      .insert([{ user_id: user.id, paper_id: paperId }]);

    if (error && error.code !== '23505') { // 23505 is unique violation (already saved)
      console.warn('Supabase savePaper error:', error.message);
      return false;
    }

    return true;
  },

  /**
   * Remove a paper from bookmarks
   */
  async removeSavedPaper(paperId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('saved_papers')
      .delete()
      .eq('user_id', user.id)
      .eq('paper_id', paperId);

    if (error) {
      console.warn('Supabase removeSavedPaper error:', error.message);
      return false;
    }

    return true;
  },

  // =========================================================================
  // 4. PAPERS (COMMUNITY & USER SUBMISSIONS)
  // =========================================================================

  /**
   * Load papers from Supabase (falls back cleanly if table empty)
   */
  async loadPapers(): Promise<Paper[]> {
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase loadPapers error:', error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      grade: row.grade,
      examBoard: row.exam_board,
      year: row.year,
      chapter: row.chapter,
      description: row.description,
      totalMarks: row.total_marks,
      timeAllowedMinutes: row.time_allowed_minutes,
      fileName: row.file_name || 'paper.pdf',
      fileSizeBytes: row.file_size_bytes || 2500000,
      fileUrl: row.file_url,
      tags: row.tags || [row.subject, row.grade, row.exam_board],
      status: row.status,
      submittedBy: row.submitted_by || { id: row.user_id, name: 'Student', email: '' },
      submittedAt: row.created_at,
      approvedAt: row.status === 'approved' ? row.updated_at : undefined,
      sections: row.sections || [],
      viewsCount: row.views_count || 0,
      downloadsCount: row.downloads_count || 0,
      rating: Number(row.rating || 5.0),
      ratingCount: row.rating_count || 1,
      reviews: row.reviews || [],
      comments: row.comments || [],
    }));
  },

  /**
   * Insert a new user-submitted paper
   */
  async createPaper(paper: Paper): Promise<Paper | null> {
    const { data: { user } } = await supabase.auth.getUser();

    const row = {
      id: paper.id,
      user_id: user?.id || null,
      title: paper.title,
      subject: paper.subject,
      grade: paper.grade,
      exam_board: paper.examBoard,
      year: paper.year,
      chapter: paper.chapter || null,
      description: paper.description || null,
      total_marks: paper.totalMarks,
      time_allowed_minutes: paper.timeAllowedMinutes,
      file_name: paper.fileName || null,
      file_url: paper.fileUrl || null,
      file_size_bytes: paper.fileSizeBytes || null,
      tags: paper.tags || [],
      status: paper.status,
      submitted_by: paper.submittedBy,
      sections: paper.sections || [],
      views_count: paper.viewsCount || 0,
      downloads_count: paper.downloadsCount || 0,
      rating: paper.rating || 5.0,
      rating_count: paper.ratingCount || 1,
      reviews: paper.reviews || [],
      comments: paper.comments || [],
      created_at: paper.submittedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('papers')
      .insert([row]);

    if (error) {
      console.warn('Supabase createPaper error:', error.message);
      return null;
    }

    return paper;
  },

  /**
   * Update paper (status, reviews, comments, view/download counts)
   */
  async updatePaper(id: string, updates: Partial<Paper>): Promise<boolean> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.viewsCount !== undefined) payload.views_count = updates.viewsCount;
    if (updates.downloadsCount !== undefined) payload.downloads_count = updates.downloadsCount;
    if (updates.rating !== undefined) payload.rating = updates.rating;
    if (updates.ratingCount !== undefined) payload.rating_count = updates.ratingCount;
    if (updates.reviews !== undefined) payload.reviews = updates.reviews;
    if (updates.comments !== undefined) payload.comments = updates.comments;

    const { error } = await supabase
      .from('papers')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.warn('Supabase updatePaper error:', error.message);
      return false;
    }

    return true;
  },

  /**
   * Delete paper (removes associated file from Supabase Storage and deletes database record)
   */
  async deletePaper(id: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('papers')
        .select('file_url')
        .eq('id', id)
        .single();

      if (data?.file_url) {
        await supabaseStorage.deleteAppFile(data.file_url);
      }
    } catch (e) {
      console.warn('Supabase storage check before delete note:', e);
    }

    const { error } = await supabase
      .from('papers')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Supabase deletePaper error:', error.message);
      return false;
    }

    return true;
  },

  // =========================================================================
  // 5. NOTES (STUDY NOTES & AI FORMULA REVISION)
  // =========================================================================

  /**
   * Count the number of notes in the "notes" table where user_id = current user id
   * Fetches current authenticated user via supabase.auth.getUser()
   */
  async countNotes(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        console.warn('Supabase count notes error:', error.message);
        return 0;
      }

      return count ?? 0;
    } catch (err) {
      console.warn('Supabase countNotes exception:', err);
      return 0;
    }
  },

  /**
   * Insert or update a note in the "notes" table
   */
  async createNote(note: {
    id: string;
    projectId?: string;
    title: string;
    content: string;
    tags?: string[];
    isPinned?: boolean;
  }): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const row = {
        id: note.id,
        user_id: user.id,
        project_id: note.projectId || null,
        title: note.title,
        content: note.content,
        tags: note.tags || [],
        is_pinned: note.isPinned || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notes')
        .upsert([row]);

      if (error) {
        console.warn('Supabase createNote error:', error.message);
        return false;
      }

      window.dispatchEvent(new CustomEvent('studify:notes-updated'));
      return true;
    } catch (e) {
      console.warn('createNote exception', e);
      return false;
    }
  },

  /**
   * Delete a note from the "notes" table
   */
  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('Supabase deleteNote error:', error.message);
        return false;
      }

      window.dispatchEvent(new CustomEvent('studify:notes-updated'));
      return true;
    } catch (e) {
      console.warn('deleteNote exception', e);
      return false;
    }
  },
};

