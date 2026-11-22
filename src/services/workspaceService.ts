import {
  StudyProject,
  QuickCaptureItem,
  WorkspaceSession,
  ProjectTask,
  ProjectNote,
  ProjectNoteAttachment,
  ProjectNoteAttachmentPage,
  ProjectResource,
} from '../types/workspace';
import { supabaseDb } from './supabaseDb';
import { APP_BUCKET, supabaseStorage } from './supabaseStorage';
import {
  noteAttachmentStore,
  optimizeNoteImageBlob,
  validateNoteFileCandidate,
} from './noteAttachmentStore';

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
  getCurrentUserId?: () => Promise<string | null>;
  uploadNotePageFile?: (params: {
    userId: string;
    projectId: string;
    attachmentId: string;
    file: Blob;
    fileName: string;
    contentType: string;
  }) => Promise<{ path: string | null; bucket: string; error: Error | null }>;
  deleteNotePageFile?: (path: string, bucket?: string) => Promise<boolean>;
}

const defaultNoteStorageHelpers = {
  getCurrentUserId: () => supabaseDb.getCurrentUserId(),
  uploadNotePageFile: async (params: {
    userId: string;
    projectId: string;
    attachmentId: string;
    file: Blob;
    fileName: string;
    contentType: string;
  }) => {
    const res = await supabaseStorage.uploadAppFile({
      userId: params.userId,
      featureName: 'project-notes',
      itemId: `${params.projectId}_${params.attachmentId}`,
      file: params.file,
      fileName: params.fileName,
      contentType: params.contentType,
    });
    return { path: res.path, bucket: APP_BUCKET, error: res.error };
  },
  deleteNotePageFile: (path: string, bucket: string = APP_BUCKET) =>
    supabaseStorage.deleteAppFile(path, bucket),
};

