import React, { useState, useEffect, useRef } from 'react';
import { Zap, X, Check, Folder, Tag, Sparkles, BookOpen, HelpCircle, Loader2 } from 'lucide-react';
import { QuickCaptureType, StudyProject } from '../../types/workspace';
import { workspaceService } from '../../services/workspaceService';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (itemTitle: string) => void;
  defaultProjectId?: string;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  defaultProjectId,
}) => {
  const [type, setType] = useState<QuickCaptureType>('thought');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Manage accessibility focus & escape key (Bug 18)
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const textarea = modalRef.current?.querySelector<HTMLTextAreaElement>('textarea');
        textarea?.focus();
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
    } else if (triggerElementRef.current) {
      triggerElementRef.current.focus();
    }
  }, [isOpen, onClose]);

  const projects: StudyProject[] = workspaceService.getProjects();

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Priority 5 & Bug 16: Await actual persistence before confirming success
      await workspaceService.addQuickCaptureAsync({
        title: title.trim() || undefined,
        content: content.trim(),
        type,
        projectId: selectedProjectId || undefined,
        tags,
      });

      const savedTitle = title.trim() || 'Quick note';
      setTitle('');
      setContent('');
      setTags([]);
      setIsSaving(false);
      onSaved(savedTitle);
      onClose();
    } catch (err: any) {
      console.error('Quick capture failed to save', err);
      setIsSaving(false);
      setSaveError(err?.message || 'Could not save note to workspace. Please try again.');
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
        aria-labelledby="quick-capture-title"
        className="w-full max-w-lg bg-[var(--surface-main)]/95 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-divider)] bg-[var(--surface-elevated)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-yellow)]/15 text-[var(--accent-yellow)] border border-[var(--accent-yellow)]/30 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 id="quick-capture-title" className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                Quick Capture
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Record notes, formulas, or exam reminders instantly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] flex items-center justify-center transition-colors cursor-pointer btn-quad-border"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {saveError && (
            <div className="p-2.5 bg-[var(--accent-red)]/15 border border-[var(--accent-red)]/30 rounded-xl text-xs text-[var(--accent-red)]">
              {saveError}
            </div>
          )}

          {/* Capture Type Selector */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'thought' as const, label: 'Thought', icon: Sparkles },
              { id: 'formula' as const, label: 'Formula', icon: BookOpen },
              { id: 'doubt' as const, label: 'Doubt', icon: HelpCircle },
              { id: 'resource' as const, label: 'Link', icon: Tag },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = type === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setType(item.id)}
                  className={`btn-quad-border py-2 px-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/40 shadow-xs'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content / Body - Primary Field */}
          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
              Note Content *
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note, key formula, exam reminder, or paste a link..."
              className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] resize-none"
            />
          </div>

          {/* Title (Optional) */}
          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
              Title or Headline <span className="text-[10px] text-[var(--text-secondary)]/70">(Optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lens Maker Formula sign convention"
              className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {/* Project & Tag row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                Assign to Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                <option value="">(Inbox / General Notes)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}{p.subject ? ` (${p.subject})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                Add Tag
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g. Optics, High-Yield"
                  className="flex-1 px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="btn-quad-border px-3 py-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-xs font-semibold text-[var(--text-primary)] rounded-lg cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Rendered Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--accent-blue)] text-[10px]"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-[var(--text-primary)] cursor-pointer ml-1"
                    aria-label={`Remove tag ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">
              Persists securely to your workspace
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="btn-quad-border px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !content.trim()}
                className="btn-quad-border px-5 py-2 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
