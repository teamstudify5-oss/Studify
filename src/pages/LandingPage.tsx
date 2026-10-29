import React from 'react';
import { Search, BookOpen, Bookmark, UploadCloud, ArrowRight, Star, ShieldCheck, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { Paper } from '../types';
import { MadeInIndiaBadge } from '../components/MadeInIndiaBadge';

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
  const showcasePapers = samplePapers.slice(0, 3);

  return (
    <div className="space-y-20 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Core Message */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* PRIMARY FOCUS: MADE IN INDIA & CREATOR BADGE */}
            <div className="flex justify-center lg:justify-start">
              <MadeInIndiaBadge />
            </div>

            {/* Introductory Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 text-xs font-semibold tracking-wider uppercase shadow-xs">
              <BookOpen className="w-3.5 h-3.5" />
              <span>FREE & OPEN STUDY REPOSITORY</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#F8FAFC] tracking-tight leading-[1.12]">
              Previous Year Questions.{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                Organized & Solved.
              </span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-[#A7B4C8] leading-relaxed max-w-xl mx-auto lg:mx-0">
              Browse authentic previous year question papers, solutions, and historical chapter weightages for CBSE, ICSE, JEE, and NEET. Completely free with no paywalls.
            </p>

            {/* Actions: Get Started & Explore PYQs — preserve exact button design, shape, and side-by-side alignment */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-3.5 pt-2">
              <button
                onClick={onNavigateToSearch}
                className="px-5 py-2.5 sm:px-7 sm:py-3.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-[#050914] text-xs sm:text-sm font-extrabold rounded-xl transition-all duration-200 shadow-xl shadow-cyan-500/25 hover:shadow-cyan-400/40 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Browse Question Papers</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onNavigateToSearch}
                className="px-5 py-2.5 sm:px-6 sm:py-3.5 bg-[#101B2D]/80 hover:bg-[#15233D] border border-white/[0.14] hover:border-cyan-400/40 text-[#F8FAFC] text-xs sm:text-sm font-semibold rounded-xl transition-all hover:-translate-y-0.5 shrink-0 cursor-pointer"
              >
                Explore Syllabus Topics
              </button>
            </div>

            {/* Academic Notice */}
            <div className="pt-2 flex items-center justify-center lg:justify-start gap-4 text-xs text-[#A7B4C8]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>100% Free Public Access</span>
              </div>
              <span className="text-white/20">·</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>PDFs & Step-by-Step Solutions</span>
              </div>
            </div>
          </div>

          {/* Right Column: Floating Document Cards Composition */}
          <div className="lg:col-span-5 relative">
            {/* Ambient Behind-Deck Illumination */}
            <div
              className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-emerald-500/20 blur-3xl rounded-3xl pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative space-y-3 max-w-md mx-auto">
              {showcasePapers.map((paper, index) => (
                <div
                  key={paper.id}
                  onClick={() => onSelectPaper(paper)}
                  className={`bg-[#101B2D]/85 backdrop-blur-xl border border-white/[0.14] hover:border-cyan-400/50 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 cursor-pointer shadow-xl shadow-black/50 ${
                    index === 1 ? 'lg:translate-x-3' : index === 2 ? 'lg:-translate-x-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-400">{paper.examBoard}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-[#A7B4C8]">{paper.grade}</span>
                      <span className="text-white/20">·</span>
                      <span className="font-mono text-white/60">{paper.year}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-300 font-mono text-[11px]">
                      <Star className="w-3 h-3 fill-amber-300" />
                      <span>{paper.rating || '4.8'}</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-[#F8FAFC] line-clamp-1">
                    {paper.title}
                  </h3>

                  <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#A7B4C8]">
                    <span className="font-mono text-[11px]">{paper.totalMarks} Marks · {paper.subject}</span>
                    <span className="text-cyan-300 font-medium hover:underline text-[11px] flex items-center gap-0.5">
                      <span>View Paper</span>
                      <span>→</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Modules Below Hero */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] tracking-tight">
            Built for Focused Preparation
          </h2>
          <p className="text-xs sm:text-sm text-[#A7B4C8] max-w-md mx-auto">
            Everything you need to master previous exam papers in one unified workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Find the paper you need */}
          <div className="bg-[#101B2D]/75 backdrop-blur-md border border-white/[0.12] hover:border-cyan-500/30 rounded-2xl p-6 space-y-3.5 transition-all shadow-xl shadow-black/30">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#F8FAFC]">
              Find the paper you need
            </h3>
            <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed">
              Search by subject, examination, class, year, or specific chapter keywords with faceted instant filtering.
            </p>
          </div>

          {/* 2. Your study library */}
          <div className="bg-[#101B2D]/75 backdrop-blur-md border border-white/[0.12] hover:border-teal-500/30 rounded-2xl p-6 space-y-3.5 transition-all shadow-xl shadow-black/30">
            <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-400/30 text-teal-300 flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#F8FAFC]">
              Your study library
            </h3>
            <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed">
              Bookmark useful papers and organize your exam resources into your personal revision dashboard.
            </p>
          </div>

          {/* 3. Share useful resources */}
          <div className="bg-[#101B2D]/75 backdrop-blur-md border border-white/[0.12] hover:border-emerald-500/30 rounded-2xl p-6 space-y-3.5 transition-all shadow-xl shadow-black/30">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#F8FAFC]">
              Share useful resources
            </h3>
            <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed">
              Upload past question papers from your school or coaching and receive peer ratings, notes, and community feedback.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-r from-cyan-950/60 via-[#101B2D] to-emerald-950/60 border border-white/[0.16] p-8 sm:p-12 text-center space-y-5 overflow-hidden shadow-2xl">
          <div
            className="absolute top-0 right-1/4 w-64 h-64 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none"
            aria-hidden="true"
          />

          <h3 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
            Ready to find your next paper?
          </h3>

          <p className="text-xs sm:text-sm text-[#A7B4C8] max-w-md mx-auto leading-relaxed">
            Access past question papers and solutions directly in your browser. No paywalls, no forced logins.
          </p>

          <div className="pt-2">
            <button
              onClick={onNavigateToSearch}
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-[#050914] text-sm font-extrabold rounded-xl transition-all shadow-xl shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              Explore PYQs
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
