import React from 'react';
import { Download, Bookmark, Star, ArrowUpRight, FolderPlus } from 'lucide-react';
import { Paper } from '../types';

interface PaperCardProps {
  paper: Paper;
  onSelect: (paper: Paper) => void;
  onDownload?: (paper: Paper, e: React.MouseEvent) => void;
  onBookmark?: (paper: Paper, e: React.MouseEvent) => void;
  onAddToProject?: (paper: Paper, e: React.MouseEvent) => void;
  isBookmarked?: boolean;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  onSelect,
  onDownload,
  onBookmark,
  onAddToProject,
  isBookmarked = false,
}) => {
  return (
    <div
      onClick={() => onSelect(paper)}
      className="group relative bg-[var(--surface-main)]/85 backdrop-blur-md hover:bg-[var(--surface-elevated)]/90 border border-[var(--border-divider)] hover:border-[var(--border-hover)] rounded-xl p-4 sm:p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md"
    >
      <div className="space-y-2.5 relative z-10">
        {/* Header Tags & Bookmark - Clean zero-pill metadata */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--accent-blue)]">{paper.examBoard}</span>
            <span aria-hidden="true" className="text-[var(--text-muted)] opacity-60">·</span>
            <span>{paper.grade}</span>
            <span aria-hidden="true" className="text-[var(--text-muted)] opacity-60">·</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">{paper.year}</span>
          </div>

          {onBookmark && (
            <button
              type="button"
              onClick={(e) => onBookmark(paper, e)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer btn-quad-border ${
                isBookmarked
                  ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
              }`}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark paper'}
              aria-label="Bookmark"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors leading-snug line-clamp-2">
          {paper.title}
        </h3>

        {/* Chapter & Uploader Attribution */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          {paper.chapter && (
            <>
              <span className="text-[var(--color-green)] font-medium">
                {paper.chapter}
              </span>
              <span aria-hidden="true" className="text-[var(--text-muted)] opacity-60">·</span>
            </>
          )}
          <span>
            Uploaded by <strong className="font-medium text-[var(--text-primary)]">{paper.uploaderDisplayName || paper.submittedBy?.name || 'Community'}</strong>
          </span>
        </div>

        {/* Subject & Description */}
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          {paper.description || `${paper.subject} previous year question paper with marking scheme.`}
        </p>
      </div>

      {/* Footer Info & Compact Purposeful Actions */}
      <div className="pt-3.5 mt-3.5 border-t border-[var(--border-divider)] flex items-center justify-between gap-2 relative z-10">
        {/* Rating & marks */}
        <div className="flex items-center gap-2 text-xs">
          {paper.ratingCount && paper.ratingCount > 0 && paper.rating ? (
            <div className="flex items-center gap-1 text-[var(--color-yellow)] font-medium font-mono text-[11px]">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{Number(paper.rating).toFixed(1)}</span>
              <span className="text-[var(--text-muted)] text-[10px]">({paper.ratingCount})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[var(--text-muted)] text-[11px]">
              <Star className="w-3 h-3 opacity-60" />
              <span>Not rated yet</span>
            </div>
          )}

          <span aria-hidden="true" className="text-[var(--text-muted)] opacity-50">·</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {paper.totalMarks}M
          </span>
        </div>

        {/* Compact Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onAddToProject && (
            <button
              type="button"
              onClick={(e) => onAddToProject(paper, e)}
              className="p-1.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors cursor-pointer btn-quad-border"
              title="Add to Study Project"
              aria-label="Add to Study Project"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              onClick={(e) => onDownload(paper, e)}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer btn-quad-border"
              title="Download PDF"
              aria-label="Download paper"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelect(paper)}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1 shadow-xs cursor-pointer btn-quad-border"
          >
            <span>View</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
