import React, { useState, useEffect } from 'react';
import {
  Folder,
  Plus,
  CheckCircle2,
  Zap,
  Trash2,
  FileText,
  RotateCcw,
  Bookmark,
  X,
  LogIn,
  Cloud,
} from 'lucide-react';
import { Paper } from '../types';
import { StudyProject, QuickCaptureItem, WorkspaceSession } from '../types/workspace';
import { workspaceService } from '../services/workspaceService';
import { useAuth } from '../context/AuthContext';
import { ProjectWorkspaceView } from '../components/workspace/ProjectWorkspaceView';
import { QuickCaptureModal } from '../components/workspace/QuickCaptureModal';
import { WorkspaceOnboardingModal } from '../components/workspace/WorkspaceOnboardingModal';
import { CreateProjectModal, PostCreateAction } from '../components/workspace/CreateProjectModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { supabase } from '../supabaseClient.js';

interface WorkspacePageProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onDownloadPaper: (paper: Paper, e?: React.MouseEvent) => void;
  onNavigateToBrowse: () => void;
  initialProjectId?: string;
  initialProjectTab?: 'tasks' | 'papers' | 'notes' | 'resources';
  autoOpenNoteComposer?: boolean;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  papers,
  onSelectPaper,
  onDownloadPaper,
  onNavigateToBrowse,
  initialProjectId,
  initialProjectTab = 'tasks',
  autoOpenNoteComposer = false,
}) => {
  const { currentUser, openAuthModal } = useAuth();
  const [projects, setProjects] = useState<StudyProject[]>([]);
  const [captures, setCaptures] = useState<QuickCaptureItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId || null);
  const [requestedProjectTab, setRequestedProjectTab] = useState<'tasks' | 'papers' | 'notes' | 'resources'>(
    initialProjectTab
  );
  const [shouldOpenNoteComposer, setShouldOpenNoteComposer] = useState<boolean>(autoOpenNoteComposer);
  const [activeTab, setActiveTab] = useState<'projects' | 'inbox'>('projects');

  // Modals & Onboarding Gate
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [createFromCaptureGate, setCreateFromCaptureGate] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [captureDefaultProjectId, setCaptureDefaultProjectId] = useState<string | undefined>(undefined);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<{ id: string; title: string } | null>(null);
  const [captureFilter, setCaptureFilter] = useState<string>('all');
  const [isGuestBannerDismissed, setIsGuestBannerDismissed] = useState(false);

  // Session restore
  const [previousSession, setPreviousSession] = useState<WorkspaceSession | null>(null);

  // Total Notes real count
  const [totalNotes, setTotalNotes] = useState<number>(0);

  useEffect(() => {
    if (initialProjectId) {
      setActiveProjectId(initialProjectId);
      setRequestedProjectTab(initialProjectTab);
      setShouldOpenNoteComposer(autoOpenNoteComposer);
    }
  }, [initialProjectId, initialProjectTab, autoOpenNoteComposer]);

  const fetchNotesCount = async (currentProjects?: StudyProject[]) => {
    const projectSource = currentProjects || workspaceService.getProjects();
    const localCount = projectSource.reduce((acc, p) => acc + (p.notes ? p.notes.length : 0), 0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTotalNotes(localCount);
        return;
      }

      const { count, error } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        setTotalNotes(localCount);
        return;
      }

      setTotalNotes(Math.max(count ?? 0, localCount));
    } catch {
      setTotalNotes(localCount);
    }
  };

  const loadData = () => {
    const latestProjects = workspaceService.getProjects();
    const latestCaptures = workspaceService.getQuickCaptures();
    setProjects(latestProjects);
    setCaptures(latestCaptures);
    void fetchNotesCount(latestProjects);
  };

  useEffect(() => {
    let active = true;

    const syncWorkspace = async () => {
      if (!currentUser?.id) {
        workspaceService.setStorageScope('guest');
        loadData();
        const session = workspaceService.getLastSession();
        if (active) {
          if (
            session?.activeProjectId &&
            workspaceService.getProjectById(session.activeProjectId)
          ) {
            setPreviousSession(session);
          } else {
            setPreviousSession(null);
          }
        }
        return;
      }

      workspaceService.setStorageScope('user');
      loadData();
      const res = await workspaceService.fetchFromSupabase();
      if (!active) return;
      if (res.synced) {
        setProjects(res.projects);
        setCaptures(res.captures);
        void fetchNotesCount(res.projects);
      }

      const session = workspaceService.getLastSession();
      if (session?.activeProjectId && res.projects.some((p) => p.id === session.activeProjectId)) {
        setPreviousSession(session);
      } else {
        setPreviousSession(null);
      }
    };

    void syncWorkspace();

    const handleWorkspaceUpdated = () => {
      if (active) loadData();
    };
    window.addEventListener('studify:workspace-updated', handleWorkspaceUpdated);

    return () => {
      active = false;
      window.removeEventListener('studify:workspace-updated', handleWorkspaceUpdated);
    };
  }, [currentUser?.id]);

  const handleRequestQuickCapture = (preferredProjectId?: string) => {
    const existingProjects = workspaceService.getProjects();
    if (existingProjects.length === 0) {
      setIsOnboardingOpen(true);
      return;
    }
    setCaptureDefaultProjectId(preferredProjectId || activeProjectId || existingProjects[0].id);
    setIsQuickCaptureOpen(true);
  };

  const handleOpenCreateModal = (fromGate: boolean = false) => {
    setCreateFromCaptureGate(fromGate);
    setIsNewProjectModalOpen(true);
  };

  const handleProjectCreated = (created: StudyProject, nextAction: PostCreateAction) => {
    loadData();
    setIsNewProjectModalOpen(false);
    setCreateFromCaptureGate(false);
    workspaceService.recordSessionState({ activeProjectId: created.id });

    if (nextAction === 'capture') {
      setCaptureDefaultProjectId(created.id);
      setIsQuickCaptureOpen(true);
      return;
    }

    if (nextAction === 'notes') {
      setRequestedProjectTab('notes');
      setShouldOpenNoteComposer(true);
      setActiveProjectId(created.id);
      return;
    }

    setRequestedProjectTab('tasks');
    setShouldOpenNoteComposer(false);
    setActiveProjectId(created.id);
  };

  const handleOpenProject = (id: string, tab: 'tasks' | 'papers' | 'notes' | 'resources' = 'tasks', openComposer = false) => {
    setRequestedProjectTab(tab);
    setShouldOpenNoteComposer(openComposer);
    setActiveProjectId(id);
    workspaceService.recordSessionState({ activeProjectId: id });
  };

  const handleDeleteProject = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteProject({ id, title });
  };

  const confirmProjectDeletion = () => {
    if (!confirmDeleteProject) return;
    workspaceService.deleteProject(confirmDeleteProject.id);
    loadData();
    if (activeProjectId === confirmDeleteProject.id) {
      setActiveProjectId(null);
    }
    setConfirmDeleteProject(null);
  };

  const handleToggleResolveCapture = (id: string) => {
    workspaceService.toggleResolveQuickCapture(id);
    setCaptures(workspaceService.getQuickCaptures());
  };

  const handleDeleteCapture = (id: string) => {
    workspaceService.deleteQuickCapture(id);
    setCaptures(workspaceService.getQuickCaptures());
  };

  // If a specific project is selected, render its dedicated workspace view
  if (activeProjectId) {
    const selectedProject = projects.find((p) => p.id === activeProjectId);
    if (selectedProject) {
      return (
        <>
          <ProjectWorkspaceView
            project={selectedProject}
            allPapers={papers}
            onBack={() => {
              setActiveProjectId(null);
              setShouldOpenNoteComposer(false);
              loadData();
            }}
            onSelectPaper={onSelectPaper}
            onDownloadPaper={onDownloadPaper}
            onProjectUpdated={() => loadData()}
            onAttachMorePapers={onNavigateToBrowse}
            initialTab={requestedProjectTab}
            autoOpenNoteComposer={shouldOpenNoteComposer}
            onOpenQuickCapture={(projectId) => handleRequestQuickCapture(projectId)}
          />

          <QuickCaptureModal
            isOpen={isQuickCaptureOpen}
            onClose={() => setIsQuickCaptureOpen(false)}
            defaultProjectId={captureDefaultProjectId || selectedProject.id}
            onSaved={() => {
              loadData();
            }}
            onOpenProjectNotes={(projectId) => {
              handleOpenProject(projectId, 'notes', true);
            }}
            onRequestCreateProject={() => handleOpenCreateModal(true)}
          />
        </>
      );
    }
  }

  // Aggregate stats across projects
  const visiblePaperIds = new Set(papers.map((p) => p.id));
  const totalTasks = projects.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = projects.reduce((acc, p) => acc + p.tasks.filter((t) => t.completed).length, 0);
  const totalAttachedPapers = projects.reduce(
    (acc, p) => acc + p.paperIds.filter((id) => visiblePaperIds.has(id)).length,
    0
  );

  const filteredCaptures = captures.filter((c) => {
    if (captureFilter === 'all') return true;
    return c.type === captureFilter;
  });

  const projectTitleById = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Student Desktop Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[var(--border-divider)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-blue)]">
              Personal Study Workspace
            </span>
            <span className="text-[var(--text-muted)] opacity-60">·</span>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight mt-1">
            {currentUser ? `Welcome back, ${currentUser.name.split(' ')[0]}` : 'Study Workspace'}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-xl">
            A focused environment to organize subjects, manage milestones, capture notes, and track PYQ practice.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleRequestQuickCapture()}
            className="px-3.5 py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5 text-[var(--color-yellow)]" />
            <span>Quick Capture</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateModal(false)}
            className="px-4 py-2 rounded-xl bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer btn-quad-border whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Logged-Out Guest Sync Suggestion Banner */}
      {!currentUser && !isGuestBannerDismissed && (
        <div className="p-4 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] flex items-center justify-center shrink-0 mt-0.5">
              <Cloud className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Saved on this browser · Sign in to sync across devices
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Your projects and notes work offline right here. Sign in to back up your workspace on any device and unlock PYQ uploads and bookmarks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Sync</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGuestBannerDismissed(true)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
              aria-label="Dismiss sign-in suggestion"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Session Restoration Banner */}
      {previousSession && previousSession.activeProjectId && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] flex items-center justify-center shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs">
              <span className="font-medium text-[var(--text-primary)]">Resume Previous Study Session: </span>
              <span className="text-[var(--accent-blue)] font-medium">
                {projects.find((p) => p.id === previousSession.activeProjectId)?.title || 'Active Project'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleOpenProject(previousSession.activeProjectId!)}
            className="px-3 py-1 bg-[var(--accent-blue-bg)] hover:bg-[var(--surface-elevated)] text-[var(--accent-blue)] text-xs font-semibold rounded-lg border border-[var(--accent-blue)]/30 shrink-0 transition-colors cursor-pointer btn-quad-border"
          >
            Resume →
          </button>
        </div>
      )}

      {/* Coherent Stat Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-divider)] shadow-xs">
        <div className="p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Projects</span>
            <Folder className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">{projects.length}</div>
          <div className="text-[11px] text-[var(--text-muted)]">Subject workspaces</div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Total Notes</span>
            <FileText className="w-3.5 h-3.5 text-[var(--color-yellow)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">{totalNotes}</div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {currentUser ? 'Synced study notes' : 'Saved on this browser'}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Milestones</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-green)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
            {completedTasks}/{totalTasks}
          </div>
          <div className="text-[11px] text-[var(--color-green)] font-medium">
            {totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}% completed` : 'All clear'}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Attached PYQs</span>
            <Bookmark className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">{totalAttachedPapers}</div>
          <div className="text-[11px] text-[var(--text-muted)]">Papers linked</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[var(--border-divider)] gap-1 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
          }`}
        >
          Study Projects ({projects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'inbox'
              ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
          }`}
        >
          Quick-Capture Scratchpad ({captures.length})
        </button>
      </div>

      {/* TAB 1: Projects Grid */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {projects.map((proj) => {
              const compTasks = proj.tasks.filter((t) => t.completed).length;
              const pct = proj.tasks.length > 0 ? Math.round((compTasks / proj.tasks.length) * 100) : 0;

              return (
                <div
                  key={proj.id}
                  onClick={() => handleOpenProject(proj.id)}
                  className="p-5 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md hover:bg-[var(--surface-elevated)]/90 border border-[var(--border-divider)] hover:border-[var(--border-hover)] cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-2.5">
                    {/* Top row: Subject & Date */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--accent-blue)]">{proj.subject || 'General Workspace'}</span>
                      {proj.targetDate && (
                        <span className="text-[11px] text-[var(--color-yellow)] font-mono tabular-nums">
                          Target: {proj.targetDate}
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors line-clamp-1">
                        {proj.title}
                      </h3>
                      {proj.description && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                          {proj.description}
                        </p>
                      )}
                    </div>

                    {/* Milestone Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                        <span>Milestones</span>
                        <span className="font-mono tabular-nums">{pct}% ({compTasks}/{proj.tasks.length})</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent-blue)] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] tabular-nums">
                      <span>{proj.paperIds.filter((id) => visiblePaperIds.has(id)).length} papers</span>
                      <span>·</span>
                      <span>{proj.notes.length} notes</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(proj.id, proj.title, e)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-red)] rounded-lg transition-colors cursor-pointer btn-quad-border"
                        title="Delete project"
                        aria-label="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[var(--accent-blue)] font-medium group-hover:translate-x-0.5 transition-transform">
                        Open →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Create Project Card Placeholder */}
            <div
              onClick={() => handleOpenCreateModal(false)}
              className="p-6 rounded-xl border border-dashed border-[var(--border-divider)] hover:border-[var(--accent-blue)] bg-[var(--surface-main)]/50 hover:bg-[var(--surface-elevated)] cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 transition-all min-h-[190px]"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Create Study Project</h4>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-[200px]">
                  Dedicate a workspace for a subject, chapter, or upcoming exam.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Quick-Capture Scratchpad */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['all', 'thought', 'formula', 'doubt', 'resource'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setCaptureFilter(f)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                    captureFilter === f
                      ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-main)] border border-[var(--border-divider)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleRequestQuickCapture()}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Capture Thought</span>
            </button>
          </div>

          {filteredCaptures.length === 0 ? (
            <div className="p-8 text-center bg-[var(--surface-main)]/85 border border-[var(--border-divider)] rounded-xl space-y-2.5">
              <Zap className="w-6 h-6 text-[var(--color-yellow)] mx-auto" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {projects.length === 0
                  ? 'Create a Study Project to start capturing'
                  : 'No Quick Captures yet'}
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                {projects.length === 0
                  ? 'Quick Capture saves thoughts, formulas, and doubts inside a project workspace.'
                  : 'Save formulas, exam doubts, and quick study reminders directly into any of your projects.'}
              </p>
              <button
                type="button"
                onClick={() => handleRequestQuickCapture()}
                className="px-4 py-1.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer"
              >
                {projects.length === 0 ? 'Create Project & Capture' : 'Capture Thought'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCaptures.map((item) => {
                const projName = item.projectId ? projectTitleById.get(item.projectId) : undefined;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                      item.isResolved
                        ? 'bg-[var(--surface-secondary)]/50 border-[var(--border-divider)] opacity-60'
                        : 'bg-[var(--surface-main)] border-[var(--border-divider)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-mono text-[10px] uppercase text-[var(--color-yellow)] font-semibold">
                          {item.type}{projName ? ` · ${projName}` : ''}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono tabular-nums shrink-0">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {item.title && (
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h4>
                      )}

                      <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {item.content}
                      </p>

                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {item.tags.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleResolveCapture(item.id)}
                        className="flex items-center gap-1.5 text-xs text-[var(--accent-blue)] hover:underline cursor-pointer"
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${item.isResolved ? 'text-[var(--color-green)]' : ''}`} />
                        <span>{item.isResolved ? 'Completed' : 'Mark Resolved'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCapture(item.id)}
                        className="text-[var(--text-muted)] hover:text-[var(--color-red)] p-1 transition-colors cursor-pointer"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PROJECT WORKSPACE ONBOARDING MODAL */}
      <WorkspaceOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onContinue={() => {
          setIsOnboardingOpen(false);
          handleOpenCreateModal(true);
        }}
      />

      {/* CREATE NEW PROJECT MODAL */}
      <CreateProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => {
          setIsNewProjectModalOpen(false);
          setCreateFromCaptureGate(false);
        }}
        onCreated={handleProjectCreated}
        fromQuickCaptureGate={createFromCaptureGate}
      />

      {/* QUICK CAPTURE MODAL */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        defaultProjectId={captureDefaultProjectId || projects[0]?.id}
        onSaved={() => {
          loadData();
        }}
        onOpenProjectNotes={(projectId) => {
          handleOpenProject(projectId, 'notes', true);
        }}
        onRequestCreateProject={() => handleOpenCreateModal(true)}
      />

      {confirmDeleteProject && (
        <ConfirmDialog
          isOpen={true}
          title="Delete Study Project"
          description={`Are you sure you want to delete "${confirmDeleteProject.title}"? This will remove the project and its local milestones.`}
          confirmLabel="Delete Project"
          onConfirm={confirmProjectDeletion}
          onCancel={() => setConfirmDeleteProject(null)}
        />
      )}
    </div>
  );
};
