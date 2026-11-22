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

const GUEST_PROJECTS_STORAGE_KEY = 'studify_guest_projects_v1';
const GUEST_QUICK_CAPTURES_KEY = 'studify_guest_captures_v1';
const GUEST_SESSION_STORAGE_KEY = 'studify_guest_session_v1';

const INITIAL_PROJECTS: StudyProject[] = [];
const INITIAL_CAPTURES: QuickCaptureItem[] = [];

export type WorkspaceStorageScope = 'user' | 'guest';

function dispatchWorkspaceUpdated(): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('studify:workspace-updated'));
    } catch {
      // ignore
    }
  }
}

function dispatchNotesUpdated(): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('studify:notes-updated'));
    } catch {
      // ignore
    }
  }
}

export interface WorkspaceDbAdapter {
  loadProjectsWithStatus: typeof supabaseDb.loadProjectsWithStatus;
  loadQuickCapturesWithStatus: typeof supabaseDb.loadQuickCapturesWithStatus;
  createProjectWithStatus: typeof supabaseDb.createProjectWithStatus;
  updateProjectWithStatus: typeof supabaseDb.updateProjectWithStatus;
  updateProject: typeof supabaseDb.updateProject;
  deleteProject: typeof supabaseDb.deleteProject;
  createQuickCaptureWithStatus: typeof supabaseDb.createQuickCaptureWithStatus;
  updateQuickCapture: typeof supabaseDb.updateQuickCapture;
  deleteQuickCapture: typeof supabaseDb.deleteQuickCapture;
  createNoteWithStatus: typeof supabaseDb.createNoteWithStatus;
  deleteNote: typeof supabaseDb.deleteNote;
}

