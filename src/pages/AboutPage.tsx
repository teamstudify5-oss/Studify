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
