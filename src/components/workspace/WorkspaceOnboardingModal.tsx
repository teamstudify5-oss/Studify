import React, { useEffect } from 'react';
import { FolderPlus, Layers, CheckCircle2, FileText, Zap, ArrowRight, X } from 'lucide-react';

interface WorkspaceOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export const WorkspaceOnboardingModal: React.FC<WorkspaceOnboardingModalProps> = ({
  isOpen,
  onClose,
  onContinue,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-onboarding-title"
        className="w-full max-w-md border border-[var(--border-divider)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)]"
        style={{ backgroundColor: 'var(--modal-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[var(--border-divider)] flex items-start justify-between gap-3 bg-[var(--surface-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-main)] border border-[var(--border-divider)] text-[var(--accent-blue)] flex items-center justify-center shrink-0">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="workspace-onboarding-title" className="font-display text-base font-bold text-[var(--text-primary)] tracking-tight">
                Create a Project Workspace First
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Quick Capture needs a project to keep your notes organized
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-mint)]">
              What is Project Workspace?
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              A Project Workspace is a dedicated hub for a subject, chapter, or upcoming exam so every note, formula, milestone, and past paper stays in one structured place.
            </p>
          </div>

          <div className="divide-y divide-[var(--border-divider)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)]">
            <div className="p-3 flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-[var(--accent-blue)] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">Organize by Subject or Exam</div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Group your CBSE, ICSE, JEE, NEET, or semester study material into focused workspaces.
                </p>
              </div>
            </div>

            <div className="p-3 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-[var(--accent-mint)] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">Quick Capture &amp; Project Notes</div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Save instant formulas, doubts, and structured study notes directly inside your project.
                </p>
              </div>
            </div>

            <div className="p-3 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-mint)] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">Track Milestones &amp; Attached PYQs</div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Check off chapter goals and attach previous year question papers for fast revision.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--accent-blue)]" />
            <span>Next step: create your first project, then jump straight into Add Notes or Quick Capture.</span>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border-divider)] bg-[var(--surface-elevated)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg bg-[var(--surface-main)] border border-[var(--border-divider)] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-4 py-2 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs font-semibold rounded-lg transition-opacity flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
