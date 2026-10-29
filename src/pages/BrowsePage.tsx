import React, { useState, useMemo } from 'react';
import { Search, RotateCcw, SlidersHorizontal, FileText, CheckCircle2 } from 'lucide-react';
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
  const approvedPapers = useMemo(() => papers.filter((p) => p.status === 'approved'), [papers]);

  const [searchQuery, setSearchQuery] = useState(initialFilters?.search || initialFilters?.searchQuery || '');
  const [selectedBoard, setSelectedBoard] = useState(initialFilters?.board || 'all');
  const [selectedGrade, setSelectedGrade] = useState(initialFilters?.grade || 'all');
  const [selectedSubject, setSelectedSubject] = useState(initialFilters?.subject || 'all');
  const [selectedYear, setSelectedYear] = useState(initialFilters?.year || 'all');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'rating' | 'yearDesc' | 'yearAsc'>('latest');
  const [selectedPaperForProject, setSelectedPaperForProject] = useState<Paper | null>(null);
  const [projectToast, setProjectToast] = useState<string | null>(null);

  const filteredPapers = useMemo(() => {
    return approvedPapers
      .filter((paper) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = paper.title.toLowerCase().includes(q);
          const matchSubject = paper.subject.toLowerCase().includes(q);
          const matchBoard = paper.examBoard.toLowerCase().includes(q);
          const matchGrade = paper.grade.toLowerCase().includes(q);
          const matchYear = paper.year.toString().includes(q);
          const matchChapter = paper.chapter ? paper.chapter.toLowerCase().includes(q) : false;
          if (!matchTitle && !matchSubject && !matchBoard && !matchGrade && !matchYear && !matchChapter) {
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
  }, [approvedPapers, searchQuery, selectedBoard, selectedGrade, selectedSubject, selectedYear, sortBy]);

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Search Header */}
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
          Find Your Next Question Paper
        </h1>
        <p className="text-xs sm:text-sm text-[#A7B4C8]">
          Search past papers and discover resources for your preparation.
        </p>
      </div>

      {/* Prominent Search Bar */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="relative flex items-center bg-[#101B2D]/85 backdrop-blur-xl border border-white/[0.14] rounded-2xl p-2 sm:p-2.5 shadow-2xl shadow-cyan-950/20 focus-within:border-cyan-400/50 transition-all"
      >
        <Search className="w-5 h-5 text-cyan-400 ml-3 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by subject, exam, class, year, or keyword..."
          className="w-full px-3 py-2 text-sm text-[#F8FAFC] placeholder-[#A7B4C8]/60 bg-transparent focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs text-[#A7B4C8] hover:text-white px-2 py-1 mr-2"
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 shrink-0"
        >
          Search
        </button>
      </form>

      {/* Visually Consistent Filter Deck */}
      <div className="bg-[#101B2D]/80 backdrop-blur-md border border-white/[0.12] rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-mono uppercase text-[#A7B4C8] mb-1.5 font-medium">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full p-2.5 bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400 text-xs"
            >
              <option value="all">All Subjects</option>
              {POPULAR_SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-[#A7B4C8] mb-1.5 font-medium">
              Class / Grade
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full p-2.5 bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400 text-xs"
            >
              <option value="all">All Classes</option>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-[#A7B4C8] mb-1.5 font-medium">
              Exam Name
            </label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="w-full p-2.5 bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400 text-xs"
            >
              <option value="all">All Exams</option>
              {EXAM_BOARDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-[#A7B4C8] mb-1.5 font-medium">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2.5 bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400 text-xs"
            >
              <option value="all">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort & Reset Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/[0.08] text-xs">
          <div className="flex items-center gap-2 text-[#A7B4C8]">
            <span>Showing <strong className="text-white">{filteredPapers.length}</strong> available papers</span>
            <span className="text-white/20">·</span>
            <span className="text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-medium text-cyan-300 focus:outline-none cursor-pointer text-xs"
            >
              <option value="latest" className="bg-[#0A1222]">Latest Added</option>
              <option value="popular" className="bg-[#0A1222]">Most Downloaded</option>
              <option value="rating" className="bg-[#0A1222]">Highest Rated</option>
              <option value="yearDesc" className="bg-[#0A1222]">Newest Year</option>
              <option value="yearAsc" className="bg-[#0A1222]">Oldest Year</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Responsive Grid of Document Cards */}
      <div className="space-y-4">
        {filteredPapers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
          <div className="py-16 text-center text-xs text-[#A7B4C8] border border-white/[0.12] rounded-3xl bg-[#101B2D]/70 backdrop-blur-md p-8 space-y-3">
            <FileText className="w-12 h-12 text-[#A7B4C8]/40 mx-auto" />
            <h3 className="text-base font-bold text-[#F8FAFC]">No question papers found</h3>
            <p className="max-w-sm mx-auto">
              We couldn't find any papers matching your query. Try broadening your keywords or clearing the active filters.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl"
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add To Project Modal */}
      {selectedPaperForProject && (
        <AddToProjectModal
          paper={selectedPaperForProject}
          isOpen={!!selectedPaperForProject}
          onClose={() => setSelectedPaperForProject(null)}
          onSuccess={(projName) => {
            setProjectToast(`Paper attached to ${projName}`);
            setTimeout(() => setProjectToast(null), 3000);
          }}
        />
      )}

      {/* Project Toast */}
      {projectToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#101B2D] text-[#F8FAFC] border border-white/[0.14] text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{projectToast}</span>
        </div>
      )}
    </div>
  );
};
