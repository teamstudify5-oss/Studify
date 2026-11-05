import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, SlidersHorizontal, FileText } from 'lucide-react';
import { Paper, FilterState } from '../types';
import { PaperCard } from '../components/PaperCard';
import { EXAM_BOARDS, GRADE_LEVELS, POPULAR_SUBJECTS, YEARS } from '../data/samplePapers';
import { AddToProjectModal } from '../components/workspace/AddToProjectModal';

interface BrowsePageProps {
  papers: Paper[];
  initialFilters?: Partial<FilterState> & { search?: string };
  onSelectPaper: (paper: Paper) => void;
  onDownloadPaper: (paper: Paper, e: React.MouseEvent) => void;
  onBookmarkPaper: (paper: Paper, e: React.MouseEvent) => void;
  savedPaperIds: string[];
}

export const BrowsePage: React.FC<BrowsePageProps> = ({
  papers,
  initialFilters,
  onSelectPaper,
  onDownloadPaper,
  onBookmarkPaper,
  savedPaperIds,
}) => {
  // Active papers are immediately visible to anyone
  const visiblePapers = useMemo(
    () => papers.filter((p) => p.status === 'active' || p.status === 'approved'),
    [papers]
  );

  const [searchQuery, setSearchQuery] = useState(initialFilters?.search || initialFilters?.searchQuery || '');
  const [selectedBoard, setSelectedBoard] = useState(initialFilters?.board || 'all');
  const [selectedGrade, setSelectedGrade] = useState(initialFilters?.grade || 'all');
  const [selectedSubject, setSelectedSubject] = useState(initialFilters?.subject || 'all');
  const [selectedYear, setSelectedYear] = useState(initialFilters?.year || 'all');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'rating' | 'yearDesc' | 'yearAsc'>('latest');
  const [selectedPaperForProject, setSelectedPaperForProject] = useState<Paper | null>(null);

  const filteredPapers = useMemo(() => {
    return visiblePapers
      .filter((paper) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = paper.title.toLowerCase().includes(q);
          const matchSubject = paper.subject.toLowerCase().includes(q);
          const matchBoard = paper.examBoard.toLowerCase().includes(q);
          const matchGrade = paper.grade.toLowerCase().includes(q);
          const matchYear = paper.year.toString().includes(q);
          const matchChapter = paper.chapter ? paper.chapter.toLowerCase().includes(q) : false;
          const matchUploader = (paper.uploaderDisplayName || paper.submittedBy?.name || '').toLowerCase().includes(q);
          if (!matchTitle && !matchSubject && !matchBoard && !matchGrade && !matchYear && !matchChapter && !matchUploader) {
            return false;
          }
        }

        if (selectedBoard !== 'all' && paper.examBoard !== selectedBoard) {
          return false;
        }

        if (selectedGrade !== 'all' && paper.grade !== selectedGrade) {
          return false;
        }

        if (selectedSubject !== 'all' && paper.subject !== selectedSubject) {
          return false;
        }

        if (selectedYear !== 'all' && paper.year.toString() !== selectedYear) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'latest') {
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
        if (sortBy === 'popular') {
          return b.downloadsCount - a.downloadsCount;
        }
        if (sortBy === 'rating') {
          return (b.rating || 0) - (a.rating || 0);
        }
        if (sortBy === 'yearDesc') {
          return b.year - a.year;
        }
        if (sortBy === 'yearAsc') {
          return a.year - b.year;
        }
        return 0;
      });
  }, [visiblePapers, searchQuery, selectedBoard, selectedGrade, selectedSubject, selectedYear, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedBoard !== 'all' ||
    selectedGrade !== 'all' ||
    selectedSubject !== 'all' ||
    selectedYear !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedBoard('all');
    setSelectedGrade('all');
    setSelectedSubject('all');
    setSelectedYear('all');
    setSortBy('latest');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header — Clean, minimal, no standalone emblem or motto banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Community PYQ Library
            </h1>
            <span className="text-[11px] font-medium text-[var(--color-green)]">
              Verified
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Search, preview, and download authentic past examination papers. Completely free.
          </p>
        </div>

        <div className="text-xs text-[var(--text-muted)] font-mono sm:text-right shrink-0">
          Open Repository
        </div>
      </div>

      {/* Modern Search Bar */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="relative flex items-center bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-1.5 shadow-xs focus-within:border-[var(--accent-blue)] focus-within:ring-1 focus-within:ring-[var(--accent-blue)]/30 transition-all"
      >
        <Search className="w-4 h-4 text-[var(--text-muted)] ml-3 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by subject, examination board, class, year, or chapter..."
          className="w-full px-3 py-2 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] bg-transparent focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2.5 py-1 mr-2 cursor-pointer transition-colors rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] btn-quad-border"
          >
            Clear
          </button>
        )}
      </form>

      {/* Filter Deck */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            <span>Filter Archive</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-[var(--accent-blue)] hover:underline font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Exam Board */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Exam Board</label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="all">All Boards</option>
              {EXAM_BOARDS.map((board) => (
                <option key={board} value={board}>{board}</option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Class / Level</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="all">All Classes</option>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="all">All Subjects</option>
              {POPULAR_SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--border-hover)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            >
              <option value="all">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>
          Showing <strong className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">{filteredPapers.length}</strong> {filteredPapers.length === 1 ? 'paper' : 'papers'}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent-blue)]"
          >
            <option value="latest">Recently Added</option>
            <option value="popular">Most Downloaded</option>
            <option value="rating">Top Rated</option>
            <option value="yearDesc">Year: Newest First</option>
            <option value="yearAsc">Year: Oldest First</option>
          </select>
        </div>
      </div>

      {/* Paper Grid */}
      {filteredPapers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              onSelect={onSelectPaper}
              onDownload={onDownloadPaper}
              onBookmark={onBookmarkPaper}
              onAddToProject={(p) => setSelectedPaperForProject(p)}
              isBookmarked={savedPaperIds.includes(paper.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">No question papers found</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            Try adjusting your search query or reset the filters to discover available papers.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-1.5 bg-[var(--accent-blue)] text-white font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer btn-quad-border"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}

      {/* Add To Project Modal */}
      {selectedPaperForProject && (
        <AddToProjectModal
          isOpen={true}
          onClose={() => setSelectedPaperForProject(null)}
          paper={selectedPaperForProject}
          onSuccess={() => setSelectedPaperForProject(null)}
        />
      )}
    </div>
  );
};
