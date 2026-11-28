import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Folder,
  FileText,
  Bookmark,
  ArrowRight,
  X,
  Command,
  Zap,
} from 'lucide-react';
import { Paper } from '../../types';
import { StudyProject, QuickCaptureItem } from '../../types/workspace';
import { workspaceService } from '../../services/workspaceService';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  papers: Paper[];
  onNavigate: (tab: string) => void;
  onSelectPaper: (paper: Paper) => void;
  onOpenProject: (projectId: string) => void;
  onOpenQuickCapture: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  isOpen,
  onClose,
  papers,
  onNavigate,
  onSelectPaper,
  onOpenProject,
  onOpenQuickCapture,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const projects: StudyProject[] = workspaceService.getProjects();
  const captures: QuickCaptureItem[] = workspaceService.getQuickCaptures();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();

  const matchingPapers = papers
    .filter(
      (p) =>
        (p.status === 'active' || p.status === 'approved') &&
        (p.title.toLowerCase().includes(normalizedQuery) ||
          p.subject.toLowerCase().includes(normalizedQuery) ||
          p.examBoard.toLowerCase().includes(normalizedQuery) ||
          String(p.year).includes(normalizedQuery))
    )
    .slice(0, 4);

  const matchingProjects = projects
    .filter(
      (proj) =>
        proj.title.toLowerCase().includes(normalizedQuery) ||
        (proj.subject && proj.subject.toLowerCase().includes(normalizedQuery)) ||
        (proj.description && proj.description.toLowerCase().includes(normalizedQuery))
    )
    .slice(0, 3);

  const matchingCaptures = captures
    .filter(
      (c) =>
        c.content.toLowerCase().includes(normalizedQuery) ||
        (c.title && c.title.toLowerCase().includes(normalizedQuery)) ||
        c.tags.some((t) => t.toLowerCase().includes(normalizedQuery))
    )
    .slice(0, 2);

  const navigationActions = [
    {
      id: 'nav-workspace',
      title: 'Open Study Workspace & Projects',
      subtitle: 'Schedules, notes & linked papers',
      icon: Folder,
      action: () => {
        onNavigate('workspace');
        onClose();
      },
    },
    {
      id: 'nav-quick-capture',
      title: 'Quick Capture Thought / Formula',
      subtitle: 'Instant project scratchpad capture',
      icon: Zap,
      action: () => {
        onClose();
        onOpenQuickCapture();
      },
    },
    {
      id: 'nav-browse',
      title: 'Explore All Past Question Papers',
      subtitle: 'Search CBSE, ICSE, JEE, NEET',
      icon: Search,
      action: () => {
        onNavigate('browse');
        onClose();
      },
    },
    {
      id: 'nav-bookmarks',
      title: 'View Saved Bookmarks',
      subtitle: 'Your starred papers',
      icon: Bookmark,
      action: () => {
        onNavigate('profile-bookmarks');
        onClose();
      },
    },
  ].filter(
    (a) =>
      !normalizedQuery ||
      a.title.toLowerCase().includes(normalizedQuery) ||
      a.subtitle.toLowerCase().includes(normalizedQuery)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command search palette"
        className="w-full max-w-2xl border border-[var(--border-divider)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)]"
        style={{ backgroundColor: 'var(--modal-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-[var(--border-divider)] flex items-center gap-3 bg-[var(--surface-elevated)]">
          <Search className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a paper, subject, study project, or command..."
            className="w-full bg-transparent text-sm sm:text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono bg-[var(--surface-main)] text-[var(--text-secondary)] px-2 py-1 rounded-md border border-[var(--border-divider)]">
            <Command className="w-3 h-3" /> K
          </span>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-4 divide-y divide-[var(--border-divider)]">
          {matchingProjects.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-mint)] px-2">
                Study Projects
              </div>
              {matchingProjects.map((proj) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => {
                    onOpenProject(proj.id);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--surface-elevated)] flex items-center justify-between group transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--accent-blue)] flex items-center justify-center shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {proj.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate tabular-nums">
                        {proj.subject ? `${proj.subject} · ` : ''}
                        {proj.paperIds.filter((id) => papers.some((p) => p.id === id)).length} papers ·{' '}
                        {proj.tasks.filter((t) => t.completed).length}/{proj.tasks.length} tasks
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-blue)] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}

          {matchingPapers.length > 0 && (
            <div className="space-y-1.5 pt-3 first:pt-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-blue)] px-2">
                Past Question Papers
              </div>
              {matchingPapers.map((paper) => (
                <button
                  key={paper.id}
                  type="button"
                  onClick={() => {
                    onSelectPaper(paper);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--surface-elevated)] flex items-center justify-between group transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--accent-mint)] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {paper.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                        {paper.examBoard} · {paper.grade} · {paper.year} · {paper.totalMarks} Marks
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-[var(--accent-blue)] font-semibold group-hover:underline shrink-0">
                    Open →
                  </span>
                </button>
              ))}
            </div>
          )}

          {matchingCaptures.length > 0 && (
            <div className="space-y-1.5 pt-3 first:pt-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-2">
                Quick Captures
              </div>
              {matchingCaptures.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    onNavigate('workspace');
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--surface-elevated)] cursor-pointer text-xs space-y-0.5 transition-colors"
                >
                  <div className="font-semibold text-[var(--text-primary)] flex items-center justify-between">
                    <span>{item.title || 'Quick Note'}</span>
                    <span className="text-[11px] text-[var(--accent-mint)] uppercase">{item.type}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">{item.content}</p>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5 pt-3 first:pt-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-2">
              Quick Actions
            </div>
            {navigationActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[var(--surface-elevated)] flex items-center justify-between group transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--accent-blue)] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-blue)] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--border-divider)] bg-[var(--surface-elevated)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <span>
            Press <kbd className="font-mono bg-[var(--surface-main)] border border-[var(--border-divider)] px-1.5 py-0.5 rounded text-[var(--text-primary)] text-[10px]">ESC</kbd> to close
          </span>
          <span className="font-semibold text-[var(--text-primary)]">Studify Command Search</span>
        </div>
      </div>
    </div>
  );
};
