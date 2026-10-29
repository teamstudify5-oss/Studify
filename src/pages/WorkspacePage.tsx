import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Zap, 
  BookOpen, 
  Search, 
  ArrowRight, 
  Bookmark, 
  Trash2, 
  Pin, 
  FileText, 
  ExternalLink,
  RotateCcw,
  Check,
  FolderPlus,
  BarChart3
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
  onNavigateToPredictor: () => void;
  initialProjectId?: string;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  papers,
  onSelectPaper,
  onDownloadPaper,
  onNavigateToBrowse,
  onNavigateToPredictor,
  initialProjectId
}) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<StudyProject[]>([]);
  const [captures, setCaptures] = useState<QuickCaptureItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId || null);
  const [activeTab, setActiveTab] = useState<'projects' | 'inbox' | 'timeline'>('projects');
  
  // Modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [captureFilter, setCaptureFilter] = useState<string>('all');
  
  // New Project Form
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Physics');
  const [newBoard, setNewBoard] = useState('CBSE');
  const [newTargetExam, setNewTargetExam] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState<'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'sky'>('cyan');

  // Session restore
  const [previousSession, setPreviousSession] = useState<WorkspaceSession | null>(null);

  // Requirement 1, 2 & 3: Total Notes real count for authenticated user
  const [totalNotes, setTotalNotes] = useState<number>(0);

  /**
   * 1. Fetch current authenticated user using: supabase.auth.getUser()
   * 2. Count the number of notes in the "notes" table where user_id = current user id
   * 3. Set real count in state to replace static number
   */
  const fetchNotesCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Fallback to local project notes if unauthenticated
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
        console.warn('Error counting notes from Supabase notes table:', error.message);
        const localProjects = workspaceService.getProjects();
        const localCount = localProjects.reduce((acc, p) => acc + (p.notes ? p.notes.length : 0), 0);
        setTotalNotes(localCount);
        return;
      }

      setTotalNotes(count ?? 0);
    } catch (err) {
      console.warn('fetchNotesCount exception:', err);
    }
  };

  useEffect(() => {
    loadData();
    fetchNotesCount();

    // Asynchronously fetch fresh data from Supabase
    workspaceService.fetchFromSupabase().then((res) => {
      if (res.projects && res.projects.length > 0) {
        setProjects(res.projects);
      }
      if (res.captures && res.captures.length > 0) {
        setCaptures(res.captures);
      }
      fetchNotesCount();
    });

    // Requirement 6: Updates automatically when a note is created or deleted
    // 1. Supabase Realtime Subscription on 'notes' table
    const notesChannel = supabase
      .channel('notes-dashboard-counter')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          fetchNotesCount();
        }
      )
      .subscribe();

    // 2. Auth State Change listener
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      fetchNotesCount();
    });

    // 3. Local app event listener for notes created or deleted
    const handleNotesUpdated = () => {
      fetchNotesCount();
    };
    window.addEventListener('studify:notes-updated', handleNotesUpdated);

    const session = workspaceService.getSession();
    if (session && session.activeProjectId) {
      setPreviousSession(session);
    }

    return () => {
      supabase.removeChannel(notesChannel);
      authSub?.unsubscribe();
      window.removeEventListener('studify:notes-updated', handleNotesUpdated);
    };
  }, []);

  const loadData = () => {
    setProjects(workspaceService.getProjects());
    setCaptures(workspaceService.getQuickCaptures());
    fetchNotesCount();
  };

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    workspaceService.recordSessionState({
      lastActiveTab: 'workspace',
      activeProjectId: id
    });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created = workspaceService.createProject({
      title: newTitle.trim(),
      subject: newSubject.trim(),
      examBoard: newBoard,
      targetExam: newTargetExam.trim() || undefined,
      targetDate: newTargetDate || undefined,
      description: newDescription.trim() || `Study project for ${newTitle}.`,
      color: newColor
    });

    setNewTitle('');
    setNewDescription('');
    setNewTargetExam('');
    setNewTargetDate('');
    setIsNewProjectModalOpen(false);
    loadData();
    setActiveProjectId(created.id);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Student Desktop Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Personal Student Workspace</span>
            <span className="text-white/20">·</span>
            <span className="text-xs text-[#A7B4C8]">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC] tracking-tight mt-1">
            {currentUser ? `Welcome back, ${currentUser.name.split(' ')[0]}!` : 'Your Study Workspace & Desktop'}
          </h1>
          <p className="text-xs sm:text-sm text-[#A7B4C8] mt-1 max-w-xl">
            A unified environment to organize subjects, manage exam milestones, capture thoughts, and track PYQ practice.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsQuickCaptureOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Zap className="w-4 h-4" />
            <span>Quick Capture</span>
          </button>

          <button
            onClick={onNavigateToPredictor}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Exam Predictor</span>
          </button>

          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Study Project</span>
          </button>
        </div>
      </div>

      {/* Session Restoration Banner (If student had active project in previous session) */}
      {previousSession && previousSession.activeProjectId && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-cyan-950/40 border border-cyan-400/30 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white">Resume Previous Study Session: </span>
              <span className="text-cyan-300">
                {projects.find((p) => p.id === previousSession.activeProjectId)?.title || 'Active Project'}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleOpenProject(previousSession.activeProjectId!)}
            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold rounded-xl border border-cyan-400/40 shrink-0 transition-colors"
          >
            Resume Now →
          </button>
        </div>
      )}

      {/* Telemetry / Summary Dashboard Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A7B4C8]">
            <span>Active Projects</span>
            <Folder className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{projects.length}</div>
          <div className="text-[11px] text-cyan-400 font-medium">Dedicated subject workspaces</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A7B4C8]">
            <span>Total Notes</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalNotes}</div>
          <div className="text-[11px] text-amber-400 font-medium">Real-time synced notes</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A7B4C8]">
            <span>Tasks Progress</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {completedTasks}/{totalTasks}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">
            {totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}% milestones done` : 'No tasks pending'}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#A7B4C8]">
            <span>Attached PYQs</span>
            <Bookmark className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalAttachedPapers}</div>
          <div className="text-[11px] text-teal-400 font-medium">Papers linked for practice</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-white/[0.1] gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'projects'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
              : 'text-[#A7B4C8] hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Study Projects ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'inbox'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
              : 'text-[#A7B4C8] hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Quick-Capture Scratchpad ({captures.length})
        </button>
      </div>

      {/* TAB 1: Projects Grid */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => {
              const compTasks = proj.tasks.filter((t) => t.completed).length;
              const pct = proj.tasks.length > 0 ? Math.round((compTasks / proj.tasks.length) * 100) : 0;

              return (
                <div
                  key={proj.id}
                  onClick={() => handleOpenProject(proj.id)}
                  className="p-5 rounded-2xl bg-[#101B2D]/80 hover:bg-[#15233D] border border-white/[0.12] hover:border-cyan-500/40 cursor-pointer transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between space-y-4 group shadow-xl shadow-black/20"
                >
                  <div className="space-y-3">
                    {/* Top row: Subject & Date */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-cyan-400">{proj.subject}</span>
                      {proj.targetDate && (
                        <span className="text-[11px] text-amber-300/90 font-mono">
                          Target: {proj.targetDate}
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-200 transition-colors line-clamp-1">
                        {proj.title}
                      </h3>
                      <p className="text-xs text-[#A7B4C8] line-clamp-2 mt-1 leading-relaxed">
                        {proj.description}
                      </p>
                    </div>

                    {/* Milestone Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#A7B4C8]">
                        <span>Milestones</span>
                        <span className="font-mono">{pct}% ({compTasks}/{proj.tasks.length})</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#A7B4C8]">
                    <div className="flex items-center gap-3">
                      <span>{proj.paperIds.length} papers</span>
                      <span>·</span>
                      <span>{proj.notes.length} notes</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="p-1 text-[#A7B4C8] hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform">
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
              className="p-6 rounded-2xl border-2 border-dashed border-white/[0.14] hover:border-cyan-400/50 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer flex flex-col items-center justify-center text-center space-y-3 transition-all min-h-[220px]"
            >
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Create Study Project</h4>
                <p className="text-xs text-[#A7B4C8] mt-1 max-w-[200px]">
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
                  className={`px-3 py-1.5 rounded-xl capitalize font-medium transition-all ${
                    captureFilter === f
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                      : 'text-[#A7B4C8] hover:text-white bg-white/[0.04]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsQuickCaptureOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Capture Thought</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCaptures.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  item.isResolved
                    ? 'bg-white/[0.02] border-white/[0.06] opacity-60'
                    : 'bg-[#101B2D]/80 border-white/[0.12] hover:border-amber-400/40'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-[#A7B4C8]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {item.title && (
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  )}

                  <p className="text-xs text-[#E2E8F0] whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.tags.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-[#A7B4C8]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleToggleResolveCapture(item.id)}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${item.isResolved ? 'text-emerald-400' : ''}`} />
                    <span>{item.isResolved ? 'Completed' : 'Mark Resolved'}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteCapture(item.id)}
                    className="text-[#A7B4C8] hover:text-rose-400 p-1"
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

      {/* CREATE NEW STUDY PROJECT MODAL */}
      {isNewProjectModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsNewProjectModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#0A1222] border border-white/[0.16] rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Create New Study Project</h3>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-[#A7B4C8] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs text-[#A7B4C8] mb-1 font-medium">Project Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JEE Main Calculus & Vector 3D Mastery"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A7B4C8] mb-1 font-medium">Subject *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Physics, Chemistry, Math"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A7B4C8] mb-1 font-medium">Board / Exam Target</label>
                  <select
                    value={newBoard}
                    onChange={(e) => setNewBoard(e.target.value)}
                    className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="JEE Main">JEE Main</option>
                    <option value="JEE Advanced">JEE Advanced</option>
                    <option value="NEET UG">NEET UG</option>
                    <option value="State Board">State Board</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A7B4C8] mb-1 font-medium">Specific Exam Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Board Term 2 / Session 1"
                    value={newTargetExam}
                    onChange={(e) => setNewTargetExam(e.target.value)}
                    className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A7B4C8] mb-1 font-medium">Target Exam Date</label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#A7B4C8] mb-1 font-medium">Goal or Description</label>
                <textarea
                  rows={2}
                  placeholder="What is your focus for this workspace? (e.g. Master high-weightage chapters and solve past 5 years)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 font-sans resize-none"
                />
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#A7B4C8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  Create Project
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
