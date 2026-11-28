import React from 'react';
import { Download, Bookmark, Star, ArrowUpRight, FolderPlus, Edit2, Trash2 } from 'lucide-react';
import { Paper } from '../types';

interface PaperCardProps {
  paper: Paper;
  onSelect: (paper: Paper) => void;
  onDownload?: (paper: Paper, e: React.MouseEvent) => void;
  onBookmark?: (paper: Paper, e: React.MouseEvent) => void;
  onAddToProject?: (paper: Paper, e: React.MouseEvent) => void;
  onEdit?: (paper: Paper, e: React.MouseEvent) => void;
  onDelete?: (paper: Paper, e: React.MouseEvent) => void;
  canManage?: boolean;
  isBookmarked?: boolean;
  isDownloading?: boolean;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  onSelect,
  onDownload,
  onBookmark,
  onAddToProject,
  onEdit,
  onDelete,
  canManage = false,
  isBookmarked = false,
  isDownloading = false,
}) => {
  const formatLabel = paper.isImageBased
    ? `${paper.pageCount || paper.imageUrls?.length || 1} Pages`
    : 'PDF';

  return (
    <div
      onClick={() => onSelect(paper)}
      className="group relative bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)]/40 border border-[var(--border-divider)] hover:border-[var(--border-hover)] rounded-xl p-5 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between"
    >
      <div className="space-y-2.5">
        {/* Clean Zero-Pill Metadata Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">{paper.examBoard}</span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
            <span>{paper.grade}</span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">{paper.year}</span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--accent-mint)] font-medium">
              {formatLabel}
            </span>
          </div>

          {onBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBookmark(paper, e);
              }}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                isBookmarked
                  ? 'bg-[var(--accent-blue-bg)] text-[var(--text-primary)] border-[var(--border-hover)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
              }`}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark paper'}
              aria-label="Bookmark"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-cobalt)] transition-colors leading-snug line-clamp-2">
          {paper.title}
        </h3>

        {/* Chapter & Attribution */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <span>{paper.subject}</span>
          {paper.chapter && (
            <>
              <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
              <span className="text-[var(--accent-mint)] font-medium">{paper.chapter}</span>
            </>
          )}
          <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
          <span>
            By <strong className="font-medium text-[var(--text-primary)]">{paper.uploaderDisplayName || paper.submittedBy?.name || 'Community'}</strong>
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          {paper.description || `${paper.subject} previous year question paper.`}
        </p>
      </div>

      {/* Footer Info & Clean Actions */}
      <div className="pt-3.5 mt-4 border-t border-[var(--border-divider)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs tabular-nums">
          {paper.ratingCount && paper.ratingCount > 0 && paper.rating ? (
            <div className="flex items-center gap-1 text-[var(--color-yellow)] font-medium font-mono text-[11px]">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{Number(paper.rating).toFixed(1)}</span>
              <span className="text-[var(--text-muted)] text-[10px]">({paper.ratingCount})</span>
            </div>
          ) : (
            <span className="text-[var(--text-muted)] text-[11px]">Unrated</span>
          )}

          {paper.totalMarks && paper.totalMarks > 0 && (
            <>
              <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                {paper.totalMarks} Marks
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canManage && onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(paper, e);
              }}
              className="p-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Edit paper metadata"
              aria-label={`Edit ${paper.title}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {canManage && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(paper, e);
              }}
              className="p-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--accent-red-bg)] border border-[var(--border-divider)] text-[var(--color-red)] transition-colors cursor-pointer"
              title="Delete paper permanently"
              aria-label={`Delete ${paper.title}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onAddToProject && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToProject(paper, e);
              }}
              className="p-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Add to Study Project"
              aria-label="Add to Study Project"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              disabled={isDownloading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDownload(paper, e);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs font-medium text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              title={
                paper.isImageBased
                  ? (paper.imagePaths?.length || paper.imageUrls?.length || 1) > 1
                    ? 'Download Photos (.zip)'
                    : 'Download Photo'
                  : 'Download PDF'
              }
              aria-label="Download paper"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">{isDownloading ? 'Saving...' : 'Download'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(paper);
            }}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white dark:text-[#0A2640] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>Open</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
