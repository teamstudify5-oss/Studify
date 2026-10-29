import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  BookOpen, 
  Folder, 
  FileText, 
  Sparkles, 
  Bookmark, 
  UploadCloud, 
  ArrowRight, 
  X, 
  Command, 
  Zap,
  CheckCircle2,
  Clock
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
  onOpenQuickCapture
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const projects: StudyProject[] = workspaceService.getProjects();
  const captures: QuickCaptureItem[] = workspaceService.getQuickCaptures();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via parent
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

  // Filtered results
  const matchingPapers = papers
    .filter(
      (p) =>
        p.title.toLowerCase().includes(normalizedQuery) ||
        p.subject.toLowerCase().includes(normalizedQuery) ||
        p.examBoard.toLowerCase().includes(normalizedQuery) ||
        String(p.year).includes(normalizedQuery)
    )
    .slice(0, 4);

  const matchingProjects = projects
    .filter(
      (proj) =>
        proj.title.toLowerCase().includes(normalizedQuery) ||
        proj.subject.toLowerCase().includes(normalizedQuery) ||
        proj.description.toLowerCase().includes(normalizedQuery)
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

  // Quick navigation shortcuts
  const navigationActions = [
    { id: 'nav-workspace', title: 'Open Study Workspace & Projects', subtitle: 'Personal desktop, notes & tasks', icon: Folder, action: () => { onNavigate('workspace'); onClose(); } },
    { id: 'nav-predictor', title: 'Exam Paper Predictor', subtitle: 'Rule-based pattern analysis & mock tests', icon: Sparkles, action: () => { onNavigate('exam-predictor'); onClose(); } },
    { id: 'nav-quick-capture', title: 'Quick Capture Thought / Formula', subtitle: 'Instant scratchpad capture', icon: Zap, action: () => { onClose(); onOpenQuickCapture(); } },
    { id: 'nav-browse', title: 'Explore All Past Question Papers', subtitle: 'Search CBSE, ICSE, JEE, NEET', icon: Search, action: () => { onNavigate('browse'); onClose(); } },
    { id: 'nav-bookmarks', title: 'View Saved Bookmarks', subtitle: 'Your starred papers', icon: Bookmark, action: () => { onNavigate('profile-bookmarks'); onClose(); } },
  ].filter((a) => !normalizedQuery || a.title.toLowerCase().includes(normalizedQuery) || a.subtitle.toLowerCase().includes(normalizedQuery));

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0A1222] border border-white/[0.16] rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-white/[0.1] flex items-center gap-3 bg-[#0d1627]">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a paper name, subject, study project, or quick command..."
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-white/40 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[#A7B4C8] hover:text-white hover:bg-white/[0.08]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-white/[0.06] text-[#A7B4C8] px-2 py-1 rounded-md border border-white/[0.1]">
            <Command className="w-3 h-3" /> K
          </span>
        </div>

        {/* Content Body */}
        <div className="max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-4 divide-y divide-white/[0.06]">
          {/* Projects Results */}
          {matchingProjects.length > 0 && (
            <div className="space-y-1.5 pt-2 first:pt-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold px-2">
                Study Workspace Projects
              </div>
              {matchingProjects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => {
                    onOpenProject(proj.id);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shrink-0">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white group-hover:text-cyan-300 truncate">
                        {proj.title}
                      </div>
                      <div className="text-[11px] text-[#A7B4C8] truncate">
                        {proj.subject} · {proj.paperIds.length} attached papers · {proj.tasks.filter((t) => t.completed).length}/{proj.tasks.length} tasks
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Past Papers Results */}
          {matchingPapers.length > 0 && (
            <div className="space-y-1.5 pt-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-semibold px-2">
                Previous Year Papers (Studify Library)
              </div>
              {matchingPapers.map((paper) => (
                <button
                  key={paper.id}
                  onClick={() => {
                    onSelectPaper(paper);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-400/30 text-teal-300 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white group-hover:text-cyan-300 truncate">
                        {paper.title}
                      </div>
                      <div className="text-[11px] text-[#A7B4C8]">
                        {paper.examBoard} · {paper.grade} · {paper.year} · {paper.totalMarks} Marks
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-cyan-400 font-medium group-hover:underline shrink-0">
                    View Paper →
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Captures */}
          {matchingCaptures.length > 0 && (
            <div className="space-y-1.5 pt-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold px-2">
                Quick Captures & Scratchpad
              </div>
              {matchingCaptures.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onNavigate('workspace');
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer text-xs space-y-1 transition-colors"
                >
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span className="text-amber-300">{item.title || 'Quick Note'}</span>
                    <span className="text-[10px] text-[#A7B4C8]">{item.type}</span>
                  </div>
                  <p className="text-[11px] text-[#A7B4C8] line-clamp-1">{item.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Navigation & Commands */}
          <div className="space-y-1.5 pt-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#A7B4C8] font-semibold px-2">
              Instant Actions & Navigation
            </div>
            {navigationActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/[0.06] flex items-center justify-between group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-cyan-300 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white group-hover:text-cyan-300 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#A7B4C8] truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer tip */}
        <div className="p-3 border-t border-white/[0.08] bg-[#070D18] flex items-center justify-between text-[11px] text-[#A7B4C8]">
          <span>Navigate with arrows, press <kbd className="font-mono bg-white/[0.08] px-1.5 py-0.5 rounded text-white text-[10px]">ESC</kbd> to close</span>
          <span className="text-cyan-400 font-medium">Studify Student Command Center</span>
        </div>
      </div>
    </div>
  );
};
