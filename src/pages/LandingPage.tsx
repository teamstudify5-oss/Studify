import React from 'react';
import { Search, BookOpen, Bookmark, UploadCloud, ArrowRight, Star, CheckCircle2 } from 'lucide-react';
import { Paper } from '../types';
import { AppPerformanceFeedbackSection } from '../components/AppPerformanceFeedbackSection';

interface LandingPageProps {
  onNavigateToSearch: () => void;
  onSelectPaper: (paper: Paper) => void;
  samplePapers: Paper[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateToSearch,
  onSelectPaper,
  samplePapers,
}) => {
  // Mechanism: Sort papers by ratings descending, displaying the top 3 highest-rated papers
  const showcasePapers = [...samplePapers]
    .filter((p) => p.status === 'approved')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 3);

  return (
    <div className="space-y-16 sm:space-y-20 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-8 sm:pt-16 pb-12 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Core Message */}
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            {/* Introductory Label — Clean unboxed text, no loud pill capsules */}
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[var(--accent-blue)]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Free & Open Study Repository</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.14]">
              Previous Year Questions.{' '}
              <span className="text-[var(--accent-blue)]">
                Organized & Solved.
              </span>
            </h1>

            {/* Supporting Text */}
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-xl mx-auto lg:mx-0">
              Browse authentic previous year question papers and historical chapter weightages for CBSE, ICSE, JEE, and NEET. Completely free with no paywalls.
            </p>

            {/* Actions: Side-by-side alignment, compact and purposeful */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                type="button"
                onClick={onNavigateToSearch}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer btn-quad-border"
              >
                <span>Browse Question Papers</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onNavigateToSearch}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] hover:border-[var(--border-hover)] text-[var(--text-primary)] text-xs sm:text-sm font-medium rounded-xl transition-all shrink-0 cursor-pointer btn-quad-border"
              >
                Explore Syllabus Topics
              </button>
            </div>

            {/* Academic Notice */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-green)]" />
                <span>100% Free Public Access</span>
              </div>
              <span className="text-[var(--border-divider)]">·</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                <span>Free PDFs</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean floating document cards */}
          <div className="lg:col-span-5 relative">
            <div className="relative space-y-3 max-w-md mx-auto">
              {showcasePapers.length > 0 ? (
                showcasePapers.map((paper, index) => (
                  <div
                    key={paper.id}
                    onClick={() => onSelectPaper(paper)}
                    className={`bg-[var(--surface-main)]/85 backdrop-blur-md hover:bg-[var(--surface-elevated)]/90 border border-[var(--border-divider)] hover:border-[var(--border-hover)] rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
                      index === 1 ? 'lg:translate-x-2' : index === 2 ? 'lg:-translate-x-1' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--accent-blue)]">{paper.examBoard}</span>
                        <span className="text-[var(--text-muted)] opacity-60">·</span>
                        <span>{paper.grade}</span>
                        <span className="text-[var(--text-muted)] opacity-60">·</span>
                        <span className="font-mono text-[var(--text-muted)]">{paper.year}</span>
                      </div>
                      {paper.ratingCount && paper.ratingCount > 0 && paper.rating ? (
                        <div className="flex items-center gap-1 text-[var(--color-yellow)] font-mono text-[11px]">
                          <Star className="w-3 h-3 fill-current" />
                          <span>{Number(paper.rating).toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]">Not rated</span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1">
                      {paper.title}
                    </h3>

                    <div className="mt-2.5 pt-2 border-t border-[var(--border-divider)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {paper.totalMarks && paper.totalMarks > 0 ? `${paper.totalMarks} Marks · ` : ''}{paper.subject}
                      </span>
                      <span className="text-[var(--accent-blue)] font-medium hover:underline text-[11px] flex items-center gap-0.5">
                        <span>View Paper</span>
                        <span>→</span>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-7 text-center space-y-3 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] flex items-center justify-center mx-auto">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    No Question Papers Published Yet
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                    Browse the library to search available question papers across CBSE and competitive examinations.
                  </p>
                  <button
                    type="button"
                    onClick={onNavigateToSearch}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-blue)] hover:underline font-semibold pt-1 cursor-pointer"
                  >
                    <span>Explore Question Papers</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Modules Below Hero */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Built for Focused Preparation
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Everything you need to master previous exam papers in one unified workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Find the paper you need */}
          <div className="bg-[var(--surface-main)]/80 backdrop-blur-md hover:bg-[var(--surface-elevated)]/90 border border-[var(--border-divider)] hover:border-[var(--border-hover)] rounded-xl p-5 space-y-3 transition-all shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Find the paper you need
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Search by subject, examination, class, year, or specific chapter keywords with faceted instant filtering.
            </p>
          </div>

          {/* 2. Your study library */}
          <div className="bg-[var(--surface-main)]/80 backdrop-blur-md hover:bg-[var(--surface-elevated)]/90 border border-[var(--border-divider)] hover:border-[var(--border-hover)] rounded-xl p-5 space-y-3 transition-all shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-green-bg)] text-[var(--color-green)] flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Your study library
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Bookmark useful papers and organize your exam resources into your personal revision dashboard.
            </p>
          </div>

          {/* 3. Share useful resources */}
          <div className="bg-[var(--surface-main)]/80 backdrop-blur-md hover:bg-[var(--surface-elevated)]/90 border border-[var(--border-divider)] hover:border-[var(--border-hover)] rounded-xl p-5 space-y-3 transition-all shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)] flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Share useful resources
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Upload past question papers from your school or coaching and receive peer ratings, notes, and community feedback.
            </p>
          </div>
        </div>
      </section>

      {/* App Performance & User Experience Rating (Accessible to all students without account) */}
      <div id="app-performance-feedback">
        <AppPerformanceFeedbackSection />
      </div>

      {/* Call to Action Banner */}
      <section className="px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="rounded-2xl bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] p-8 sm:p-10 text-center space-y-4 shadow-sm">
          <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Ready to find your next paper?
          </h3>

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
            Access past question papers directly in your browser. No paywalls, no forced logins.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToSearch}
              className="px-6 py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer btn-quad-border"
            >
              Explore PYQs
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
