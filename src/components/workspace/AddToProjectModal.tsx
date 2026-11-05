import React, { useState, useEffect, useRef } from 'react';
import { FolderPlus, X, Check, BookOpen, Plus, Folder, Loader2 } from 'lucide-react';
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
  const [newProjectSubject, setNewProjectSubject] = useState(paper?.subject || '');
  const [isCreating, setIsCreating] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Manage accessibility focus & escape key (Bug 18)
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      setProjects(workspaceService.getProjects());
      const timer = setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'Tab') {
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen, onClose]);

  if (!isOpen || !paper) return null;

  const handleSelectProject = (projectId: string, projectName: string) => {
    workspaceService.addPaperToProject(projectId, paper.id);
    onSuccess(projectName);
    onClose();
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    setIsCreating(true);
    try {
      const { project: created, error } = await workspaceService.createProjectAsync({
        title: newProjectTitle.trim(),
        subject: newProjectSubject.trim() || undefined,
        examBoard: paper.examBoard || undefined,
        description: `Project for ${paper.title}`,
        color: 'cyan',
        paperIds: [paper.id],
      });

      setIsCreating(false);
      if (created) {
        onSuccess(created.title);
        onClose();
      }
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-project-title"
        className="w-full max-w-md bg-[var(--surface-main)]/95 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl shadow-xl overflow-hidden flex flex-col text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-divider)] bg-[var(--surface-elevated)]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 id="add-to-project-title" className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                Add to Study Project
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] truncate max-w-xs">{paper.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] flex items-center justify-center transition-colors cursor-pointer btn-quad-border"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {!isCreatingNew ? (
            <>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Select from existing projects:
              </div>

              <div className="space-y-2">
                {projects.map((proj) => {
                  const alreadyAdded = proj.paperIds.includes(paper.id);
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => handleSelectProject(proj.id, proj.title)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all group cursor-pointer btn-quad-border ${
                        alreadyAdded
                          ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/40 text-[var(--text-primary)]'
                          : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border-[var(--border-divider)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[var(--surface-main)] text-[var(--accent-blue)] flex items-center justify-center shrink-0">
                          <Folder className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate group-hover:text-[var(--accent-blue)] transition-colors">
                            {proj.title}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            {proj.subject ? `${proj.subject} · ` : ''}{proj.paperIds.length} attached papers
                          </div>
                        </div>
                      </div>

                      {alreadyAdded ? (
                        <span className="text-[10px] font-bold text-[var(--color-green)] flex items-center gap-1 shrink-0 bg-[var(--accent-green-bg)] px-2 py-0.5 rounded-full border border-[var(--color-green)]/30">
                          <Check className="w-3 h-3" />
                          <span>Added</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)] shrink-0">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[var(--border-divider)]">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-2 transition-all cursor-pointer btn-quad-border"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                  <span>Create New Project for this Paper</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="space-y-3.5">
              <div className="text-xs font-semibold text-[var(--text-primary)]">Create New Project</div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">Project Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optics & Wave Theory Prep"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">Subject (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Physics (Optional)"
                  value={newProjectSubject}
                  onChange={(e) => setNewProjectSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  disabled={isCreating}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] border border-[var(--border-divider)] cursor-pointer btn-quad-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 btn-quad-border"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create & Attach Paper</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
