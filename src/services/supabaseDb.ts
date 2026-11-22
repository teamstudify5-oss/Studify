import { supabase } from '../supabaseClient.js';
import { StudyProject, QuickCaptureItem } from '../types/workspace';
import { Paper } from '../types';
import { supabaseStorage } from './supabaseStorage';

export interface DbReport {
  id: string;
  paper_id: string;
  reporter_id?: string;
  reporter_name?: string;
  reporter_email?: string;
  reason_category: string;
  reason_details: string;
  evidence_url?: string;
  status: 'pending' | 'resolved' | 'dismissed' | 'taken_down';
  moderator_notes?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface DbModerationLog {
  id: string;
  moderator_id: string;
  moderator_email?: string;
  action: string;
  target_type: string;
  target_id: string;
  reason?: string;
  details?: any;
  metadata?: any;
  created_at: string;
}

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
  async loadProjectsWithStatus(): Promise<{ projects: StudyProject[]; synced: boolean; error: Error | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return { projects: [], synced: false, error: new Error(authError.message) };
    }
    if (!user) {
      return { projects: [], synced: true, error: null };
    }

    const { data, error } = await supabase
      .from('study_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase loadProjects error:', error.message);
      return { projects: [], synced: false, error: new Error(error.message) };
    }

    const projects = (data || []).map((row) => ({
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

    return { projects, synced: true, error: null };
  },

  async loadProjects(): Promise<StudyProject[]> {
    const res = await this.loadProjectsWithStatus();
    return res.projects;
  },

  /**
   * Create a new project for the current authenticated user, returning explicit error on failure
   */
  async createProjectWithStatus(project: StudyProject): Promise<{ project: StudyProject | null; error: Error | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        project: null,
        error: new Error(authError?.message || 'Sign in required to save project to cloud.'),
      };
    }

    const row = {
      id: project.id,
      user_id: user.id,
      title: project.title,
      subject: project.subject?.trim() || '',
      exam_board: project.examBoard || null,
      target_exam: project.targetExam || null,
      target_date: project.targetDate || null,
      color: project.color || 'cyan',
      icon: project.icon || null,
      description: project.description?.trim() || '',
      status: project.status || 'active',
      paper_ids: project.paperIds || [],
      tasks: project.tasks || [],
      notes: project.notes || [],
      resources: project.resources || [],
      created_at: project.createdAt || new Date().toISOString(),
      updated_at: project.updatedAt || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('study_projects')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.warn('Supabase createProject error:', error.message);
      return { project: null, error: new Error(error.message) };
    }

    const savedProject: StudyProject = data
      ? {
          id: data.id,
          title: data.title,
          subject: data.subject || undefined,
          examBoard: data.exam_board || undefined,
          targetExam: data.target_exam || undefined,
          targetDate: data.target_date || undefined,
          color: data.color || 'cyan',
          icon: data.icon || undefined,
          description: data.description || undefined,
          status: data.status || 'active',
          paperIds: data.paper_ids || [],
          tasks: data.tasks || [],
          notes: data.notes || [],
          resources: data.resources || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      : project;

    return { project: savedProject, error: null };
  },

  async createProject(project: StudyProject): Promise<StudyProject | null> {
    const res = await this.createProjectWithStatus(project);
    return res.project;
  },

  /**
   * Update an existing project belonging to the user
   */
  async updateProjectWithStatus(id: string, updates: Partial<StudyProject>): Promise<{ success: boolean; error: Error | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: new Error(authError?.message || 'Sign in required to update project.'),
      };
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.subject !== undefined) payload.subject = updates.subject?.trim() || '';
    if (updates.examBoard !== undefined) payload.exam_board = updates.examBoard || null;
    if (updates.targetExam !== undefined) payload.target_exam = updates.targetExam || null;
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate || null;
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.icon !== undefined) payload.icon = updates.icon || null;
    if (updates.description !== undefined) payload.description = updates.description?.trim() || '';
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
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  },

  async updateProject(id: string, updates: Partial<StudyProject>): Promise<boolean> {
    const res = await this.updateProjectWithStatus(id, updates);
    return res.success;
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
  async loadQuickCapturesWithStatus(): Promise<{ captures: QuickCaptureItem[]; synced: boolean; error: Error | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return { captures: [], synced: false, error: new Error(authError.message) };
    }
    if (!user) {
      return { captures: [], synced: true, error: null };
    }

    const { data, error } = await supabase
      .from('quick_captures')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase loadQuickCaptures error:', error.message);
      return { captures: [], synced: false, error: new Error(error.message) };
    }

    const captures = (data || []).map((row) => ({
      id: row.id,
      title: row.title || undefined,
      content: row.content || row.text || '',
      type: (row.type || row.tag || 'thought') as QuickCaptureItem['type'],
      projectId: row.project_id || undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      isResolved: Boolean(row.is_resolved),
    }));

    return { captures, synced: true, error: null };
  },

  async loadQuickCaptures(): Promise<QuickCaptureItem[]> {
    const res = await this.loadQuickCapturesWithStatus();
    return res.captures;
  },

  /**
   * Create a new quick capture, returning explicit error on failure
   */
  async createQuickCaptureWithStatus(item: QuickCaptureItem): Promise<{ item: QuickCaptureItem | null; error: Error | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        item: null,
        error: new Error(authError?.message || 'Sign in required to save capture to cloud.'),
      };
    }

    const row = {
      id: item.id,
      user_id: user.id,
      title: item.title || '',
      content: item.content,
      type: item.type || 'thought',
      project_id: item.projectId || null,
      tags: item.tags || [],
      is_resolved: Boolean(item.isResolved),
      created_at: item.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from('quick_captures')
      .insert([row]);

    if (error) {
      console.warn('Supabase createQuickCapture error:', error.message);
      return { item: null, error: new Error(error.message) };
    }

    return { item, error: null };
  },

  async createQuickCapture(item: QuickCaptureItem): Promise<QuickCaptureItem | null> {
    const res = await this.createQuickCaptureWithStatus(item);
    return res.item;
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
  async loadSavedPaperIdsWithStatus(): Promise<{ ids: string[]; synced: boolean; error: Error | null }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return { ids: [], synced: false, error: new Error(authError.message) };
    }
    if (!user) {
      return { ids: [], synced: true, error: null };
    }

    const { data, error } = await supabase
      .from('saved_papers')
      .select('paper_id')
      .eq('user_id', user.id);

    if (error) {
      console.warn('Supabase loadSavedPaperIds error:', error.message);
      return { ids: [], synced: false, error: new Error(error.message) };
    }

    return {
      ids: (data || []).map((row) => row.paper_id),
      synced: true,
      error: null,
    };
  },

  async loadSavedPaperIds(): Promise<string[]> {
    const res = await this.loadSavedPaperIdsWithStatus();
    return res.ids;
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

  /**
   * Remove invalid/orphaned saved_papers rows for the signed-in user
   * without affecting any other user data.
   */
  async pruneInvalidSavedPapers(invalidPaperIds: string[]): Promise<void> {
    if (!invalidPaperIds || invalidPaperIds.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('saved_papers')
        .delete()
        .eq('user_id', user.id)
        .in('paper_id', invalidPaperIds);

      if (error) {
        console.warn('Supabase pruneInvalidSavedPapers notice:', error.message);
      }
    } catch {
      // ignore
    }
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
      rating: row.rating ? Number(row.rating) : undefined,
      ratingCount: row.rating_count ? Number(row.rating_count) : 0,
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
      rating: paper.rating ?? null,
      rating_count: paper.ratingCount ?? 0,
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
   * Delete paper (delegates exclusively to authoritative communityPyqService.deleteCommunityPyq)
   */
  async deletePaper(id: string): Promise<boolean> {
    const { communityPyqService } = await import('./communityPyqService');
    const res = await communityPyqService.deleteCommunityPyq(id);
    return res.success;
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
   * Bug 15 fix: Preserves original created_at timestamp when updating an existing note
   */
  async createNoteWithStatus(note: {
    id: string;
    projectId?: string;
    title: string;
    content: string;
    tags?: string[];
    isPinned?: boolean;
    createdAt?: string;
  }): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: new Error(authError?.message || 'Sign in required to save note to cloud.'),
        };
      }

      // Check if note exists in Supabase to preserve its original created_at timestamp
      let originalCreatedAt = note.createdAt;
      if (!originalCreatedAt) {
        const { data: existing } = await supabase
          .from('notes')
          .select('created_at')
          .eq('id', note.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing?.created_at) {
          originalCreatedAt = existing.created_at;
        }
      }

      const row = {
        id: note.id,
        user_id: user.id,
        project_id: note.projectId || null,
        title: note.title,
        content: note.content,
        tags: note.tags || [],
        is_pinned: note.isPinned || false,
        created_at: originalCreatedAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notes')
        .upsert([row]);

      if (error) {
        console.warn('Supabase createNote error:', error.message);
        return { success: false, error: new Error(error.message) };
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studify:notes-updated'));
      }
      return { success: true, error: null };
    } catch (e: any) {
      console.warn('createNote exception', e);
      return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  },

  async createNote(note: {
    id: string;
    projectId?: string;
    title: string;
    content: string;
    tags?: string[];
    isPinned?: boolean;
    createdAt?: string;
  }): Promise<boolean> {
    const res = await this.createNoteWithStatus(note);
    return res.success;
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

  // =========================================================================
  // 6. REAL RATINGS & REVIEWS (Priority 3)
  // =========================================================================

  /**
   * Fetch real ratings from public.paper_ratings table and compute genuine average.
   * Never masks database errors as empty reviews.
   */
  async fetchPaperRatings(paperId: string): Promise<{
    rating?: number;
    ratingCount: number;
    userRating?: number;
    userReviewText?: string;
    reviews: Array<{ id: string; stars: number; text?: string; authorName: string; createdAt: string; userId: string }>;
    error: Error | null;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('paper_ratings')
        .select('*')
        .eq('paper_id', paperId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('fetchPaperRatings DB error:', error.message);
        return {
          rating: undefined,
          ratingCount: 0,
          reviews: [],
          error: new Error(error.message),
        };
      }

      if (!data || data.length === 0) {
        return { rating: undefined, ratingCount: 0, reviews: [], error: null };
      }

      const totalStars = data.reduce((acc, row) => acc + Number(row.rating), 0);
      const avg = Number((totalStars / data.length).toFixed(1));

      let userRating: number | undefined;
      let userReviewText: string | undefined;

      if (user) {
        const myRating = data.find((r) => r.user_id === user.id);
        if (myRating) {
          userRating = Number(myRating.rating);
          userReviewText = myRating.review_text || undefined;
        }
      }

      const reviews = data.map((r) => ({
        id: r.id,
        stars: Number(r.rating),
        text: r.review_text || undefined,
        authorName: r.user_display_name || 'Student',
        createdAt: r.created_at,
        userId: r.user_id,
      }));

      return {
        rating: avg,
        ratingCount: data.length,
        userRating,
        userReviewText,
        reviews,
        error: null,
      };
    } catch (err: any) {
      console.warn('fetchPaperRatings error:', err);
      return {
        rating: undefined,
        ratingCount: 0,
        reviews: [],
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Submit or update real rating: 1 per user per paper, verified with auth.uid()
   */
  async submitPaperRating(
    paperId: string,
    rating: number,
    reviewText?: string,
    displayName?: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: new Error('You must be signed in to rate this paper.') };
      }

      const cleanRating = Math.round(Number(rating));
      if (!Number.isInteger(cleanRating) || cleanRating < 1 || cleanRating > 5) {
        return { success: false, error: new Error('Rating must be between 1 and 5 stars.') };
      }

      const author = displayName?.trim() || user.user_metadata?.full_name || user.user_metadata?.name || 'Student';

      const payload = {
        paper_id: paperId,
        user_id: user.id,
        rating: cleanRating,
        review_text: reviewText?.trim() || null,
        user_display_name: author,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('paper_ratings')
        .upsert([payload], { onConflict: 'user_id,paper_id' })
        .select('id')
        .single();

      if (error || !data) {
        const msg = error?.message || 'Could not confirm saved review in database.';
        console.warn('submitPaperRating DB error:', msg);
        return { success: false, error: new Error(msg) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.warn('submitPaperRating exception:', err);
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  // =========================================================================
  // 7. REPORT & MODERATION SYSTEM (Priority 6 & Priority 2)
  // =========================================================================

  /**
   * Submit a community report against a paper
   */
  async submitReport(data: {
    paperId: string;
    reasonCategory: string;
    reasonDetails: string;
    evidenceUrl?: string;
    reporterName: string;
    reporterEmail?: string;
  }): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Duplicate report check: prevent spamming same paper with pending report
      if (user) {
        const { data: existing } = await supabase
          .from('paper_reports')
          .select('id')
          .eq('paper_id', data.paperId)
          .eq('reporter_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (existing) {
          return { success: false, error: new Error('You already have a pending report under review for this paper.') };
        }
      }

      const payload = {
        paper_id: data.paperId,
        reporter_id: user?.id || null,
        reporter_name: data.reporterName.trim() || 'Student',
        reporter_email: data.reporterEmail?.trim() || null,
        reason_category: data.reasonCategory,
        reason_details: data.reasonDetails.trim(),
        evidence_url: data.evidenceUrl?.trim() || null,
        status: 'pending',
      };

      const { error } = await supabase
        .from('paper_reports')
        .insert([payload]);

      if (error) {
        console.warn('submitReport error:', error.message);
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.warn('submitReport exception:', err);
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Fetch all moderation reports (Protected for Admins/Moderators)
   */
  async fetchReportsWithStatus(): Promise<{ reports: any[]; synced: boolean; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('paper_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('fetchReports error:', error.message);
        return { reports: [], synced: false, error: new Error(error.message) };
      }

      return { reports: data || [], synced: true, error: null };
    } catch (err: any) {
      console.warn('fetchReports exception:', err);
      return { reports: [], synced: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  async fetchReports(): Promise<any[]> {
    const res = await this.fetchReportsWithStatus();
    return res.reports;
  },

  /**
   * Update report status (Dismiss or Resolve) and write to moderation audit trail
   */
  async updateReportStatus(
    reportId: string,
    status: 'resolved' | 'dismissed' | 'takedown',
    resolutionNotes?: string,
    paperId?: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: new Error('Admin credentials required') };

      const { error } = await supabase
        .from('paper_reports')
        .update({
          status,
          resolution_notes: resolutionNotes?.trim() || null,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      // Record in audit log
      try {
        await supabase.from('moderation_logs').insert([{
          moderator_id: user.id,
          action: `report_${status}`,
          target_type: 'report',
          target_id: reportId,
          reason: resolutionNotes || `Report marked as ${status}`,
          metadata: { paperId, reportId, status }
        }]);
      } catch (logErr) {
        console.warn('Could not record moderation log:', logErr);
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Takedown / Unpublish a document reversibly via atomic `admin_remove_paper` RPC.
   */
  async takedownPaper(paperId: string, reason: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: new Error('Admin credentials required') };

      const cleanReason = reason?.trim() || 'Removed following moderation review.';

      const { data, error } = await supabase.rpc('admin_remove_paper', {
        p_paper_id: paperId,
        p_reason: cleanReason,
      });

      if (error) {
        return { success: false, error: new Error(error.message) };
      }
      if (data && typeof data === 'object' && (data as any).success === false) {
        return { success: false, error: new Error((data as any).error || 'Submission not found or permission denied during takedown.') };
      }

      // Secondary optional cleanup of legacy papers table (non-fatal if absent)
      try {
        await supabase
          .from('papers')
          .update({ status: 'rejected', rejection_reason: `Taken down: ${cleanReason}` })
          .eq('id', paperId);
      } catch {
        // legacy table optional
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Suspend a user account with recorded reason and duration
   */
  async suspendUser(
    userId: string,
    userEmail?: string,
    reason: string = '',
    durationDays: number = 7
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: new Error('Admin credentials required') };

      const until = new Date(Date.now() + durationDays * 86400000).toISOString();

      await supabase
        .from('user_moderation_status')
        .upsert([{
          user_id: userId,
          is_suspended: true,
          suspension_reason: reason,
          suspended_until: until,
          suspended_by: user.id,
          updated_at: new Date().toISOString(),
        }]);

      // Record in audit log (store moderatorEmail inside metadata JSONB matching live schema)
      try {
        await supabase.from('moderation_logs').insert([{
          moderator_id: user.id,
          action: 'suspend_user',
          target_type: 'user',
          target_id: userId,
          reason,
          metadata: {
            userId,
            userEmail,
            moderatorEmail: user.email,
            durationDays,
            suspendedUntil: until,
          }
        }]);
      } catch (logErr) {
        console.warn('Could not record moderation log:', logErr);
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Fetch moderation audit trail
   */
  async fetchModerationLogs(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('moderation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('fetchModerationLogs error:', error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      return [];
    }
  },

  /**
   * Check if the current user is a trusted admin/owner via secure app_metadata or user_roles table
   * Priority 2: Never trusts client-set user_metadata
   */
  async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // 1. Check secure server-controlled app_metadata (cannot be written by client)
      const appRole = user.app_metadata?.role;
      const isAdminAppMeta = appRole === 'owner' || appRole === 'admin' || user.app_metadata?.is_admin === true;
      if (isAdminAppMeta) return true;

      // 2. Check public.user_roles table
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleRow && (roleRow.role === 'owner' || roleRow.role === 'admin')) {
        return true;
      }

      // 3. Fallback check for designated project owner email from environment
      const metaEnv =
        typeof import.meta !== 'undefined' && (import.meta as any).env
          ? (import.meta as any).env
          : {};
      const ownerEmail = (metaEnv.VITE_OWNER_EMAIL || 'teamstudify5@gmail.com').toLowerCase().trim();
      if (user.email && user.email.toLowerCase().trim() === ownerEmail) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },
};

