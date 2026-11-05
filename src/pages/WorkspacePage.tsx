import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Zap, 
  Trash2, 
  FileText, 
  RotateCcw,
  FolderPlus,
  Bookmark
} from 'lucide-react';
import { Paper } from '../types';
import { StudyProject, QuickCaptureItem, WorkspaceSession } from '../types/workspace';
import { workspaceService } from '../services/workspaceService';
import { useAuth } from '../context/AuthContext';
import { ProjectWorkspaceView } from '../components/workspace/ProjectWorkspaceView';
import { QuickCaptureModal } from '../components/workspace/QuickCaptureModal';
import { supabase } from '../supabaseClient.js';

interface WorkspacePageProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onDownloadPaper: (paper: Paper, e?: React.MouseEvent) => void;
  onNavigateToBrowse: () => void;
  initialProjectId?: string;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  papers,
  onSelectPaper,
  onDownloadPaper,
  onNavigateToBrowse,
  initialProjectId
}) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<StudyProject[]>([]);
  const [captures, setCaptures] = useState<QuickCaptureItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId || null);
  const [activeTab, setActiveTab] = useState<'projects' | 'inbox'>('projects');
  
  // Modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [captureFilter, setCaptureFilter] = useState<string>('all');
  
  // New Project Form
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBoard, setNewBoard] = useState('');
  const [newTargetExam, setNewTargetExam] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  // Session restore
  const [previousSession, setPreviousSession] = useState<WorkspaceSession | null>(null);

  // Total Notes real count for authenticated user
  const [totalNotes, setTotalNotes] = useState<number>(0);

  const fetchNotesCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const localProjects = workspaceService.getProjects();
        const localCount = localProjects.reduce((acc, p) => acc + (p.notes ? p.notes.length : 0), 0);
        setTotalNotes(localCount);
        return;
      }

      const { count, error } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        const localProjects = workspaceService.getProjects();
        const localCount = localProjects.reduce((acc, p) => acc + (p.notes ? p.notes.length : 0), 0);
        setTotalNotes(localCount);
        return;
      }

      setTotalNotes(count ?? 0);
    } catch {
      const localProjects = workspaceService.getProjects();
      const localCount = localProjects.reduce((acc, p) => acc + (p.notes ? p.notes.length : 0), 0);
      setTotalNotes(localCount);
    }
  };

  useEffect(() => {
    loadData();
    fetchNotesCount();

    workspaceService.fetchFromSupabase().then((res) => {
      if (res.projects && res.projects.length > 0) {
        setProjects(res.projects);
      }
      if (res.captures && res.captures.length > 0) {
        setCaptures(res.captures);
      }
      fetchNotesCount();
    });

    const session = workspaceService.getLastSession();
    if (session && session.activeProjectId) {
      setPreviousSession(session);
    }
  }, []);

  const loadData = () => {
    setProjects(workspaceService.getProjects());
    setCaptures(workspaceService.getQuickCaptures());
    fetchNotesCount();
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const { project: created } = await workspaceService.createProjectAsync({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      subject: newSubject.trim() || undefined,
      examBoard: newBoard || undefined,
      targetExam: newTargetExam.trim() || undefined,
      targetDate: newTargetDate || undefined,
      color: 'cyan',
    });

    loadData();
    setNewTitle('');
    setNewSubject('');
    setNewBoard('');
    setNewTargetExam('');
    setNewTargetDate('');
    setNewDescription('');
    setShowOptionalDetails(false);
    setIsNewProjectModalOpen(false);

    if (created) {
      setActiveProjectId(created.id);
    }
  };

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    workspaceService.recordSessionState({ activeProjectId: id });
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this study project?')) {
      workspaceService.deleteProject(id);
      loadData();
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
    }
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
        <ProjectWorkspaceView
          project={selectedProject}
          allPapers={papers}
          onBack={() => {
            setActiveProjectId(null);
            loadData();
          }}
          onSelectPaper={onSelectPaper}
          onDownloadPaper={onDownloadPaper}
          onProjectUpdated={() => loadData()}
          onAttachMorePapers={onNavigateToBrowse}
        />
      );
    }
  }

  // Aggregate stats across projects
  const totalTasks = projects.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = projects.reduce((acc, p) => acc + p.tasks.filter((t) => t.completed).length, 0);
  const totalAttachedPapers = projects.reduce((acc, p) => acc + p.paperIds.length, 0);

  const filteredCaptures = captures.filter((c) => {
    if (captureFilter === 'all') return true;
    return c.type === captureFilter;
  });

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
            onClick={() => setIsQuickCaptureOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border"
          >
            <Zap className="w-3.5 h-3.5 text-[var(--color-yellow)]" />
            <span>Quick Capture</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewProjectModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer btn-quad-border"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

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
          <div className="text-[11px] text-[var(--text-muted)]">Synced study notes</div>
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
          onClick={() => setActiveTab('projects')}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'projects'
              ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
          }`}
        >
          Study Projects ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
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
                        <span className="text-[11px] text-[var(--color-yellow)] font-mono">
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
                        <span className="font-mono">{pct}% ({compTasks}/{proj.tasks.length})</span>
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
                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                      <span>{proj.paperIds.length} papers</span>
                      <span>·</span>
                      <span>{proj.notes.length} notes</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(proj.id, e)}
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
              onClick={() => setIsNewProjectModalOpen(true)}
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
            <div className="flex gap-1.5 text-xs">
              {['all', 'thought', 'formula', 'doubt', 'resource'].map((f) => (
                <button
                  key={f}
                  onClick={() => setCaptureFilter(f)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors ${
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
              onClick={() => setIsQuickCaptureOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Capture Thought</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCaptures.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                  item.isResolved
                    ? 'bg-[var(--surface-secondary)]/50 border-[var(--border-divider)] opacity-60'
                    : 'bg-[var(--surface-main)] border-[var(--border-divider)] hover:border-[var(--border-hover)]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded uppercase bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)] font-medium">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
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
                    onClick={() => handleToggleResolveCapture(item.id)}
                    className="flex items-center gap-1.5 text-xs text-[var(--accent-blue)] hover:underline"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${item.isResolved ? 'text-[var(--color-green)]' : ''}`} />
                    <span>{item.isResolved ? 'Completed' : 'Mark Resolved'}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteCapture(item.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--color-red)] p-1 transition-colors"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE NEW PROJECT MODAL */}
      {isNewProjectModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs animate-in fade-in"
          onClick={() => {
            setIsNewProjectModalOpen(false);
            setShowOptionalDetails(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-xl shadow-xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[var(--accent-blue)]" />
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Create New Project</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">General-purpose workspace. Only project name is required.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsNewProjectModalOpen(false);
                  setShowOptionalDetails(false);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-medium">
                  Project Name <span className="text-[var(--accent-blue)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Modern Physics Notes, Research Hub, Q1 Exam Prep"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
              </div>

              {/* Collapsible / Optional details toggle */}
              <div className="border border-[var(--border-divider)] rounded-lg bg-[var(--surface-main)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                  className="w-full p-2.5 text-left flex items-center justify-between hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {showOptionalDetails ? '− Optional Details (Subject, Board, Target Date)' : '+ Optional Details (Subject, Board, Target Date)'}
                  </span>
                  <span className="text-[11px] text-[var(--accent-blue)] font-medium">
                    {showOptionalDetails ? 'Hide' : 'Add Details'}
                  </span>
                </button>

                {showOptionalDetails && (
                  <div className="p-3 pt-0 space-y-3 border-t border-[var(--border-divider)]">
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">Subject (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Science, Math"
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">Board / Exam (Optional)</label>
                        <select
                          value={newBoard}
                          onChange={(e) => setNewBoard(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                        >
                          <option value="">None / Not Applicable</option>
                          <option value="CBSE">CBSE</option>
                          <option value="ICSE">ICSE</option>
                          <option value="JEE Main">JEE Main</option>
                          <option value="JEE Advanced">JEE Advanced</option>
                          <option value="NEET UG">NEET UG</option>
                          <option value="State Board">State Board</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">Specific Goal (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Midterms / Entrance"
                          value={newTargetExam}
                          onChange={(e) => setNewTargetExam(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">Target Date (Optional)</label>
                        <input
                          type="date"
                          value={newTargetDate}
                          onChange={(e) => setNewTargetDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">Description (Optional)</label>
                      <textarea
                        rows={2}
                        placeholder="What is your focus for this project? (Optional)"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewProjectModalOpen(false);
                    setShowOptionalDetails(false);
                  }}
                  className="px-3.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] cursor-pointer btn-quad-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer btn-quad-border"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CAPTURE MODAL */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onSaved={() => {
          setCaptures(workspaceService.getQuickCaptures());
        }}
      />
    </div>
  );
};
