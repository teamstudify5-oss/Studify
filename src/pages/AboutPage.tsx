import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import {
  EngravingDefs,
  SymmetricalBackgroundAura,
  Scene1Problem,
  Scene2Search,
  Scene3Discovery,
  Scene4Commitment,
} from '../components/AboutIllustrations';

interface AboutPageProps {
  onExploreMaterials: () => void;
  onNavigateToHome: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onExploreMaterials,
}) => {
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Smooth scroll progress tracker for gentle parallax shifts
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
          setScrollProgress(progress);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#080A0D] text-[#F4F4F2] selection:bg-cyan-500/20 selection:text-cyan-200 overflow-x-hidden">
      {/* SVG Etching Definitions for 18th-century Crosshatching & Textures */}
      <EngravingDefs />

      {/* Symmetrical Background Linework (Centred Arch & Armillary) */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40 mix-blend-screen overflow-hidden"
        aria-hidden="true"
      >
        <SymmetricalBackgroundAura scrollFactor={isReducedMotion ? 0 : scrollProgress} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
        {/* ========================================================================= */}
        {/* SCENE 1: THE PROBLEM */}
        {/* ========================================================================= */}
        <section
          id="scene-problem"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8"
        >
          {/* Centered Typography: Exactly Headline & Supporting Text */}
          <div className="space-y-4 max-w-xl mx-auto">
            {/* PROMINENT MADE IN INDIA ATTRIBUTION */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-gradient-to-r from-orange-500/15 via-white/[0.08] to-emerald-500/15 border-2 border-orange-500/40 shadow-xl backdrop-blur-xl">
              <span className="text-xl sm:text-2xl" role="img" aria-label="Indian Flag">🇮🇳</span>
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-orange-400">
                MADE IN INDIA
              </span>
              <span className="hidden sm:inline text-white/30 font-bold">•</span>
              <span className="text-xs sm:text-sm font-bold text-[#F8FAFC]">
                Made by <strong className="font-extrabold text-cyan-300">Surajdeep</strong>, <strong className="font-extrabold text-teal-300">Abhyuday</strong>, <strong className="font-extrabold text-emerald-300">Atharv</strong>, and <strong className="font-extrabold text-amber-300">Ishaan</strong>
              </span>
            </div>

            <div>
              <span className="text-[11px] font-mono tracking-widest uppercase text-[#787D8A]">
                SCENE I
              </span>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F4F4F2] leading-tight mt-1">
                Every question begins somewhere.
              </h1>
              <p className="text-sm sm:text-base text-[#A3A6AD] leading-relaxed max-w-md mx-auto mt-2">
                But finding the right material shouldn't be the hardest part.
              </p>
            </div>
          </div>

          {/* Symmetrical Illustration 1 */}
          <div className="w-full max-w-xl mx-auto">
            <Scene1Problem 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>

          {/* Gentle scroll indicator */}
          <div className="pt-2 flex flex-col items-center gap-1.5 text-xs text-[#787D8A] select-none">
            <ChevronDown className="w-4 h-4 animate-bounce text-white/40" />
          </div>
        </section>

        {/* Subtle Archival Divider */}
        <div className="w-24 h-[1px] bg-white/[0.12] mx-auto" aria-hidden="true" />

        {/* ========================================================================= */}
        {/* SCENE 2: THE SEARCH */}
        {/* ========================================================================= */}
        <section
          id="scene-search"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8"
        >
          {/* Centered Typography */}
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#787D8A]">
              SCENE II
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F4F4F2] leading-tight">
              Too much searching. Not enough studying.
            </h2>
            <p className="text-sm sm:text-base text-[#A3A6AD] leading-relaxed max-w-md mx-auto">
              From school exams to competitive tests, finding the right material can take time.
            </p>
          </div>

          {/* Symmetrical Illustration 2: 4 Learners balanced around central question paper */}
          <div className="w-full max-w-2xl mx-auto">
            <Scene2Search 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>
        </section>

        {/* Subtle Archival Divider */}
        <div className="w-24 h-[1px] bg-white/[0.12] mx-auto" aria-hidden="true" />

        {/* ========================================================================= */}
        {/* SCENE 3: THE DISCOVERY */}
        {/* ========================================================================= */}
        <section
          id="scene-discovery"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8"
        >
          {/* Centered Typography */}
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#787D8A]">
              SCENE III
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F4F4F2] leading-tight">
              One place to find what you need.
            </h2>
            <p className="text-sm sm:text-base text-[#A3A6AD] leading-relaxed max-w-md mx-auto">
              Discover past papers and study resources with Studify.
            </p>
          </div>

          {/* Symmetrical Illustration 3: Disorder to Order with Studify Wordmark */}
          <div className="w-full max-w-xl mx-auto">
            <Scene3Discovery 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>
        </section>

        {/* Subtle Archival Divider */}
        <div className="w-24 h-[1px] bg-white/[0.12] mx-auto" aria-hidden="true" />

        {/* ========================================================================= */}
        {/* SCENE 4: THE COMMITMENT */}
        {/* ========================================================================= */}
        <section
          id="scene-commitment"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8 pb-28"
        >
          {/* Centered Typography */}
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#787D8A]">
              SCENE IV
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F4F4F2] leading-tight">
              Find your material. Do the work.
            </h2>
            <p className="text-sm sm:text-base text-[#A3A6AD] leading-relaxed max-w-md mx-auto">
              Your next step starts with you.
            </p>
          </div>

          {/* Symmetrical Illustration 4: Echoes Scene 1 in calm, organized mastery */}
          <div className="w-full max-w-xl mx-auto">
            <Scene4Commitment 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>

          {/* Dedicated Creators & Attribution Section */}
          <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#0F172A]/90 border border-white/[0.14] shadow-2xl space-y-6 text-center backdrop-blur-xl">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500/15 via-white/[0.08] to-emerald-500/15 border border-orange-500/30 text-xs font-bold uppercase tracking-wider text-orange-300">
              <span role="img" aria-label="India flag">🇮🇳</span>
              <span>Made in India</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
                Project Creators & Development Team
              </h3>
              <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-lg mx-auto">
                Studify was created by <strong>Surajdeep</strong>, <strong>Abhyuday</strong>, <strong>Atharv</strong>, and <strong>Ishaan</strong> as a free, open-access academic workspace for previous-year examination papers, solutions, and preparation resources.
              </p>
            </div>

            {/* Clean Grid of the 4 Creators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-[#0A1222] border border-cyan-500/30 text-center hover:border-cyan-400 transition-colors">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-cyan-500/15 text-cyan-300 font-black text-sm flex items-center justify-center">
                  S
                </div>
                <div className="font-bold text-sm text-[#F8FAFC]">Surajdeep</div>
                <div className="text-[11px] text-[#A7B4C8] mt-0.5">Creator</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0A1222] border border-teal-500/30 text-center hover:border-teal-400 transition-colors">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-teal-500/15 text-teal-300 font-black text-sm flex items-center justify-center">
                  A
                </div>
                <div className="font-bold text-sm text-[#F8FAFC]">Abhyuday</div>
                <div className="text-[11px] text-[#A7B4C8] mt-0.5">Creator</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0A1222] border border-emerald-500/30 text-center hover:border-emerald-400 transition-colors">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-emerald-500/15 text-emerald-300 font-black text-sm flex items-center justify-center">
                  A
                </div>
                <div className="font-bold text-sm text-[#F8FAFC]">Atharv</div>
                <div className="text-[11px] text-[#A7B4C8] mt-0.5">Creator</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0A1222] border border-amber-500/30 text-center hover:border-amber-400 transition-colors">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-amber-500/15 text-amber-300 font-black text-sm flex items-center justify-center">
                  I
                </div>
                <div className="font-bold text-sm text-[#F8FAFC]">Ishaan</div>
                <div className="text-[11px] text-[#A7B4C8] mt-0.5">Creator</div>
              </div>
            </div>
          </div>

          {/* One Restrained Call to Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onExploreMaterials}
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-[#050914] text-sm font-extrabold rounded-xl transition-all shadow-xl shadow-cyan-500/25 hover:shadow-cyan-400/40 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              <span>Explore study materials</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
