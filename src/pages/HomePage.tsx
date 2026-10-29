import React, { useState } from 'react';
import { Search, ArrowRight, Compass, Sparkles, BookOpen } from 'lucide-react';
import { Paper, FilterState } from '../types';
import { PaperCard } from '../components/PaperCard';
import { EXAM_BOARDS, GRADE_LEVELS, POPULAR_SUBJECTS, YEARS } from '../data/samplePapers';

interface HomePageProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onNavigateToBrowse: (presetFilters?: Partial<FilterState> & { search?: string }) => void;
  onNavigateToUpload: () => void;
  onDownloadPaper?: (paper: Paper, e: React.MouseEvent) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  papers,
  onSelectPaper,
  onNavigateToBrowse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const approvedPapers = papers.filter((p) => p.status === 'approved');
  const recentPapers = approvedPapers.slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigateToBrowse({ search: searchQuery.trim() });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
      {/* Restrained Headline & Floating Input Area */}
      <div className="space-y-6 text-center sm:text-left">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171717] border border-white/[0.08] text-[11px] font-medium text-[#A0A0A0]">
            <BookOpen className="w-3 h-3 text-[#F5F5F5]" />
            <span>Question Papers & Study Archive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F5F5F5] tracking-tight">
            What are you studying?
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A0] leading-relaxed max-w-lg">
            Search previous year examination papers across CBSE, ICSE, JEE, and NEET.
          </p>
        </div>

        {/* Prominent Floating Input Card */}
        <form
          onSubmit={handleSearch}
          className="bg-[#171717] border border-white/[0.09] rounded-2xl p-3 sm:p-4 shadow-2xl shadow-black/50 space-y-3 transition-all hover:border-white/[0.14]"
        >
          <div className="relative flex items-center bg-[#101010] border border-white/[0.08] rounded-xl px-3 py-2.5 focus-within:border-white/30 transition-all">
            <Search className="w-4 h-4 text-[#707070] mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by subject, class or exam (e.g. Physics 2024)..."
              className="w-full bg-transparent text-sm text-[#F5F5F5] placeholder-[#707070] focus:outline-none"
            />
            <button
              type="submit"
              className="ml-2 px-4 py-1.5 bg-[#F5F5F5] hover:bg-white text-[#090909] text-xs font-semibold rounded-lg transition-all hover:-translate-y-0.5 active:translate-y-0 shrink-0"
            >
              Search
            </button>
          </div>

          {/* Quick Filter Selectors */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div>
              <label className="block text-[10px] text-[#707070] uppercase font-mono tracking-wider mb-1">
                Class
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) onNavigateToBrowse({ grade: e.target.value });
                }}
                className="w-full p-2 bg-[#101010] border border-white/[0.07] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] focus:outline-none text-xs"
              >
                <option value="">All classes</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[#707070] uppercase font-mono tracking-wider mb-1">
                Subject
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) onNavigateToBrowse({ subject: e.target.value });
                }}
                className="w-full p-2 bg-[#101010] border border-white/[0.07] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] focus:outline-none text-xs"
              >
                <option value="">All subjects</option>
                {POPULAR_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[#707070] uppercase font-mono tracking-wider mb-1">
                Exam
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) onNavigateToBrowse({ board: e.target.value });
                }}
                className="w-full p-2 bg-[#101010] border border-white/[0.07] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] focus:outline-none text-xs"
              >
                <option value="">All exams</option>
                {EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[#707070] uppercase font-mono tracking-wider mb-1">
                Year
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) onNavigateToBrowse({ year: e.target.value });
                }}
                className="w-full p-2 bg-[#101010] border border-white/[0.07] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] focus:outline-none text-xs"
              >
                <option value="">All years</option>
                {YEARS.map((y) => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Quick Curriculums Horizontal Strip */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#707070]">
          Popular Curriculums
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => onNavigateToBrowse({ board: 'CBSE', grade: 'Class 12' })}
            className="px-3.5 py-1.5 bg-[#171717] hover:bg-[#1D1D1D] border border-white/[0.08] hover:border-white/[0.16] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] transition-all"
          >
            CBSE Class 12
          </button>
          <button
            onClick={() => onNavigateToBrowse({ board: 'CBSE', grade: 'Class 10' })}
            className="px-3.5 py-1.5 bg-[#171717] hover:bg-[#1D1D1D] border border-white/[0.08] hover:border-white/[0.16] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] transition-all"
          >
            CBSE Class 10
          </button>
          <button
            onClick={() => onNavigateToBrowse({ board: 'JEE Main' })}
            className="px-3.5 py-1.5 bg-[#171717] hover:bg-[#1D1D1D] border border-white/[0.08] hover:border-white/[0.16] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] transition-all"
          >
            JEE Main
          </button>
          <button
            onClick={() => onNavigateToBrowse({ board: 'NEET UG' })}
            className="px-3.5 py-1.5 bg-[#171717] hover:bg-[#1D1D1D] border border-white/[0.08] hover:border-white/[0.16] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] transition-all"
          >
            NEET UG
          </button>
          <button
            onClick={() => onNavigateToBrowse({ board: 'ICSE', grade: 'Class 10' })}
            className="px-3.5 py-1.5 bg-[#171717] hover:bg-[#1D1D1D] border border-white/[0.08] hover:border-white/[0.16] rounded-xl text-[#A0A0A0] hover:text-[#F5F5F5] transition-all"
          >
            ICSE Class 10
          </button>
        </div>
      </div>

      {/* Recent Approved Papers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-[#F5F5F5]">
            Recently added papers
          </h2>
          <button
            onClick={() => onNavigateToBrowse()}
            className="text-xs text-[#A0A0A0] hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>Browse all</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentPapers.length > 0 ? (
          <div className="space-y-2.5">
            {recentPapers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onSelect={onSelectPaper}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#707070]">
            No papers available yet.
          </div>
        )}
      </div>
    </div>
  );
};