export function createWorkspaceService(db: WorkspaceDbAdapter = supabaseDb) {
  let storageScope: WorkspaceStorageScope = 'user';

  const getKeys = (scope: WorkspaceStorageScope = storageScope) =>
    scope === 'guest'
      ? {
          projects: GUEST_PROJECTS_STORAGE_KEY,
          captures: GUEST_QUICK_CAPTURES_KEY,
          session: GUEST_SESSION_STORAGE_KEY,
        }
      : {
          projects: PROJECTS_STORAGE_KEY,
          captures: QUICK_CAPTURES_KEY,
          session: SESSION_STORAGE_KEY,
        };

  const readJsonArray = <T>(key: string, fallback: T[]): T[] => {
    if (typeof localStorage === 'undefined') return fallback;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return fallback;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key: string, value: unknown): void => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save workspace item to storage', e);
    }
  };

  return {
    getStorageScope(): WorkspaceStorageScope {
      return storageScope;
    },

    setStorageScope(nextScope: WorkspaceStorageScope): void {
      storageScope = nextScope;
    },

    // -------------------------------------------------------------
    // STUDY PROJECTS
    // -------------------------------------------------------------
    async fetchFromSupabase(): Promise<{ projects: StudyProject[]; captures: QuickCaptureItem[]; synced: boolean }> {
      if (storageScope === 'guest') {
        return {
          projects: this.getProjects(),
          captures: this.getQuickCaptures(),
          synced: true,
        };
      }

      try {
        const [projRes, capRes] = await Promise.all([
          db.loadProjectsWithStatus(),
          db.loadQuickCapturesWithStatus(),
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

    /**
     * Migrates local guest projects, notes, and quick captures into the signed-in user's
     * Supabase workspace, clearing successfully migrated guest items so they never leak to
     * subsequent accounts on the same browser.
     */
    async syncGuestItemsToSupabaseIfAny(): Promise<{ migratedProjects: number; migratedCaptures: number }> {
      if (typeof localStorage === 'undefined') {
        return { migratedProjects: 0, migratedCaptures: 0 };
      }

      const guestProjects = readJsonArray<StudyProject>(GUEST_PROJECTS_STORAGE_KEY, []);
      const guestCaptures = readJsonArray<QuickCaptureItem>(GUEST_QUICK_CAPTURES_KEY, []);

      if (guestProjects.length === 0 && guestCaptures.length === 0) {
        return { migratedProjects: 0, migratedCaptures: 0 };
      }

      let migratedProjects = 0;
      const remainingProjects: StudyProject[] = [];
      for (const proj of guestProjects) {
        const res = await db.createProjectWithStatus(proj);
        if (res.project && !res.error) {
          migratedProjects += 1;
          for (const note of proj.notes || []) {
            await db.createNoteWithStatus({
              id: note.id,
              projectId: proj.id,
              title: note.title,
              content: note.content,
              tags: note.tags,
              isPinned: note.isPinned,
              createdAt: note.createdAt,
            });
          }
        } else {
          remainingProjects.push(proj);
        }
      }

      if (remainingProjects.length === 0) {
        localStorage.removeItem(GUEST_PROJECTS_STORAGE_KEY);
      } else {
        writeJson(GUEST_PROJECTS_STORAGE_KEY, remainingProjects);
      }

      let migratedCaptures = 0;
      const remainingCaptures: QuickCaptureItem[] = [];
      for (const cap of guestCaptures) {
        const res = await db.createQuickCaptureWithStatus(cap);
        if (res.item && !res.error) {
          migratedCaptures += 1;
        } else {
          remainingCaptures.push(cap);
        }
      }

      if (remainingCaptures.length === 0) {
        localStorage.removeItem(GUEST_QUICK_CAPTURES_KEY);
      } else {
        writeJson(GUEST_QUICK_CAPTURES_KEY, remainingCaptures);
      }

      if (migratedProjects > 0 || migratedCaptures > 0) {
        localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
      }

      return { migratedProjects, migratedCaptures };
    },

    getProjects(): StudyProject[] {
      return readJsonArray<StudyProject>(getKeys().projects, INITIAL_PROJECTS);
    },

    saveProjects(projects: StudyProject[]): void {
      writeJson(getKeys().projects, projects);
    },

    getProjectById(id: string): StudyProject | undefined {
      const projects = this.getProjects();
      return projects.find((p) => p.id === id);
    },

    createProject(
      data: Omit<StudyProject, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'notes' | 'resources' | 'paperIds' | 'status'> & {
        paperIds?: string[];
        status?: StudyProject['status'];
      }
    ): StudyProject {
      const projects = this.getProjects();
      const newProject: StudyProject = {
        ...data,
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paperIds: data.paperIds || [],
        tasks: [],
        notes: [],
        resources: [],
        status: data.status || 'active',
      };
      projects.unshift(newProject);
      this.saveProjects(projects);

      if (storageScope === 'user') {
        db.createProjectWithStatus(newProject).catch((e) => console.warn('Supabase createProject failed', e));
      }

      dispatchWorkspaceUpdated();
      return newProject;
    },

    async createProjectAsync(
      data: Omit<StudyProject, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'notes' | 'resources' | 'paperIds' | 'status'> & {
        paperIds?: string[];
        status?: StudyProject['status'];
      }
    ): Promise<{ project: StudyProject | null; error: Error | null }> {
      const cleanTitle = data.title?.trim();
      if (!cleanTitle) {
        return { project: null, error: new Error('Project title is required.') };
      }

      const now = new Date().toISOString();
      const newProject: StudyProject = {
        ...data,
        title: cleanTitle,
        subject: data.subject?.trim() || undefined,
        description: data.description?.trim() || undefined,
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
        paperIds: data.paperIds || [],
        tasks: [],
        notes: [],
        resources: [],
        status: data.status || 'active',
      };

      if (storageScope === 'guest') {
        const projects = this.getProjects();
        projects.unshift(newProject);
        this.saveProjects(projects);
        dispatchWorkspaceUpdated();
        return { project: newProject, error: null };
      }

      // Signed-in mode: await real Supabase persistence before updating local cache
      const result = await db.createProjectWithStatus(newProject);
      if (result.error || !result.project) {
        return {
          project: null,
          error: result.error || new Error('Failed to save project in database.'),
        };
      }

      const projects = this.getProjects();
      projects.unshift(result.project);
      this.saveProjects(projects);
      dispatchWorkspaceUpdated();

      return { project: result.project, error: null };
    },

    updateProject(id: string, updates: Partial<StudyProject>): StudyProject | null {
      const projects = this.getProjects();
      const index = projects.findIndex((p) => p.id === id);
      if (index === -1) return null;

      const updated = {
        ...projects[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      projects[index] = updated;
      this.saveProjects(projects);

      if (storageScope === 'user') {
        db.updateProject(id, updates).catch((e) => console.warn('Supabase updateProject failed', e));
      }

      return updated;
    },

    deleteProject(id: string): boolean {
      const projects = this.getProjects();
      const filtered = projects.filter((p) => p.id !== id);
      if (filtered.length === projects.length) return false;
      this.saveProjects(filtered);

      if (storageScope === 'user') {
        db.deleteProject(id).catch((e) => console.warn('Supabase deleteProject failed', e));
      }

      dispatchWorkspaceUpdated();
      return true;
    },

    // Linked Papers inside Projects
    addPaperToProject(projectId: string, paperId: string): boolean {
      const project = this.getProjectById(projectId);
      if (!project) return false;
      if (project.paperIds.includes(paperId)) return true;
      const nextPaperIds = [...project.paperIds, paperId];
      this.updateProject(projectId, { paperIds: nextPaperIds });
      return true;
    },

    removePaperFromProject(projectId: string, paperId: string): boolean {
      const project = this.getProjectById(projectId);
      if (!project) return false;
      const nextPaperIds = project.paperIds.filter((id) => id !== paperId);
      this.updateProject(projectId, { paperIds: nextPaperIds });
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
        if (storageScope === 'user') {
          db.updateProject(proj.id, { paperIds: cleanedIds }).catch((e) => {
            console.warn('Supabase pruneInvalidPaperReferences notice:', e);
          });
        }
        return updated;
      });

      if (anyChanged) {
        this.saveProjects(updatedProjects);
        dispatchWorkspaceUpdated();
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
        if (storageScope === 'user') {
          db.updateProject(proj.id, { paperIds: cleanedIds }).catch((e) => {
            console.warn('Supabase removePaperReferenceEverywhere notice:', e);
          });
        }
        return {
          ...proj,
          paperIds: cleanedIds,
          updatedAt: new Date().toISOString(),
        };
      });

      if (anyChanged) {
        this.saveProjects(updatedProjects);
        dispatchWorkspaceUpdated();
      }
    },

    /**
     * Purges ONLY the authenticated user workspace cache so User A data can never
     * leak into User B or signed-out state, while leaving isolated guest keys intact.
     */
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

    clearGuestWorkspaceCache(): void {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(GUEST_PROJECTS_STORAGE_KEY);
        localStorage.removeItem(GUEST_QUICK_CAPTURES_KEY);
        localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
      } catch {
        // ignore
      }
    },

    // Project Tasks
    addTask(
      projectId: string,
      title: string,
      priority: 'high' | 'medium' | 'low' = 'medium',
      dueDate?: string
    ): ProjectTask | null {
      const project = this.getProjectById(projectId);
      if (!project) return null;

      const newTask: ProjectTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: title.trim(),
        completed: false,
        priority,
        dueDate,
      };
      const nextTasks = [...project.tasks, newTask];
      this.updateProject(projectId, { tasks: nextTasks });
      return newTask;
    },

    toggleTask(projectId: string, taskId: string): boolean {
      const project = this.getProjectById(projectId);
      if (!project) return false;
      const found = project.tasks.some((t) => t.id === taskId);
      if (!found) return false;
      const nextTasks = project.tasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      this.updateProject(projectId, { tasks: nextTasks });
      return true;
    },

    deleteTask(projectId: string, taskId: string): boolean {
      const project = this.getProjectById(projectId);
      if (!project) return false;
      const nextTasks = project.tasks.filter((t) => t.id !== taskId);
      this.updateProject(projectId, { tasks: nextTasks });
      return true;
    },

    // Project Notes
    saveNote(
      projectId: string,
      noteData: { id?: string; title: string; content: string; tags: string[]; isPinned?: boolean }
    ): ProjectNote | null {
      const project = this.getProjectById(projectId);
      if (!project) return null;

      if (noteData.id) {
        const index = project.notes.findIndex((n) => n.id === noteData.id);
        if (index !== -1) {
          const existingCreatedAt = project.notes[index].createdAt || project.notes[index].updatedAt;
          const updatedNote: ProjectNote = {
            ...project.notes[index],
            title: noteData.title,
            content: noteData.content,
            tags: noteData.tags,
            createdAt: existingCreatedAt,
            isPinned: noteData.isPinned ?? project.notes[index].isPinned,
            updatedAt: new Date().toISOString(),
          };
          const nextNotes = project.notes.map((n, idx) => (idx === index ? updatedNote : n));
          this.updateProject(projectId, { notes: nextNotes });

          if (storageScope === 'user') {
            db.createNoteWithStatus({
              id: noteData.id,
              projectId,
              title: noteData.title,
              content: noteData.content,
              tags: noteData.tags,
              isPinned: noteData.isPinned,
              createdAt: existingCreatedAt,
            }).catch((e) => console.warn('Supabase update note failed', e));
          }

          dispatchNotesUpdated();
          dispatchWorkspaceUpdated();
          return updatedNote;
        }
      }

      const nowIso = new Date().toISOString();
      const newNote: ProjectNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: noteData.title || 'Untitled Note',
        content: noteData.content,
        tags: noteData.tags || [],
        createdAt: nowIso,
        updatedAt: nowIso,
        isPinned: noteData.isPinned || false,
      };
      const nextNotes = [newNote, ...project.notes];
      this.updateProject(projectId, { notes: nextNotes });

      if (storageScope === 'user') {
        db.createNoteWithStatus({
          id: newNote.id,
          projectId,
          title: newNote.title,
          content: newNote.content,
          tags: newNote.tags,
          isPinned: newNote.isPinned,
          createdAt: nowIso,
        }).catch((e) => console.warn('Supabase create note failed', e));
      }

      dispatchNotesUpdated();
      dispatchWorkspaceUpdated();
      return newNote;
    },

    async saveNoteAsync(
      projectId: string,
      noteData: { id?: string; title: string; content: string; tags: string[]; isPinned?: boolean }
    ): Promise<{ note: ProjectNote | null; error: Error | null }> {
      const project = this.getProjectById(projectId);
      if (!project) return { note: null, error: new Error('Project not found') };

      const isEdit = Boolean(noteData.id);
      let noteToSave: ProjectNote;
      let nextNotes: ProjectNote[];

      if (isEdit) {
        const index = project.notes.findIndex((n) => n.id === noteData.id);
        if (index === -1) return { note: null, error: new Error('Note not found in project') };
        const existingCreatedAt = project.notes[index].createdAt || project.notes[index].updatedAt;
        noteToSave = {
          ...project.notes[index],
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags,
          createdAt: existingCreatedAt,
          isPinned: noteData.isPinned ?? project.notes[index].isPinned,
          updatedAt: new Date().toISOString(),
        };
        nextNotes = project.notes.map((n, idx) => (idx === index ? noteToSave : n));
      } else {
        const now = new Date().toISOString();
        noteToSave = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title: noteData.title || 'Untitled Note',
          content: noteData.content,
          tags: noteData.tags || [],
          createdAt: now,
          updatedAt: now,
          isPinned: noteData.isPinned || false,
        };
        nextNotes = [noteToSave, ...project.notes];
      }

      if (storageScope === 'guest') {
        this.updateProject(projectId, { notes: nextNotes });
        dispatchNotesUpdated();
        dispatchWorkspaceUpdated();
        return { note: noteToSave, error: null };
      }

      const noteRes = await db.createNoteWithStatus({
        id: noteToSave.id,
        projectId,
        title: noteToSave.title,
        content: noteToSave.content,
        tags: noteToSave.tags,
        isPinned: noteToSave.isPinned,
        createdAt: noteToSave.createdAt,
      });

      if (!noteRes.success) {
        return {
          note: null,
          error: noteRes.error || new Error('Failed to save note to database.'),
        };
      }

      const projUpdateRes = await db.updateProjectWithStatus(projectId, { notes: nextNotes });
      if (!projUpdateRes.success) {
        return {
          note: null,
          error: projUpdateRes.error || new Error('Failed to sync project notes.'),
        };
      }

      const projects = this.getProjects().map((p) =>
        p.id === projectId ? { ...p, notes: nextNotes, updatedAt: new Date().toISOString() } : p
      );
      this.saveProjects(projects);
      dispatchNotesUpdated();
      dispatchWorkspaceUpdated();
      return { note: noteToSave, error: null };
    },

    deleteNote(projectId: string, noteId: string): boolean {
      const project = this.getProjectById(projectId);
      if (!project) return false;
      const nextNotes = project.notes.filter((n) => n.id !== noteId);
      this.updateProject(projectId, { notes: nextNotes });

      if (storageScope === 'user') {
        db.deleteNote(noteId).catch((e) => console.warn('Supabase delete note failed', e));
      }

      dispatchNotesUpdated();
      dispatchWorkspaceUpdated();
      return true;
    },

    // Project Resources
    addResource(projectId: string, resData: Omit<ProjectResource, 'id'>): ProjectResource | null {
      const project = this.getProjectById(projectId);
      if (!project) return null;

      const newRes: ProjectResource = {
        ...resData,
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      };
      const nextResources = [...project.resources, newRes];
      this.updateProject(projectId, { resources: nextResources });
      return newRes;
    },

    deleteResource(projectId: string, resId: string): boolean {
      const project = this.getProjectById(projectId);
      if (!project) return false;
      const nextResources = project.resources.filter((r) => r.id !== resId);
      this.updateProject(projectId, { resources: nextResources });
      return true;
    },

    // -------------------------------------------------------------
    // QUICK-CAPTURE SYSTEM
    // -------------------------------------------------------------
    getQuickCaptures(): QuickCaptureItem[] {
      return readJsonArray<QuickCaptureItem>(getKeys().captures, INITIAL_CAPTURES);
    },

    saveQuickCaptures(items: QuickCaptureItem[]): void {
      writeJson(getKeys().captures, items);
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
        id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: data.title?.trim() || undefined,
        content: data.content.trim(),
        type: data.type,
        projectId: data.projectId,
        tags: data.tags || [],
        createdAt: new Date().toISOString(),
        isResolved: false,
      };
      items.unshift(newItem);
      this.saveQuickCaptures(items);

      if (storageScope === 'user') {
        db.createQuickCaptureWithStatus(newItem).catch((e) => console.warn('Supabase createQuickCapture failed', e));
      }

      dispatchWorkspaceUpdated();
      return newItem;
    },

    async addQuickCaptureAsync(data: {
      title?: string;
      content: string;
      type: 'thought' | 'formula' | 'doubt' | 'resource';
      projectId?: string;
      tags?: string[];
    }): Promise<{ item: QuickCaptureItem | null; error: Error | null }> {
      const cleanContent = data.content?.trim();
      if (!cleanContent) {
        return { item: null, error: new Error('Capture content is required.') };
      }

      const projects = this.getProjects();
      if (projects.length === 0) {
        return {
          item: null,
          error: new Error('Create a Study Project first before adding a Quick Capture.'),
        };
      }

      const resolvedProjectId = data.projectId || projects[0].id;
      const newItem: QuickCaptureItem = {
        id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: data.title?.trim() || undefined,
        content: cleanContent,
        type: data.type,
        projectId: resolvedProjectId,
        tags: data.tags || [],
        createdAt: new Date().toISOString(),
        isResolved: false,
      };

      if (storageScope === 'guest') {
        const items = this.getQuickCaptures();
        items.unshift(newItem);
        this.saveQuickCaptures(items);
        dispatchWorkspaceUpdated();
        return { item: newItem, error: null };
      }

      const result = await db.createQuickCaptureWithStatus(newItem);
      if (result.error || !result.item) {
        return {
          item: null,
          error: result.error || new Error('Failed to save quick capture to database.'),
        };
      }

      const items = this.getQuickCaptures();
      items.unshift(result.item);
      this.saveQuickCaptures(items);
      dispatchWorkspaceUpdated();

      return { item: result.item, error: null };
    },

    deleteQuickCapture(id: string): boolean {
      const items = this.getQuickCaptures();
      const filtered = items.filter((i) => i.id !== id);
      if (filtered.length === items.length) return false;
      this.saveQuickCaptures(filtered);

      if (storageScope === 'user') {
        db.deleteQuickCapture(id).catch((e) => console.warn('Supabase deleteQuickCapture failed', e));
      }

      dispatchWorkspaceUpdated();
      return true;
    },

    toggleResolveQuickCapture(id: string): boolean {
      const items = this.getQuickCaptures();
      const item = items.find((i) => i.id === id);
      if (!item) return false;
      const nextResolved = !item.isResolved;
      const nextItems = items.map((i) => (i.id === id ? { ...i, isResolved: nextResolved } : i));
      this.saveQuickCaptures(nextItems);

      if (storageScope === 'user') {
        db.updateQuickCapture(id, { isResolved: nextResolved }).catch((e) =>
          console.warn('Supabase updateQuickCapture failed', e)
        );
      }

      dispatchWorkspaceUpdated();
      return true;
    },

    // -------------------------------------------------------------
    // SESSION RESTORATION
    // -------------------------------------------------------------
    getSession(): WorkspaceSession | null {
      if (typeof localStorage === 'undefined') return null;
      try {
        const stored = localStorage.getItem(getKeys().session);
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
          timestamp: new Date().toISOString(),
        };
        const updated: WorkspaceSession = {
          ...current,
          ...state,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(getKeys().session, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to record session', e);
      }
    },
  };
}

export const workspaceService = createWorkspaceService();
