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
    <div className="relative min-h-screen text-[var(--text-primary)] selection:bg-[var(--accent-blue-bg)] selection:text-[var(--accent-blue)] overflow-x-hidden">
      {/* SVG Etching Definitions for Crosshatching & Textures */}
      <EngravingDefs />

      {/* Symmetrical Background Linework */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-20 mix-blend-screen overflow-hidden"
        aria-hidden="true"
      >
        <SymmetricalBackgroundAura scrollFactor={isReducedMotion ? 0 : scrollProgress} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
        {/* SCENE 1: THE PROBLEM */}
        <section
          id="scene-problem"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8"
        >
          <div className="space-y-4 max-w-xl mx-auto">
            <div>
              <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--accent-blue)] font-semibold">
                SCENE I
              </span>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight mt-1">
                Every question begins somewhere.
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto mt-2">
                Finding the right study material shouldn't be the hardest part of preparation.
              </p>
            </div>
          </div>

          {/* Illustration 1 */}
          <div className="w-full max-w-xl mx-auto">
            <Scene1Problem 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>

          {/* Gentle scroll indicator */}
          <div className="pt-2 flex flex-col items-center gap-1.5 text-xs text-[var(--text-muted)] select-none">
            <ChevronDown className="w-4 h-4 animate-bounce text-[var(--accent-blue)]/60" />
          </div>
        </section>

        {/* Subtle Divider */}
        <div className="w-24 h-[1px] bg-[var(--border-divider)] mx-auto" aria-hidden="true" />

        {/* SCENE 2: THE SEARCH */}
        <section
          id="scene-search"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8"
        >
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--accent-blue)] font-semibold">
              SCENE II
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
              Too much searching. Not enough studying.
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
              From school exams to competitive tests, finding authentic past papers can take hours.
            </p>
          </div>

          {/* Illustration 2 */}
          <div className="w-full max-w-2xl mx-auto">
            <Scene2Search 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>
        </section>

        {/* Subtle Divider */}
        <div className="w-24 h-[1px] bg-[var(--border-divider)] mx-auto" aria-hidden="true" />

        {/* SCENE 3: THE DISCOVERY */}
        <section
          id="scene-discovery"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8"
        >
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--accent-blue)] font-semibold">
              SCENE III
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
              One place to find what you need.
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
              Discover authentic past papers and organized resources on Studify.
            </p>
          </div>

          {/* Illustration 3 */}
          <div className="w-full max-w-xl mx-auto">
            <Scene3Discovery 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>
        </section>

        {/* Subtle Divider */}
        <div className="w-24 h-[1px] bg-[var(--border-divider)] mx-auto" aria-hidden="true" />

        {/* SCENE 4: THE COMMITMENT */}
        <section
          id="scene-commitment"
          className="min-h-[85vh] sm:min-h-[90vh] flex flex-col justify-center items-center text-center py-16 sm:py-24 space-y-8 pb-28"
        >
          <div className="space-y-3 max-w-xl mx-auto">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[var(--accent-blue)] font-semibold">
              SCENE IV
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
              Find your material. Do the work.
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
              Your next step starts with you.
            </p>
          </div>

          {/* Illustration 4 */}
          <div className="w-full max-w-xl mx-auto">
            <Scene4Commitment 
              scrollProgress={scrollProgress} 
              isReducedMotion={isReducedMotion} 
            />
          </div>

          {/* Wordmark Signature — No logo emblem */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--surface-main)] border border-[var(--border-divider)] text-xs text-[var(--text-secondary)]">
            <span className="font-bold text-[var(--text-primary)]">Studify</span>
            <span>·</span>
            <span>Open Study Archive</span>
          </div>

          {/* Call to Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onExploreMaterials}
              className="px-6 py-3 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#1C2530] text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
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
