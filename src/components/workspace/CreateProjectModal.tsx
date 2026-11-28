import React, { useState, useEffect } from 'react';
import { FolderPlus, Plus, X, Loader2, AlertCircle, FileText, Zap } from 'lucide-react';
import { StudyProject } from '../../types/workspace';
import { workspaceService } from '../../services/workspaceService';

export type PostCreateAction = 'open' | 'notes' | 'capture';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: StudyProject, nextAction: PostCreateAction) => void;
  fromQuickCaptureGate?: boolean;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  fromQuickCaptureGate = false,
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [board, setBoard] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [nextStep, setNextStep] = useState<'notes' | 'capture'>('notes');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCreateError(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCreating, onClose]);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setSubject('');
    setBoard('');
    setTargetExam('');
    setTargetDate('');
    setDescription('');
    setShowOptionalDetails(false);
    setCreateError(null);
  };

  const handleClose = () => {
    if (isCreating) return;
    setCreateError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || isCreating) return;

    setIsCreating(true);
    setCreateError(null);

    const { project: created, error } = await workspaceService.createProjectAsync({
      title: cleanTitle,
      description: description.trim() || undefined,
      subject: subject.trim() || undefined,
      examBoard: board || undefined,
      targetExam: targetExam.trim() || undefined,
      targetDate: targetDate || undefined,
      color: 'cyan',
    });

    setIsCreating(false);

    if (error || !created) {
      setCreateError(
        error?.message || 'Could not create study project. Please try again.'
      );
      return;
    }

    resetForm();
    onCreated(created, fromQuickCaptureGate ? nextStep : 'open');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-xs animate-in fade-in"
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-modal-title"
        className="w-full max-w-lg bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-xl shadow-xl p-5 sm:p-6 space-y-4 text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
            <div>
              <h3 id="create-project-modal-title" className="text-base font-semibold text-[var(--text-primary)]">
                Create New Project
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {fromQuickCaptureGate
                  ? 'Set up your workspace first, then add notes or quick captures.'
                  : 'General-purpose workspace. Only project name is required.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isCreating}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer p-1 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1 font-medium">
              Project Name <span className="text-[var(--accent-blue)]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              disabled={isCreating}
              placeholder="e.g. Modern Physics Notes, Research Hub, Q1 Exam Prep"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
          </div>

          {/* Collapsible / Optional details toggle */}
          <div className="border border-[var(--border-divider)] rounded-lg bg-[var(--surface-main)] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOptionalDetails(!showOptionalDetails)}
              className="w-full p-2.5 text-left flex items-center justify-between hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
            >
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {showOptionalDetails
                  ? '− Optional Details (Subject, Board, Target Date)'
                  : '+ Optional Details (Subject, Board, Target Date)'}
              </span>
              <span className="text-[11px] text-[var(--accent-blue)] font-medium">
                {showOptionalDetails ? 'Hide' : 'Add Details'}
              </span>
            </button>

            {showOptionalDetails && (
              <div className="p-3 pt-0 space-y-3 border-t border-[var(--border-divider)]">
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                      Subject (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Science, Math"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                      Board / Exam (Optional)
                    </label>
                    <select
                      value={board}
                      onChange={(e) => setBoard(e.target.value)}
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
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                      Specific Goal (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Midterms / Entrance"
                      value={targetExam}
                      onChange={(e) => setTargetExam(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                      Target Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="What is your focus for this project? (Optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {fromQuickCaptureGate && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">
                Open immediately after creating:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNextStep('notes')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    nextStep === 'notes'
                      ? 'bg-[var(--accent-blue-bg)] border-[var(--accent-blue)]/40 text-[var(--accent-blue)]'
                      : 'bg-[var(--surface-main)] border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Add Notes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNextStep('capture')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    nextStep === 'capture'
                      ? 'bg-[var(--accent-yellow-bg)] border-[var(--color-yellow)]/40 text-[var(--color-yellow)]'
                      : 'bg-[var(--surface-main)] border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Quick Capture</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="px-3.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim()}
              className="px-4 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {fromQuickCaptureGate
                      ? nextStep === 'notes'
                        ? 'Create Project & Add Notes'
                        : 'Create Project & Quick Capture'
                      : 'Create Project'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
