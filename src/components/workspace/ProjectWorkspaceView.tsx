import React, { useState } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  FileText, 
  ExternalLink, 
  Video, 
  Book, 
  Link as LinkIcon, 
  Calendar, 
  Download, 
  Eye, 
  FolderPlus,
  Pin
} from 'lucide-react';
import { Paper } from '../../types';
import { StudyProject } from '../../types/workspace';
import { workspaceService } from '../../services/workspaceService';

interface ProjectWorkspaceViewProps {
  project: StudyProject;
  allPapers: Paper[];
  onBack: () => void;
  onSelectPaper: (paper: Paper) => void;
  onDownloadPaper: (paper: Paper, e?: React.MouseEvent) => void;
  onProjectUpdated: (updated: StudyProject) => void;
  onAttachMorePapers: () => void;
}

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  project,
  allPapers,
  onBack,
  onSelectPaper,
  onDownloadPaper,
  onProjectUpdated,
  onAttachMorePapers
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'papers' | 'notes' | 'resources'>('tasks');
  const [currentProject, setCurrentProject] = useState<StudyProject>(project);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // New note form state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags] = useState<string[]>([]);

  // New resource form state
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<'link' | 'video' | 'doc' | 'book'>('link');
  const [resNotes, setResNotes] = useState('');

  const refreshProject = () => {
    const updated = workspaceService.getProjectById(currentProject.id);
    if (updated) {
      setCurrentProject(updated);
      onProjectUpdated(updated);
    }
  };

  // Task actions
  const handleToggleTask = (taskId: string) => {
    workspaceService.toggleTask(currentProject.id, taskId);
    refreshProject();
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    workspaceService.addTask(currentProject.id, newTaskTitle, newTaskPriority, newTaskDueDate || undefined);
    setNewTaskTitle('');
    setNewTaskDueDate('');
    refreshProject();
  };

  const handleDeleteTask = (taskId: string) => {
    workspaceService.deleteTask(currentProject.id, taskId);
    refreshProject();
  };

  // Note actions
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    await workspaceService.saveNoteAsync(currentProject.id, {
      title: noteTitle.trim() || 'Study Note',
      content: noteContent.trim(),
      tags: noteTags,
      isPinned: false
    });
    setNoteTitle('');
    setNoteContent('');
    setIsAddingNote(false);
    refreshProject();
  };

  const handleDeleteNote = (noteId: string) => {
    workspaceService.deleteNote(currentProject.id, noteId);
    refreshProject();
  };

  // Resource actions
  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim()) return;
    workspaceService.addResource(currentProject.id, {
      title: resTitle.trim(),
      url: resUrl.trim(),
      type: resType,
      notes: resNotes.trim() || undefined
    });
    setResTitle('');
    setResUrl('');
    setResNotes('');
    setIsAddingResource(false);
    refreshProject();
  };

  const handleDeleteResource = (resourceId: string) => {
    workspaceService.deleteResource(currentProject.id, resourceId);
    refreshProject();
  };

  const handleRemovePaper = (paperId: string) => {
    workspaceService.removePaperFromProject(currentProject.id, paperId);
    refreshProject();
  };

  const attachedPapers = allPapers.filter((p) => currentProject.paperIds.includes(p.id));
  const completedTasks = currentProject.tasks.filter((t) => t.completed).length;
  const totalTasks = currentProject.tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Export summary
  const handleExportSummary = () => {
    const text = 
`STUDIFY PROJECT: ${currentProject.title}
Subject: ${currentProject.subject || 'General'} | Target: ${currentProject.targetExam || 'Not specified'}
Target Date: ${currentProject.targetDate || 'Not specified'}
Tasks Completed: ${completedTasks}/${totalTasks} (${progressPercent}%)

============================================================
TASKS & MILESTONES:
${currentProject.tasks.map((t) => `[${t.completed ? 'X' : ' '}] (${t.priority.toUpperCase()}) ${t.title}${t.dueDate ? ` (Due: ${t.dueDate})` : ''}`).join('\n')}

============================================================
LINKED PAST PAPERS:
${attachedPapers.map((p) => `• ${p.examBoard} ${p.grade} - ${p.title} (${p.year}) [${p.totalMarks} Marks]`).join('\n')}

============================================================
STUDY NOTES & FORMULAE:
${currentProject.notes.map((n) => `--- ${n.title} ---\n${n.content}\nTags: ${n.tags.join(', ')}\n`).join('\n\n')}

============================================================
RESOURCES:
${currentProject.resources.map((r) => `• ${r.title} (${r.type}): ${r.url}${r.notes ? ` - ${r.notes}` : ''}`).join('\n')}

Generated from Studify Student Workspace.
`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProject.title.replace(/\s+/g, '_')}_Summary.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Bar: Back & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-divider)] pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] btn-quad-border"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Projects</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportSummary}
            className="px-3 py-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border"
            title="Export project notes and tasks to text"
          >
            <Download className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            <span>Export Notes</span>
          </button>
        </div>
      </div>

      {/* Project Banner / Card */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 sm:p-6 space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            {currentProject.subject && (
              <span className="font-semibold text-[var(--accent-blue)]">
                {currentProject.subject}
              </span>
            )}
            {currentProject.examBoard && (
              <>
                <span className="text-[var(--text-muted)] opacity-60">·</span>
                <span>{currentProject.examBoard}</span>
              </>
            )}
            {currentProject.targetExam && (
              <>
                <span className="text-[var(--text-muted)] opacity-60">·</span>
                <span>{currentProject.targetExam}</span>
              </>
            )}
          </div>

          {currentProject.targetDate && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-yellow)] font-mono">
              <Calendar className="w-3 h-3" />
              <span>Target: {currentProject.targetDate}</span>
            </div>
          )}
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            {currentProject.title}
          </h1>
          {currentProject.description && (
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
              {currentProject.description}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="pt-1 max-w-md space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Milestones</span>
            <span className="font-mono text-[var(--text-primary)] font-medium">
              {progressPercent}% completed ({completedTasks}/{totalTasks} tasks)
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent-blue)] rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-[var(--border-divider)] gap-1 overflow-x-auto pb-1">
        {[
          { id: 'tasks' as const, label: `Tasks (${currentProject.tasks.length})` },
          { id: 'papers' as const, label: `Attached Papers (${attachedPapers.length})` },
          { id: 'notes' as const, label: `Notes (${currentProject.notes.length})` },
          { id: 'resources' as const, label: `Resources (${currentProject.resources.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Add Task Input Form */}
          <form onSubmit={handleAddTask} className="p-3.5 sm:p-4 rounded-xl bg-[var(--surface-main)] border border-[var(--border-divider)] space-y-2.5 shadow-xs">
            <div className="text-xs font-medium text-[var(--text-primary)]">Add Study Milestone or Task</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                placeholder="e.g. Solve Section C numericals from 2024 paper..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <div className="flex gap-2">
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  type="text"
                  placeholder="Due date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-24 px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity shrink-0 flex items-center gap-1 cursor-pointer btn-quad-border"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </form>

          {/* Task List */}
          <div className="space-y-2">
            {currentProject.tasks.length === 0 ? (
              <div className="p-8 text-center bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-secondary)]">
                No tasks added yet. Add study goals above to track your progress.
              </div>
            ) : (
              currentProject.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                    task.completed
                      ? 'bg-[var(--surface-secondary)]/40 border-[var(--border-divider)] text-[var(--text-muted)]'
                      : 'bg-[var(--surface-main)]/85 backdrop-blur-md border-[var(--border-divider)] text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task.id)}
                      className="cursor-pointer shrink-0 text-[var(--accent-blue)]"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />
                      ) : (
                        <Circle className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                    <span className={`text-xs font-medium ${task.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        task.priority === 'high'
                          ? 'bg-[var(--accent-red-bg)] text-[var(--color-red)]'
                          : task.priority === 'medium'
                          ? 'bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)]'
                          : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                      }`}
                    >
                      {task.priority}
                    </span>

                    {task.dueDate && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono hidden sm:inline">
                        {task.dueDate}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--color-red)] transition-colors cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Attached Past Papers */}
      {activeTab === 'papers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">
              Previous year question papers attached specifically to this study project.
            </p>
            <button
              type="button"
              onClick={onAttachMorePapers}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue-bg)] hover:bg-[var(--surface-elevated)] text-[var(--accent-blue)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Browse & Attach</span>
            </button>
          </div>

          {attachedPapers.length === 0 ? (
            <div className="p-10 text-center bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl space-y-3">
              <FileText className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">No papers attached yet</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Explore the public Studify PYQ library and click "Add to Project" on any paper to attach it here.
              </p>
              <button
                type="button"
                onClick={onAttachMorePapers}
                className="px-4 py-1.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg cursor-pointer btn-quad-border"
              >
                Explore PYQ Library
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachedPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="p-4 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--accent-blue)]">{paper.examBoard} · {paper.grade}</span>
                      <span className="font-mono text-[var(--text-muted)]">{paper.year}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1">{paper.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1">{paper.totalMarks} Marks · {paper.subject}</p>
                  </div>

                  <div className="pt-2.5 border-t border-[var(--border-divider)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectPaper(paper)}
                        className="px-2.5 py-1 bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer btn-quad-border"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                      {onDownloadPaper && (
                        <button
                          type="button"
                          onClick={(e) => onDownloadPaper(paper, e)}
                          className="p-1.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer btn-quad-border"
                          title="Download Paper"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePaper(paper.id)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--color-red)] transition-colors cursor-pointer"
                      title="Detach from project"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Study Notes & Formulas */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">
              Your dedicated project scratchpad, formula cheat sheet, and notes.
            </p>
            <button
              type="button"
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue-bg)] hover:bg-[var(--surface-elevated)] text-[var(--accent-blue)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNote ? 'Cancel' : 'New Note'}</span>
            </button>
          </div>

          {isAddingNote && (
            <form onSubmit={handleSaveNote} className="p-4 sm:p-5 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] space-y-3 shadow-xs">
              <div className="text-xs font-semibold text-[var(--text-primary)]">Create Study Note</div>
              <input
                type="text"
                placeholder="Note Title (e.g. Ray Optics Formulas)"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <textarea
                required
                rows={4}
                placeholder="Write your study notes, derivations, formulae, or key conceptual bullet points..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNote(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] cursor-pointer btn-quad-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer btn-quad-border"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentProject.notes.map((note) => (
              <div
                key={note.id}
                className="p-4 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {note.isPinned && <Pin className="w-3.5 h-3.5 text-[var(--accent-blue)] fill-current" />}
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">{note.title}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--color-red)] transition-colors cursor-pointer"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed bg-[var(--surface-secondary)]/50 p-2.5 rounded-lg border border-[var(--border-divider)]">
                  {note.content}
                </div>

                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {note.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Resources & Links */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">
              Reference materials, textbooks, videos, and external links.
            </p>
            <button
              type="button"
              onClick={() => setIsAddingResource(!isAddingResource)}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue-bg)] hover:bg-[var(--surface-elevated)] text-[var(--accent-blue)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer btn-quad-border"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingResource ? 'Cancel' : 'Add Resource'}</span>
            </button>
          </div>

          {isAddingResource && (
            <form onSubmit={handleAddResource} className="p-4 sm:p-5 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] space-y-3 shadow-xs">
              <div className="text-xs font-semibold text-[var(--text-primary)]">Add Study Resource</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Resource Title (e.g. NCERT Official Physics PDF)"
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="link">Web Link</option>
                  <option value="video">Video Lecture</option>
                  <option value="book">Textbook / PDF</option>
                  <option value="doc">Class Notes / Doc</option>
                </select>
              </div>

              <input
                type="url"
                required
                placeholder="https://..."
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />

              <input
                type="text"
                placeholder="Annotation / note (e.g. Chapter 9 & 10 are most important)"
                value={resNotes}
                onChange={(e) => setResNotes(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingResource(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] cursor-pointer btn-quad-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer btn-quad-border"
                >
                  Save Resource
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {currentProject.resources.length === 0 ? (
              <div className="p-8 text-center bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-secondary)]">
                No external resources added yet. Add YouTube lectures, NCERT links, or Drive folders.
              </div>
            ) : (
              currentProject.resources.map((res) => (
                <div
                  key={res.id}
                  className="p-3 rounded-xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] flex items-center justify-between gap-3 hover:border-[var(--border-hover)] transition-colors shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[var(--surface-elevated)] text-[var(--accent-blue)] flex items-center justify-center shrink-0">
                      {res.type === 'video' ? <Video className="w-3.5 h-3.5" /> : res.type === 'book' ? <Book className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{res.title}</div>
                      {res.notes && <div className="text-[11px] text-[var(--text-muted)] truncate">{res.notes}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-xs font-medium text-[var(--accent-blue)] flex items-center gap-1 transition-colors btn-quad-border"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteResource(res.id)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-red)] transition-colors cursor-pointer"
                      title="Delete resource"
                      aria-label="Delete resource"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
