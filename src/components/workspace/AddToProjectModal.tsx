import React, { useState } from 'react';
import { FolderPlus, X, Check, BookOpen, Plus, Folder } from 'lucide-react';
import { Paper } from '../../types';
import { StudyProject } from '../../types/workspace';
import { workspaceService } from '../../services/workspaceService';

interface AddToProjectModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (projectName: string) => void;
}

export const AddToProjectModal: React.FC<AddToProjectModalProps> = ({
  paper,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [projects, setProjects] = useState<StudyProject[]>(workspaceService.getProjects());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectSubject, setNewProjectSubject] = useState(paper?.subject || 'General');

  if (!isOpen || !paper) return null;

  const handleSelectProject = (projectId: string, projectName: string) => {
    workspaceService.addPaperToProject(projectId, paper.id);
    onSuccess(projectName);
    onClose();
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    const created = workspaceService.createProject({
      title: newProjectTitle.trim(),
      subject: newProjectSubject || paper.subject,
      examBoard: paper.examBoard,
      description: `Project created for ${paper.title} and related preparation.`,
      color: 'cyan',
      paperIds: [paper.id]
    });

    onSuccess(created.title);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#0A1222] border border-white/[0.14] rounded-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Add Paper to Study Project</h3>
              <p className="text-[11px] text-[#A7B4C8] line-clamp-1">{paper.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[#A7B4C8] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!isCreatingNew ? (
            <>
              <div className="text-xs font-semibold text-[#A7B4C8] uppercase tracking-wider">
                Select from existing projects:
              </div>

              <div className="space-y-2">
                {projects.map((proj) => {
                  const alreadyAdded = proj.paperIds.includes(paper.id);
                  return (
                    <button
                      key={proj.id}
                      onClick={() => handleSelectProject(proj.id, proj.title)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all group ${
                        alreadyAdded
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                          : 'bg-[#101B2D]/80 hover:bg-[#15233D] border-white/[0.08] hover:border-cyan-400/30 text-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-cyan-400 flex items-center justify-center shrink-0">
                          <Folder className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate group-hover:text-cyan-300 transition-colors">
                            {proj.title}
                          </div>
                          <div className="text-[10px] text-[#A7B4C8]">
                            {proj.subject} · {proj.paperIds.length} attached papers
                          </div>
                        </div>
                      </div>

                      {alreadyAdded ? (
                        <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1 shrink-0 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                          <Check className="w-3 h-3" />
                          <span>Added</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[#A7B4C8] group-hover:text-cyan-300 shrink-0">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-white/[0.08]">
                <button
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Create New Project for this Paper</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="space-y-3.5">
              <div className="text-xs font-semibold text-white">Create New Study Project</div>
              <div>
                <label className="block text-[11px] text-[#A7B4C8] mb-1 font-medium">Project Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optics & Wave Theory Prep"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#A7B4C8] mb-1 font-medium">Subject</label>
                <input
                  type="text"
                  required
                  value={newProjectSubject}
                  onChange={(e) => setNewProjectSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-2 rounded-xl text-xs text-[#A7B4C8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl shadow-md hover:from-cyan-400 hover:to-teal-400 transition-all"
                >
                  Create & Attach Paper
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
