import React, { useState } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  FileText, 
  Bookmark, 
  Pin, 
  ExternalLink, 
  Video, 
  Book, 
  Link as LinkIcon, 
  Calendar, 
  Download, 
  Eye, 
  Sparkles,
  Share2,
  FolderPlus
} from 'lucide-react';
import { Paper } from '../../types';
import { StudyProject, ProjectTask, ProjectNote, ProjectResource } from '../../types/workspace';
import { workspaceService } from '../../services/workspaceService';
import { AddToProjectModal } from './AddToProjectModal';

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
  const [noteTagInput, setNoteTagInput] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);

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
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    workspaceService.saveNote(currentProject.id, {
      title: noteTitle.trim() || 'Study Note',
      content: noteContent.trim(),
      tags: noteTags,
      isPinned: false
    });
    setNoteTitle('');
    setNoteContent('');
    setNoteTags([]);
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

  const handleDeleteResource = (resId: string) => {
    workspaceService.deleteResource(currentProject.id, resId);
    refreshProject();
  };

  const handleRemovePaper = (paperId: string) => {
    workspaceService.removePaperFromProject(currentProject.id, paperId);
    refreshProject();
  };

  const attachedPapers = allPapers.filter((p) => currentProject.paperIds.includes(p.id));

  // Progress metrics
  const totalTasks = currentProject.tasks.length;
  const completedTasks = currentProject.tasks.filter((t) => t.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Export summary
  const handleExportSummary = () => {
    const text = 
`STUDIFY STUDY PROJECT: ${currentProject.title}
Subject: ${currentProject.subject} | Target: ${currentProject.targetExam || 'Examinations'}
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-[#A7B4C8] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Projects</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportSummary}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
            title="Export project notes and tasks to text"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Notes</span>
          </button>
        </div>
      </div>

      {/* Project Banner / Card */}
      <div className="bg-[#0A1222]/90 border border-white/[0.14] rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-semibold">
                {currentProject.subject}
              </span>
              {currentProject.examBoard && (
                <span className="text-[#A7B4C8]">· {currentProject.examBoard}</span>
              )}
              {currentProject.targetExam && (
                <span className="text-[#A7B4C8]">· {currentProject.targetExam}</span>
              )}
            </div>

            {currentProject.targetDate && (
              <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-400/20 px-3 py-1 rounded-full font-mono">
                <Calendar className="w-3.5 h-3.5" />
                <span>Target: {currentProject.targetDate}</span>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              {currentProject.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#A7B4C8] mt-1.5 max-w-2xl leading-relaxed">
              {currentProject.description}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="pt-2 max-w-md space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#A7B4C8]">
              <span>Milestone Progress</span>
              <span className="font-mono text-cyan-300 font-bold">{progressPercent}% Completed ({completedTasks}/{totalTasks} tasks)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-white/[0.1] gap-2 overflow-x-auto pb-1">
        {[
          { id: 'tasks' as const, label: `Tasks & Milestones (${currentProject.tasks.length})` },
          { id: 'papers' as const, label: `Attached PYQ Papers (${attachedPapers.length})` },
          { id: 'notes' as const, label: `Notes & Formula Sheet (${currentProject.notes.length})` },
          { id: 'resources' as const, label: `Resources & Links (${currentProject.resources.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30'
                : 'text-[#A7B4C8] hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {/* Add Task Input Form */}
          <form onSubmit={handleAddTask} className="p-4 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-3">
            <div className="text-xs font-semibold text-white">Add Study Milestone or Practice Goal</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                placeholder="e.g. Solve Section C numericals from 2024 paper..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
              />
              <div className="flex gap-2">
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
                <input
                  type="text"
                  placeholder="Due (e.g. Friday)"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-28 px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl hover:from-cyan-400 hover:to-teal-400 transition-all shrink-0 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>
            </div>
          </form>

          {/* Task List */}
          <div className="space-y-2">
            {currentProject.tasks.length === 0 ? (
              <div className="p-8 text-center bg-[#101B2D]/40 border border-white/[0.08] rounded-2xl text-xs text-[#A7B4C8]">
                No tasks added yet. Add study goals above to track your progress!
              </div>
            ) : (
              currentProject.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    task.completed
                      ? 'bg-white/[0.02] border-white/[0.06] text-[#A7B4C8]'
                      : 'bg-[#101B2D]/80 border-white/[0.1] text-white hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task.id)}
                      className="cursor-pointer shrink-0 text-cyan-400 hover:scale-110 transition-transform"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-[#A7B4C8]" />
                      )}
                    </button>
                    <span className={`text-xs sm:text-sm font-medium ${task.completed ? 'line-through text-[#A7B4C8]/70' : 'text-white'}`}>
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold uppercase ${
                        task.priority === 'high'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : task.priority === 'medium'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-white/[0.06] text-[#A7B4C8]'
                      }`}
                    >
                      {task.priority}
                    </span>

                    {task.dueDate && (
                      <span className="text-[11px] text-[#A7B4C8] hidden sm:inline">
                        {task.dueDate}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1 rounded-lg text-[#A7B4C8] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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
            <p className="text-xs text-[#A7B4C8]">
              Previous year question papers attached specifically to this study project for revision and timed practice.
            </p>
            <button
              onClick={onAttachMorePapers}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Browse & Attach Papers</span>
            </button>
          </div>

          {attachedPapers.length === 0 ? (
            <div className="p-12 text-center bg-[#101B2D]/40 border border-white/[0.08] rounded-2xl space-y-3">
              <FileText className="w-8 h-8 text-[#A7B4C8] mx-auto" />
              <div className="text-sm font-semibold text-white">No papers attached yet</div>
              <p className="text-xs text-[#A7B4C8] max-w-sm mx-auto">
                Explore the public Studify PYQ library and click "Add to Project" on any paper to attach it here.
              </p>
              <button
                onClick={onAttachMorePapers}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl"
              >
                Explore PYQ Library
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachedPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="p-4 rounded-2xl bg-[#101B2D]/80 border border-white/[0.12] hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#A7B4C8]">
                      <span className="font-semibold text-cyan-400">{paper.examBoard} · {paper.grade}</span>
                      <span className="font-mono text-white/60">{paper.year}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-2">{paper.title}</h3>
                    <p className="text-xs text-[#A7B4C8] line-clamp-1">{paper.totalMarks} Marks · {paper.subject}</p>
                  </div>

                  <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectPaper(paper)}
                        className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Practice / View</span>
                      </button>
                      <button
                        onClick={(e) => onDownloadPaper(paper, e)}
                        className="p-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white rounded-xl"
                        title="Download Paper"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemovePaper(paper.id)}
                      className="text-xs text-[#A7B4C8] hover:text-rose-400 p-1"
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
            <p className="text-xs text-[#A7B4C8]">
              Your dedicated project scratchpad, formula cheat sheet, and revision notes.
            </p>
            <button
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNote ? 'Cancel' : 'New Note'}</span>
            </button>
          </div>

          {isAddingNote && (
            <form onSubmit={handleSaveNote} className="p-4 sm:p-5 rounded-2xl bg-[#101B2D] border border-cyan-500/40 space-y-3.5 animate-in fade-in">
              <div className="text-xs font-bold text-white">Create New Study Note / Formula Sheet</div>
              <input
                type="text"
                placeholder="Note Title (e.g. Ray Optics Formulas)"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <textarea
                required
                rows={5}
                placeholder="Write your study notes, derivations, formulae, or key conceptual bullet points..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNote(false)}
                  className="px-3 py-1.5 text-xs text-[#A7B4C8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl"
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
                className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.12] space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {note.isPinned && <Pin className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />}
                    <h4 className="text-sm font-bold text-white">{note.title}</h4>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-[#A7B4C8] hover:text-rose-400 transition-colors"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-xs text-[#E2E8F0] whitespace-pre-wrap leading-relaxed font-sans bg-[#0A1222]/60 p-3 rounded-xl border border-white/[0.04]">
                  {note.content}
                </div>

                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {note.tags.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-[#A7B4C8]">
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
            <p className="text-xs text-[#A7B4C8]">
              Textbooks, video lectures, drive links, and external reference materials.
            </p>
            <button
              onClick={() => setIsAddingResource(!isAddingResource)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingResource ? 'Cancel' : 'Add Resource'}</span>
            </button>
          </div>

          {isAddingResource && (
            <form onSubmit={handleAddResource} className="p-4 sm:p-5 rounded-2xl bg-[#101B2D] border border-cyan-500/40 space-y-3.5 animate-in fade-in">
              <div className="text-xs font-bold text-white">Add External Study Resource</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Resource Title (e.g. NCERT Official Physics PDF)"
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none"
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
                className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
              />

              <input
                type="text"
                placeholder="Annotation / note (e.g. Chapter 9 & 10 are most important)"
                value={resNotes}
                onChange={(e) => setResNotes(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingResource(false)}
                  className="px-3 py-1.5 text-xs text-[#A7B4C8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl"
                >
                  Save Resource
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {currentProject.resources.length === 0 ? (
              <div className="p-8 text-center bg-[#101B2D]/40 border border-white/[0.08] rounded-2xl text-xs text-[#A7B4C8]">
                No external resources added yet. Add YouTube lectures, NCERT links, or Drive folders.
              </div>
            ) : (
              currentProject.resources.map((res) => (
                <div
                  key={res.id}
                  className="p-3.5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] flex items-center justify-between gap-3 hover:border-cyan-400/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] text-cyan-400 flex items-center justify-center shrink-0">
                      {res.type === 'video' ? <Video className="w-4 h-4" /> : res.type === 'book' ? <Book className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{res.title}</div>
                      {res.notes && <div className="text-[11px] text-[#A7B4C8] truncate">{res.notes}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => handleDeleteResource(res.id)}
                      className="p-1 text-[#A7B4C8] hover:text-rose-400 transition-colors"
                      title="Delete resource"
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
