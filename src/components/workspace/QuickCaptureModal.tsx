import React, { useState } from 'react';
import { Zap, X, Check, Folder, Tag, Sparkles, BookOpen, HelpCircle } from 'lucide-react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    workspaceService.addQuickCapture({
      title: title.trim() || undefined,
      content: content.trim(),
      type,
      projectId: selectedProjectId || undefined,
      tags
    });

    onSaved(title || 'Quick thought');
    onClose();
    setTitle('');
    setContent('');
    setTags([]);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0A1222] border border-white/[0.16] rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Quick Capture</h3>
              <p className="text-[11px] text-[#A7B4C8]">Record thoughts, formulas, doubts & resources instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[#A7B4C8] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
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
                  className={`py-2 px-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                      : 'bg-white/[0.04] text-[#A7B4C8] hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Title (Optional) */}
          <div>
            <label className="block text-[11px] text-[#A7B4C8] mb-1 font-medium">Title or Headline (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lens Maker Formula sign convention"
              className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Content / Body */}
          <div>
            <label className="block text-[11px] text-[#A7B4C8] mb-1 font-medium">Notes, Formula details, or Resource URL *</label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your study note, key derivation step, exam reminder, or paste a link..."
              className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 resize-none font-sans"
            />
          </div>

          {/* Assign to Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#A7B4C8] mb-1 font-medium">Assign to Study Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">(Inbox / General Scratchpad)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.subject})
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[11px] text-[#A7B4C8] mb-1 font-medium">Add Tag</label>
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
                  className="flex-1 px-3 py-2 bg-[#101B2D] border border-white/[0.14] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white rounded-xl"
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
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[10px]"
                >
                  #{t}
                  <button type="button" onClick={() => handleRemoveTag(t)} className="hover:text-white">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
            <span className="text-[10px] text-[#A7B4C8]">Saved locally & synced to your personal workspace</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs text-[#A7B4C8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to Workspace</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