export function createWorkspaceService(db: WorkspaceDbAdapter = supabaseDb) {
  const getCurrentUserId = db.getCurrentUserId || defaultNoteStorageHelpers.getCurrentUserId;
  const uploadNotePageFile = db.uploadNotePageFile || defaultNoteStorageHelpers.uploadNotePageFile;
  const deleteNotePageFile = db.deleteNotePageFile || defaultNoteStorageHelpers.deleteNotePageFile;
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
    if (typeof localStorage === 'undefined') return [...fallback];
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return [...fallback];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [...fallback];
    } catch {
      return [...fallback];
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
      const currentUid = await getCurrentUserId();

      for (const proj of guestProjects) {
        const migratedLocalKeys: string[] = [];
        let projectToCreate: StudyProject = { ...proj };

        if (currentUid && Array.isArray(proj.noteAttachments) && proj.noteAttachments.length > 0) {
          const uploadedAttachments: ProjectNoteAttachment[] = [];
          for (const att of proj.noteAttachments) {
            const nextPages: ProjectNoteAttachmentPage[] = [];
            for (const page of att.pages || []) {
              if (page.localBlobKey && !page.storagePath) {
                const localBlob = await noteAttachmentStore.getLocalBlob(page.localBlobKey);
                if (localBlob) {
                  const uploadRes = await uploadNotePageFile({
                    userId: currentUid,
                    projectId: proj.id,
                    attachmentId: att.id,
                    file: localBlob,
                    fileName: page.fileName,
                    contentType: page.mimeType,
                  });
                  if (uploadRes.path && !uploadRes.error) {
                    migratedLocalKeys.push(page.localBlobKey);
                    nextPages.push({
                      id: page.id,
                      fileName: page.fileName,
                      mimeType: page.mimeType,
                      sizeBytes: page.sizeBytes,
                      storageBucket: uploadRes.bucket || APP_BUCKET,
                      storagePath: uploadRes.path,
                    });
                    continue;
                  }
                }
              }
              nextPages.push(page);
            }
            uploadedAttachments.push({ ...att, pages: nextPages });
          }
          projectToCreate = {
            ...proj,
            noteAttachments: uploadedAttachments,
          };
        }

        const res = await db.createProjectWithStatus(projectToCreate);
        if (res.project && !res.error) {
          migratedProjects += 1;
          for (const key of migratedLocalKeys) {
            await noteAttachmentStore.deleteLocalBlob(key).catch(() => undefined);
          }
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
        noteAttachments: [],
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
      const target = projects.find((p) => p.id === id);
      const filtered = projects.filter((p) => p.id !== id);
      if (filtered.length === projects.length) return false;
      this.saveProjects(filtered);

      if (target && Array.isArray(target.noteAttachments)) {
        for (const att of target.noteAttachments) {
          for (const page of att.pages || []) {
            if (page.localBlobKey) {
              void noteAttachmentStore.deleteLocalBlob(page.localBlobKey).catch(() => undefined);
            }
            if (storageScope === 'user' && page.storagePath) {
              void deleteNotePageFile(page.storagePath, page.storageBucket || APP_BUCKET).catch(() => undefined);
            }
          }
        }
      }

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

    // Project Note PDF & Photo Attachments (Cloud Storage signed in, IndexedDB signed out)
    async addProjectNoteAttachmentAsync(
      projectId: string,
      params: {
        title?: string;
        files: Array<{ blob: Blob; fileName: string; mimeType?: string }>;
      }
    ): Promise<{ attachment: ProjectNoteAttachment | null; error: Error | null }> {
      const project = this.getProjectById(projectId);
      if (!project) {
        return { attachment: null, error: new Error('Study project not found.') };
      }

      const rawFiles = Array.isArray(params.files) ? params.files : [];
      if (rawFiles.length === 0) {
        return { attachment: null, error: new Error('Please choose a PDF or capture at least one photo.') };
      }

      const validatedKinds: Array<'pdf' | 'image'> = [];
      for (const f of rawFiles) {
        const check = validateNoteFileCandidate({
          name: f.fileName,
          type: f.mimeType || f.blob.type,
          size: f.blob.size,
        });
        if (!check.valid) {
          return { attachment: null, error: new Error(check.error || 'Unsupported attachment file.') };
        }
        validatedKinds.push(check.kind);
      }

      const hasPdf = validatedKinds.includes('pdf');
      if (hasPdf && rawFiles.length > 1) {
        return {
          attachment: null,
          error: new Error('Upload one PDF file at a time, or bundle multiple note photos together.'),
        };
      }
      if (!hasPdf && rawFiles.length > 12) {
        return {
          attachment: null,
          error: new Error('Maximum 12 photos per note bundle.'),
        };
      }

      const attachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const defaultTitle = hasPdf
        ? rawFiles[0].fileName.replace(/\.pdf$/i, '').trim() || 'Study Note PDF'
        : `Handwritten Notes (${rawFiles.length} ${rawFiles.length === 1 ? 'page' : 'pages'})`;
      const cleanTitle = params.title?.trim() || defaultTitle;
      const kind: 'pdf' | 'photo-set' = hasPdf ? 'pdf' : 'photo-set';

      const preparedFiles: Array<{ blob: Blob; fileName: string; mimeType: string }> = [];
      for (let idx = 0; idx < rawFiles.length; idx += 1) {
        const item = rawFiles[idx];
        const fallbackName = hasPdf
          ? item.fileName || 'study_notes.pdf'
          : item.fileName || `note_page_${idx + 1}.jpg`;
        if (hasPdf) {
          preparedFiles.push({
            blob: item.blob,
            fileName: fallbackName,
            mimeType: 'application/pdf',
          });
        } else {
          const optimized = await optimizeNoteImageBlob(item.blob, fallbackName);
          preparedFiles.push(optimized);
        }
      }

      const existingAttachments = Array.isArray(project.noteAttachments) ? project.noteAttachments : [];

      if (storageScope === 'guest') {
        const savedKeys: string[] = [];
        try {
          const pages: ProjectNoteAttachmentPage[] = [];
          for (let idx = 0; idx < preparedFiles.length; idx += 1) {
            const pf = preparedFiles[idx];
            const pageId = `pg-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`;
            const localBlobKey = `guest_att_${projectId}_${attachmentId}_${pageId}`;
            await noteAttachmentStore.saveLocalBlob(localBlobKey, pf.blob, {
              fileName: pf.fileName,
              mimeType: pf.mimeType,
            });
            savedKeys.push(localBlobKey);
            pages.push({
              id: pageId,
              fileName: pf.fileName,
              mimeType: pf.mimeType,
              sizeBytes: pf.blob.size,
              localBlobKey,
            });
          }

          const attachment: ProjectNoteAttachment = {
            id: attachmentId,
            projectId,
            title: cleanTitle,
            kind,
            pages,
            createdAt: now,
            updatedAt: now,
          };

          const nextAttachments = [attachment, ...existingAttachments];
          this.updateProject(projectId, { noteAttachments: nextAttachments });
          dispatchNotesUpdated();
          dispatchWorkspaceUpdated();
          return { attachment, error: null };
        } catch (err: any) {
          for (const k of savedKeys) {
            await noteAttachmentStore.deleteLocalBlob(k).catch(() => undefined);
          }
          return {
            attachment: null,
            error: err instanceof Error ? err : new Error('Failed to save note file to device storage.'),
          };
        }
      }

      // Signed-in mode: upload to private 'app-files' bucket then persist project metadata in Supabase DB
      const userId = await getCurrentUserId();
      if (!userId) {
        return {
          attachment: null,
          error: new Error('Sign in session expired. Please sign in again to upload to cloud.'),
        };
      }

      const uploadedPages: ProjectNoteAttachmentPage[] = [];
      for (let idx = 0; idx < preparedFiles.length; idx += 1) {
        const pf = preparedFiles[idx];
        const pageId = `pg-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`;
        const uploadRes = await uploadNotePageFile({
          userId,
          projectId,
          attachmentId,
          file: pf.blob,
          fileName: pf.fileName,
          contentType: pf.mimeType,
        });

        if (uploadRes.error || !uploadRes.path) {
          for (const prev of uploadedPages) {
            if (prev.storagePath) {
              await deleteNotePageFile(prev.storagePath, prev.storageBucket || APP_BUCKET).catch(() => undefined);
            }
          }
          return {
            attachment: null,
            error: uploadRes.error || new Error('Failed to upload note file to private cloud storage.'),
          };
        }

        uploadedPages.push({
          id: pageId,
          fileName: pf.fileName,
          mimeType: pf.mimeType,
          sizeBytes: pf.blob.size,
          storageBucket: uploadRes.bucket || APP_BUCKET,
          storagePath: uploadRes.path,
        });
      }

      const attachment: ProjectNoteAttachment = {
        id: attachmentId,
        projectId,
        title: cleanTitle,
        kind,
        pages: uploadedPages,
        createdAt: now,
        updatedAt: now,
      };
      const nextAttachments = [attachment, ...existingAttachments];

      const projRes = await db.updateProjectWithStatus(projectId, { noteAttachments: nextAttachments });
      if (!projRes.success) {
        for (const p of uploadedPages) {
          if (p.storagePath) {
            await deleteNotePageFile(p.storagePath, p.storageBucket || APP_BUCKET).catch(() => undefined);
          }
        }
        return {
          attachment: null,
          error: projRes.error || new Error('Could not link uploaded note files to your cloud project.'),
        };
      }

      const projects = this.getProjects().map((p) =>
        p.id === projectId ? { ...p, noteAttachments: nextAttachments, updatedAt: now } : p
      );
      this.saveProjects(projects);
      dispatchNotesUpdated();
      dispatchWorkspaceUpdated();
      return { attachment, error: null };
    },

    async deleteProjectNoteAttachmentAsync(
      projectId: string,
      attachmentId: string
    ): Promise<{ success: boolean; error: Error | null }> {
      const project = this.getProjectById(projectId);
      if (!project) {
        return { success: false, error: new Error('Project not found.') };
      }

      const existing = Array.isArray(project.noteAttachments) ? project.noteAttachments : [];
      const target = existing.find((a) => a.id === attachmentId);
      if (!target) {
        return { success: false, error: new Error('Attachment not found.') };
      }

      const nextAttachments = existing.filter((a) => a.id !== attachmentId);

      if (storageScope === 'user') {
        for (const page of target.pages || []) {
          if (page.storagePath) {
            const removed = await deleteNotePageFile(page.storagePath, page.storageBucket || APP_BUCKET);
            if (!removed) {
              return {
                success: false,
                error: new Error('Could not delete file from cloud storage. Please try again.'),
              };
            }
          }
        }

        const updateRes = await db.updateProjectWithStatus(projectId, {
          noteAttachments: nextAttachments,
        });
        if (!updateRes.success) {
          return {
            success: false,
            error: updateRes.error || new Error('Could not update project note attachments.'),
          };
        }
      }

      for (const page of target.pages || []) {
        if (page.localBlobKey) {
          await noteAttachmentStore.deleteLocalBlob(page.localBlobKey).catch(() => undefined);
        }
      }

      const now = new Date().toISOString();
      const projects = this.getProjects().map((p) =>
        p.id === projectId ? { ...p, noteAttachments: nextAttachments, updatedAt: now } : p
      );
      this.saveProjects(projects);
      dispatchNotesUpdated();
      dispatchWorkspaceUpdated();
      return { success: true, error: null };
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
