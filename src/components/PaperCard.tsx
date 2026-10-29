import React from 'react';
import { Download, Bookmark, Star, ArrowUpRight, FileText, FolderPlus } from 'lucide-react';
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
      className="group relative bg-[#101B2D]/80 hover:bg-[#15233D]/90 backdrop-blur-md border border-white/[0.12] hover:border-cyan-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/30 flex flex-col justify-between overflow-hidden"
    >
      {/* Subtle Corner Accent Diffuse Lighting */}
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-cyan-500/10 group-hover:bg-cyan-500/20 blur-2xl transition-all pointer-events-none"
        aria-hidden="true"
      />

      <div className="space-y-3 relative z-10">
        {/* Header Tags & Bookmark */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#A7B4C8]">
            <span className="font-semibold text-cyan-400">{paper.examBoard}</span>
            <span aria-hidden="true" className="text-white/20">·</span>
            <span>{paper.grade}</span>
            <span aria-hidden="true" className="text-white/20">·</span>
            <span className="font-mono text-[11px] text-white/70">{paper.year}</span>
          </div>

          {onBookmark && (
            <button
              type="button"
              onClick={(e) => onBookmark(paper, e)}
              className={`p-2 rounded-xl transition-all ${
                isBookmarked
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-[#A7B4C8] hover:text-white hover:bg-white/[0.08]'
              }`}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark paper'}
              aria-label="Bookmark"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-cyan-400' : ''}`} />
            </button>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-[#F8FAFC] group-hover:text-cyan-200 transition-colors leading-snug line-clamp-2">
          {paper.title}
        </h3>

        {/* Subject & Description */}
        <p className="text-xs text-[#A7B4C8] line-clamp-2 leading-relaxed">
          {paper.description || `${paper.subject} previous year question paper with marking scheme.`}
        </p>
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center justify-between gap-2 relative z-10">
        {/* Rating & marks */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-amber-300 font-medium font-mono text-[11px]">
            <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            <span>{paper.rating || '4.8'}</span>
            <span className="text-[#A7B4C8] text-[10px]">({paper.ratingCount || 12})</span>
          </div>

          <span aria-hidden="true" className="text-white/20">·</span>
          <span className="text-xs text-[#A7B4C8] font-mono">
            {paper.totalMarks}M
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onAddToProject && (
            <button
              type="button"
              onClick={(e) => onAddToProject(paper, e)}
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-white/[0.06] hover:bg-cyan-500/15 border border-white/[0.1] hover:border-cyan-400/30 text-xs font-medium text-[#F8FAFC] hover:text-cyan-300 transition-all flex items-center gap-1"
              title="Add to Study Project"
              aria-label="Add to Study Project"
            >
              <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              onClick={(e) => onDownload(paper, e)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/[0.06] hover:bg-cyan-500/15 border border-white/[0.1] hover:border-cyan-400/30 text-xs font-medium text-[#F8FAFC] hover:text-cyan-300 transition-all flex items-center gap-1.5"
              title="Download PDF"
              aria-label="Download paper"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelect(paper)}
            className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold transition-all flex items-center gap-1 shadow-sm shadow-cyan-500/20"
          >
            <span>View</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
