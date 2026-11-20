import {
  StudyProject,
  QuickCaptureItem,
  WorkspaceSession,
  ProjectTask,
  ProjectNote,
  ProjectResource,
} from '../types/workspace';
import { supabaseDb } from './supabaseDb';

const PROJECTS_STORAGE_KEY = 'studify_workspace_projects_clean_v3';
const QUICK_CAPTURES_KEY = 'studify_quick_captures_clean_v3';
const SESSION_STORAGE_KEY = 'studify_workspace_session_clean_v3';

const INITIAL_PROJECTS: StudyProject[] = [];
const INITIAL_CAPTURES: QuickCaptureItem[] = [];

export const workspaceService = {
  // -------------------------------------------------------------
  // STUDY PROJECTS
  // -------------------------------------------------------------
  async fetchFromSupabase(): Promise<{ projects: StudyProject[]; captures: QuickCaptureItem[]; synced: boolean }> {
    try {
      const [projRes, capRes] = await Promise.all([
        supabaseDb.loadProjectsWithStatus(),
        supabaseDb.loadQuickCapturesWithStatus(),
      ]);

      if (projRes.synced) {
        this.saveProjects(projRes.projects);
      }
      if (capRes.synced) {
        this.saveQuickCaptures(capRes.captures);
      }

      return {
        projects: projRes.synced ? projRes.projects : [],
        captures: capRes.synced ? capRes.captures : [],
        synced: projRes.synced && capRes.synced,
      };
    } catch (err) {
      console.warn('Could not sync workspace with Supabase:', err);
      return {
        projects: [],
        captures: [],
        synced: false,
      };
    }
  },

  getProjects(): StudyProject[] {
    if (typeof localStorage === 'undefined') return INITIAL_PROJECTS;
    try {
      const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!stored) {
        return INITIAL_PROJECTS;
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  },

  saveProjects(projects: StudyProject[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save projects to storage', e);
    }
  },

  getProjectById(id: string): StudyProject | undefined {
    const projects = this.getProjects();
    return projects.find((p) => p.id === id);
  },

  createProject(data: Omit<StudyProject, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'notes' | 'resources' | 'paperIds' | 'status'> & {
    paperIds?: string[];
    status?: StudyProject['status'];
  }): StudyProject {
    const projects = this.getProjects();
    const newProject: StudyProject = {
      ...data,
      id: `proj-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paperIds: data.paperIds || [],
      tasks: [],
      notes: [],
      resources: [],
      status: 'active'
    };
    projects.unshift(newProject);
    this.saveProjects(projects);

    // Real Supabase insert query
    supabaseDb.createProject(newProject).catch((e) => console.warn('Supabase createProject failed', e));

    return newProject;
  },

  async createProjectAsync(data: Omit<StudyProject, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'notes' | 'resources' | 'paperIds' | 'status'> & {
    paperIds?: string[];
    status?: StudyProject['status'];
  }): Promise<{ project: StudyProject | null; error: Error | null }> {
    const newProject: StudyProject = {
      ...data,
      id: `proj-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paperIds: data.paperIds || [],
      tasks: [],
      notes: [],
      resources: [],
      status: 'active'
    };

    // Await real Supabase operation
    const result = await supabaseDb.createProject(newProject);
    if (!result) {
      return { project: null, error: new Error('Failed to save project in database') };
    }

    const projects = this.getProjects();
    projects.unshift(newProject);
    this.saveProjects(projects);

    return { project: newProject, error: null };
  },

  updateProject(id: string, updates: Partial<StudyProject>): StudyProject | null {
    const projects = this.getProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updated = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    projects[index] = updated;
    this.saveProjects(projects);

    // Real Supabase update query
    supabaseDb.updateProject(id, updates).catch((e) => console.warn('Supabase updateProject failed', e));

    return updated;
  },

  deleteProject(id: string): boolean {
    const projects = this.getProjects();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length === projects.length) return false;
    this.saveProjects(filtered);

    // Real Supabase delete query
    supabaseDb.deleteProject(id).catch((e) => console.warn('Supabase deleteProject failed', e));

    return true;
  },

  // Linked Papers inside Projects
  addPaperToProject(projectId: string, paperId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    if (project.paperIds.includes(paperId)) return true;
    project.paperIds.push(paperId);
    this.updateProject(projectId, { paperIds: project.paperIds });
    return true;
  },

  removePaperFromProject(projectId: string, paperId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.paperIds = project.paperIds.filter((id) => id !== paperId);
    this.updateProject(projectId, { paperIds: project.paperIds });
    return true;
  },

  /**
   * Prunes orphaned paperIds from study projects when the library has
   * authoritatively synced from Supabase, preserving all projects, tasks,
   * notes, resources, and quick captures.
   */
  async pruneInvalidPaperReferences(validPaperIds: Set<string>): Promise<void> {
    const projects = this.getProjects();
    if (projects.length === 0) return;

    let anyChanged = false;
    const updatedProjects = projects.map((proj) => {
      const currentIds = Array.isArray(proj.paperIds) ? proj.paperIds : [];
      const cleanedIds = currentIds.filter((id) => validPaperIds.has(id));
      if (cleanedIds.length === currentIds.length) {
        return proj;
      }
      anyChanged = true;
      const updated = {
        ...proj,
        paperIds: cleanedIds,
        updatedAt: new Date().toISOString(),
      };
      supabaseDb.updateProject(proj.id, { paperIds: cleanedIds }).catch((e) => {
        console.warn('Supabase pruneInvalidPaperReferences notice:', e);
      });
      return updated;
    });

    if (anyChanged) {
      this.saveProjects(updatedProjects);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('studify:workspace-updated'));
        } catch {
          // ignore
        }
      }
    }
  },

  /**
   * Immediately removes a deleted paper ID from all study projects locally and in Supabase.
   */
  removePaperReferenceEverywhere(paperId: string): void {
    const projects = this.getProjects();
    if (projects.length === 0) return;

    let anyChanged = false;
    const updatedProjects = projects.map((proj) => {
      const currentIds = Array.isArray(proj.paperIds) ? proj.paperIds : [];
      if (!currentIds.includes(paperId)) {
        return proj;
      }
      anyChanged = true;
      const cleanedIds = currentIds.filter((id) => id !== paperId);
      supabaseDb.updateProject(proj.id, { paperIds: cleanedIds }).catch((e) => {
        console.warn('Supabase removePaperReferenceEverywhere notice:', e);
      });
      return {
        ...proj,
        paperIds: cleanedIds,
        updatedAt: new Date().toISOString(),
      };
    });

    if (anyChanged) {
      this.saveProjects(updatedProjects);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('studify:workspace-updated'));
        } catch {
          // ignore
        }
      }
    }
  },

  clearLocalWorkspaceCache(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(PROJECTS_STORAGE_KEY);
      localStorage.removeItem(QUICK_CAPTURES_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  },

  // Project Tasks
  addTask(projectId: string, title: string, priority: 'high' | 'medium' | 'low' = 'medium', dueDate?: string): ProjectTask | null {
    const project = this.getProjectById(projectId);
    if (!project) return null;

    const newTask: ProjectTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      completed: false,
      priority,
      dueDate
    };
    project.tasks.push(newTask);
    this.updateProject(projectId, { tasks: project.tasks });
    return newTask;
  },

  toggleTask(projectId: string, taskId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.completed = !task.completed;
    this.updateProject(projectId, { tasks: project.tasks });
    return true;
  },

  deleteTask(projectId: string, taskId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.tasks = project.tasks.filter((t) => t.id !== taskId);
    this.updateProject(projectId, { tasks: project.tasks });
    return true;
  },

  // Project Notes
  saveNote(projectId: string, noteData: { id?: string; title: string; content: string; tags: string[]; isPinned?: boolean }): ProjectNote | null {
    const project = this.getProjectById(projectId);
    if (!project) return null;

    if (noteData.id) {
      // Update existing
      const index = project.notes.findIndex((n) => n.id === noteData.id);
      if (index !== -1) {
        // Bug 15 fix: Preserve original createdAt timestamp
        const existingCreatedAt = project.notes[index].createdAt || project.notes[index].updatedAt;
        project.notes[index] = {
          ...project.notes[index],
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags,
          createdAt: existingCreatedAt,
          isPinned: noteData.isPinned ?? project.notes[index].isPinned,
          updatedAt: new Date().toISOString()
        };
        this.updateProject(projectId, { notes: project.notes });

        // Real Supabase query for "notes" table with preserved createdAt
        supabaseDb.createNote({
          id: noteData.id,
          projectId,
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags,
          isPinned: noteData.isPinned,
          createdAt: existingCreatedAt
        }).catch((e) => console.warn('Supabase update note failed', e));

        window.dispatchEvent(new CustomEvent('studify:notes-updated'));
        return project.notes[index];
      }
    }

    // Create new
    const nowIso = new Date().toISOString();
    const newNote: ProjectNote = {
      id: `note-${Date.now()}`,
      title: noteData.title || 'Untitled Note',
      content: noteData.content,
      tags: noteData.tags || [],
      createdAt: nowIso,
      updatedAt: nowIso,
      isPinned: noteData.isPinned || false
    };
    project.notes.unshift(newNote);
    this.updateProject(projectId, { notes: project.notes });

    // Real Supabase query for "notes" table
    supabaseDb.createNote({
      id: newNote.id,
      projectId,
      title: newNote.title,
      content: newNote.content,
      tags: newNote.tags,
      isPinned: newNote.isPinned,
      createdAt: nowIso
    }).catch((e) => console.warn('Supabase create note failed', e));

    window.dispatchEvent(new CustomEvent('studify:notes-updated'));
    return newNote;
  },

  async saveNoteAsync(projectId: string, noteData: { id?: string; title: string; content: string; tags: string[]; isPinned?: boolean }): Promise<{ note: ProjectNote | null; error: Error | null }> {
    const project = this.getProjectById(projectId);
    if (!project) return { note: null, error: new Error('Project not found') };

    const isEdit = Boolean(noteData.id);
    let noteToSave: ProjectNote;
    let existingCreatedAt: string | undefined;

    if (isEdit) {
      const index = project.notes.findIndex((n) => n.id === noteData.id);
      if (index === -1) return { note: null, error: new Error('Note not found in project') };
      existingCreatedAt = project.notes[index].createdAt || project.notes[index].updatedAt;
      noteToSave = {
        ...project.notes[index],
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags,
        createdAt: existingCreatedAt,
        isPinned: noteData.isPinned ?? project.notes[index].isPinned,
        updatedAt: new Date().toISOString()
      };
      project.notes[index] = noteToSave;
    } else {
      const now = new Date().toISOString();
      noteToSave = {
        id: `note-${Date.now()}`,
        title: noteData.title || 'Untitled Note',
        content: noteData.content,
        tags: noteData.tags || [],
        createdAt: now,
        updatedAt: now,
        isPinned: noteData.isPinned || false
      };
      project.notes.unshift(noteToSave);
    }

    // Await real Supabase operation
    const success = await supabaseDb.createNote({
      id: noteToSave.id,
      projectId,
      title: noteToSave.title,
      content: noteToSave.content,
      tags: noteToSave.tags,
      isPinned: noteToSave.isPinned,
      createdAt: noteToSave.createdAt
    });

    if (!success) {
      // Rollback on failure
      return { note: null, error: new Error('Failed to save note to database') };
    }

    this.updateProject(projectId, { notes: project.notes });
    window.dispatchEvent(new CustomEvent('studify:notes-updated'));
    return { note: noteToSave, error: null };
  },

  deleteNote(projectId: string, noteId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.notes = project.notes.filter((n) => n.id !== noteId);
    this.updateProject(projectId, { notes: project.notes });

    // Real Supabase delete query for "notes" table
    supabaseDb.deleteNote(noteId).catch((e) => console.warn('Supabase delete note failed', e));

    window.dispatchEvent(new CustomEvent('studify:notes-updated'));
    return true;
  },

  // Project Resources
  addResource(projectId: string, resData: Omit<ProjectResource, 'id'>): ProjectResource | null {
    const project = this.getProjectById(projectId);
    if (!project) return null;

    const newRes: ProjectResource = {
      ...resData,
      id: `res-${Date.now()}`
    };
    project.resources.push(newRes);
    this.updateProject(projectId, { resources: project.resources });
    return newRes;
  },

  deleteResource(projectId: string, resId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.resources = project.resources.filter((r) => r.id !== resId);
    this.updateProject(projectId, { resources: project.resources });
    return true;
  },

  // -------------------------------------------------------------
  // QUICK-CAPTURE SYSTEM
  // -------------------------------------------------------------
  getQuickCaptures(): QuickCaptureItem[] {
    if (typeof localStorage === 'undefined') return INITIAL_CAPTURES;
    try {
      const stored = localStorage.getItem(QUICK_CAPTURES_KEY);
      if (!stored) {
        return INITIAL_CAPTURES;
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : INITIAL_CAPTURES;
    } catch {
      return INITIAL_CAPTURES;
    }
  },

  saveQuickCaptures(items: QuickCaptureItem[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(QUICK_CAPTURES_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save quick captures', e);
    }
  },

  addQuickCapture(data: {
    title?: string;
    content: string;
    type: 'thought' | 'formula' | 'doubt' | 'resource';
    projectId?: string;
    tags?: string[];
  }): QuickCaptureItem {
    const items = this.getQuickCaptures();
    const newItem: QuickCaptureItem = {
      id: `qc-${Date.now()}`,
      title: data.title?.trim() || undefined,
      content: data.content.trim(),
      type: data.type,
      projectId: data.projectId,
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      isResolved: false
    };
    items.unshift(newItem);
    this.saveQuickCaptures(items);

    // Real Supabase insert query
    supabaseDb.createQuickCapture(newItem).catch((e) => console.warn('Supabase createQuickCapture failed', e));

    return newItem;
  },

  async addQuickCaptureAsync(data: {
    title?: string;
    content: string;
    type: 'thought' | 'formula' | 'doubt' | 'resource';
    projectId?: string;
    tags?: string[];
  }): Promise<{ item: QuickCaptureItem | null; error: Error | null }> {
    const newItem: QuickCaptureItem = {
      id: `qc-${Date.now()}`,
      title: data.title?.trim() || undefined,
      content: data.content.trim(),
      type: data.type,
      projectId: data.projectId,
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      isResolved: false
    };

    // Await real Supabase operation
    const result = await supabaseDb.createQuickCapture(newItem);
    if (!result) {
      return { item: null, error: new Error('Failed to save quick capture to database') };
    }

    const items = this.getQuickCaptures();
    items.unshift(newItem);
    this.saveQuickCaptures(items);

    return { item: newItem, error: null };
  },

  deleteQuickCapture(id: string): boolean {
    const items = this.getQuickCaptures();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    this.saveQuickCaptures(filtered);

    // Real Supabase delete query
    supabaseDb.deleteQuickCapture(id).catch((e) => console.warn('Supabase deleteQuickCapture failed', e));

    return true;
  },

  toggleResolveQuickCapture(id: string): boolean {
    const items = this.getQuickCaptures();
    const item = items.find((i) => i.id === id);
    if (!item) return false;
    item.isResolved = !item.isResolved;
    this.saveQuickCaptures(items);

    // Real Supabase update query
    supabaseDb.updateQuickCapture(id, { isResolved: item.isResolved }).catch((e) => console.warn('Supabase updateQuickCapture failed', e));

    return true;
  },

  // -------------------------------------------------------------
  // SESSION RESTORATION
  // -------------------------------------------------------------
  getSession(): WorkspaceSession | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  getLastSession(): WorkspaceSession | null {
    return this.getSession();
  },

  recordSessionState(state: Partial<WorkspaceSession>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const current = this.getSession() || {
        lastActiveTab: 'home',
        timestamp: new Date().toISOString()
      };
      const updated: WorkspaceSession = {
        ...current,
        ...state,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to record session', e);
    }
  },
};
