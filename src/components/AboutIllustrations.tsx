import React from 'react';

/**
 * Shared SVG defs containing 18th-century copperplate crosshatching patterns,
 * delicate paper textures, and etched line shaders.
 */
export const EngravingDefs: React.FC = () => (
  <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
    <defs>
      {/* 45-degree delicate copperplate hatch */}
      <pattern id="sym-hatch-45" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="4" stroke="#F4F4F2" strokeWidth="0.65" strokeOpacity="0.4" />
      </pattern>

      {/* 135-degree crosshatch layer */}
      <pattern id="sym-crosshatch" width="5" height="5" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="5" y2="5" stroke="#F4F4F2" strokeWidth="0.65" strokeOpacity="0.35" />
        <line x1="5" y1="0" x2="0" y2="5" stroke="#F4F4F2" strokeWidth="0.65" strokeOpacity="0.35" />
      </pattern>

      {/* Dense copperplate shadow */}
      <pattern id="sym-dense-shadow" width="3" height="3" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="3" y2="3" stroke="#F4F4F2" strokeWidth="0.8" strokeOpacity="0.55" />
        <line x1="3" y1="0" x2="0" y2="3" stroke="#F4F4F2" strokeWidth="0.8" strokeOpacity="0.55" />
      </pattern>

      {/* Delicate ivory paper stipple */}
      <pattern id="sym-stipple" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.5" fill="#F4F4F2" fillOpacity="0.3" />
        <circle cx="5" cy="5" r="0.5" fill="#F4F4F2" fillOpacity="0.25" />
      </pattern>

      {/* Subtle vertical wood grain hatch */}
      <pattern id="sym-woodgrain" width="8" height="4" patternUnits="userSpaceOnUse">
        <line x1="0" y1="2" x2="8" y2="2" stroke="#787D8A" strokeWidth="0.5" strokeOpacity="0.3" />
      </pattern>
    </defs>
  </svg>
);

/**
 * Centered Background Geometric Linework: Antique celestial armillary & architectural arch
 */
export const SymmetricalBackgroundAura: React.FC<{ scrollFactor?: number }> = ({ scrollFactor = 0 }) => {
  return (
    <svg
      viewBox="0 0 1000 600"
      className="w-full h-full text-white/15 pointer-events-none select-none transition-transform duration-700 ease-out"
      style={{
        transform: `translate3d(0, ${scrollFactor * -30}px, 0)`,
      }}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.3">
        {/* Central Vertical Axis of Symmetry */}
        <line x1="500" y1="40" x2="500" y2="560" strokeDasharray="3 4" />
        <line x1="200" y1="300" x2="800" y2="300" strokeWidth="0.5" strokeDasharray="2 4" />

        {/* Concentric Astrolabe Circles Centered at (500, 300) */}
        <circle cx="500" cy="300" r="260" strokeDasharray="4 4" />
        <circle cx="500" cy="300" r="240" strokeWidth="0.5" />
        <circle cx="500" cy="300" r="180" strokeDasharray="2 3" />
        <circle cx="500" cy="300" r="120" strokeWidth="0.75" />
        <circle cx="500" cy="300" r="60" strokeDasharray="1 3" />

        {/* Symmetrical Archival Roman Arch */}
        <path d="M 280 500 L 280 280 A 220 220 0 0 1 720 280 L 720 500" strokeWidth="0.8" />
        <path d="M 300 500 L 300 290 A 200 200 0 0 1 700 290 L 700 500" strokeDasharray="3 3" />

        {/* Symmetrical Corner Border Filigree Ticks */}
        <path d="M 80 80 L 140 80 M 80 80 L 80 140" strokeWidth="0.8" />
        <path d="M 920 80 L 860 80 M 920 80 L 920 140" strokeWidth="0.8" />
        <path d="M 80 520 L 140 520 M 80 520 L 80 460" strokeWidth="0.8" />
        <path d="M 920 520 L 860 520 M 920 520 L 920 460" strokeWidth="0.8" />
      </g>
    </svg>
  );
};

/**
 * SCENE 1: THE PROBLEM
 * Symmetrical, balanced composition of a student sitting centrally at a study desk,
 * flanked by balanced stacks of books, a central clock, open paper with pencil.
 * Subtle motion: slight hand shift and paper depth.
 */
export const Scene1Problem: React.FC<{
  scrollProgress: number;
  isReducedMotion?: boolean;
}> = ({ scrollProgress, isReducedMotion = false }) => {
  const handShift = isReducedMotion ? 0 : Math.sin(scrollProgress * Math.PI) * 10;
  const paperShift = isReducedMotion ? 0 : scrollProgress * -8;

  return (
    <div className="relative w-full max-w-xl mx-auto aspect-[16/10] select-none">
      <svg
        viewBox="0 0 700 440"
        className="w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)]"
        aria-label="Symmetrical 18th-century engraving of a student at a study desk with books and question papers"
      >
        {/* Background Symmetrical Etched Arch & Bookshelf */}
        <g stroke="#787D8A" strokeWidth="0.7" fill="none" opacity="0.45">
          {/* Wall Arch */}
          <path d="M 120 320 L 120 170 A 230 230 0 0 1 580 170 L 580 320" strokeWidth="0.8" />
          <path d="M 140 320 L 140 180 A 210 210 0 0 1 560 180 L 560 320" strokeDasharray="3 3" />

          {/* Central Clock (Symmetrical focal point on wall) */}
          <circle cx="350" cy="85" r="28" stroke="#F4F4F2" strokeWidth="1.2" />
          <circle cx="350" cy="85" r="24" stroke="#F4F4F2" strokeWidth="0.5" strokeDasharray="2 3" />
          <line x1="350" y1="85" x2="350" y2="68" stroke="#F4F4F2" strokeWidth="1.5" />
          <line x1="350" y1="85" x2="364" y2="92" stroke="#F4F4F2" strokeWidth="1.2" />
          <circle cx="350" cy="85" r="2" fill="#F4F4F2" />

          {/* Symmetrical Left Bookshelf folios */}
          <g transform="translate(145, 140)">
            <rect x="0" y="0" width="18" height="60" fill="url(#sym-hatch-45)" stroke="#F4F4F2" strokeWidth="0.6" />
            <rect x="20" y="-5" width="22" height="65" fill="none" stroke="#F4F4F2" strokeWidth="0.6" />
            <rect x="44" y="5" width="16" height="55" fill="url(#sym-crosshatch)" stroke="#F4F4F2" strokeWidth="0.6" />
          </g>

          {/* Symmetrical Right Bookshelf folios */}
          <g transform="translate(475, 140)">
            <rect x="0" y="5" width="16" height="55" fill="url(#sym-crosshatch)" stroke="#F4F4F2" strokeWidth="0.6" />
            <rect x="18" y="-5" width="22" height="65" fill="none" stroke="#F4F4F2" strokeWidth="0.6" />
            <rect x="42" y="0" width="18" height="60" fill="url(#sym-hatch-45)" stroke="#F4F4F2" strokeWidth="0.6" />
          </g>
        </g>

        {/* Central Symmetrical Desk Surface */}
        <g id="desk-symmetric">
          <polygon points="70,300 630,300 600,410 100,410" fill="#10131A" stroke="#F4F4F2" strokeWidth="1.2" />
          <polygon points="70,300 630,300 625,312 75,312" fill="url(#sym-hatch-45)" stroke="#F4F4F2" strokeWidth="0.5" />
          <line x1="100" y1="410" x2="600" y2="410" stroke="#F4F4F2" strokeWidth="1.2" />
        </g>

        {/* Left Balanced Element: Stack of Bound Books */}
        <g transform="translate(110, 240)">
          <rect x="0" y="40" width="100" height="20" rx="1" fill="#171A21" stroke="#F4F4F2" strokeWidth="0.9" />
          <rect x="5" y="42" width="90" height="16" fill="url(#sym-crosshatch)" />
          <rect x="6" y="22" width="88" height="18" rx="1" fill="#14171E" stroke="#F4F4F2" strokeWidth="0.9" />
          <rect x="10" y="24" width="80" height="14" fill="url(#sym-hatch-45)" />
          <rect x="12" y="4" width="76" height="18" rx="1" fill="#171A21" stroke="#F4F4F2" strokeWidth="0.9" />
          {/* Subtle bookmark ribbon */}
          <path d="M 50 4 C 55 25, 45 45, 60 65" stroke="#787D8A" strokeWidth="1.2" fill="none" />
        </g>

        {/* Right Balanced Element: Finely Etched Laptop & Globe Motif */}
        <g transform="translate(480, 230)">
          {/* Symmetrical counterpart: Modern laptop drawn with copperplate lines */}
          <polygon points="10,15 105,15 100,85 15,85" fill="#0C0E14" stroke="#F4F4F2" strokeWidth="1" />
          <polygon points="18,22 97,22 93,78 22,78" fill="#06080D" stroke="#787D8A" strokeWidth="0.6" />
          {/* Screen linework */}
          <line x1="28" y1="32" x2="86" y2="32" stroke="#787D8A" strokeWidth="0.8" />
          <line x1="28" y1="42" x2="75" y2="42" stroke="#787D8A" strokeWidth="0.6" strokeDasharray="2 2" />
          <line x1="28" y1="52" x2="82" y2="52" stroke="#787D8A" strokeWidth="0.6" strokeDasharray="2 2" />
          {/* Base & keyboard */}
          <polygon points="5,85 110,85 125,102 -5,102" fill="#14171E" stroke="#F4F4F2" strokeWidth="1" />
          <polygon points="10,87 105,87 116,99 2,99" fill="url(#sym-hatch-45)" opacity="0.6" />
        </g>

        {/* Center: Symmetrically Placed Student Figure (Central Subject) */}
        <g transform="translate(265, 120)">
          {/* Head & Thoughtful Silhouette */}
          <path
            d="M 85 40 C 70 35, 62 50, 65 65 C 55 75, 55 95, 65 105 C 70 115, 85 120, 100 115 C 105 105, 115 70, 100 45 Z"
            fill="#13161F"
            stroke="#F4F4F2"
            strokeWidth="1.2"
          />
          {/* Hair contour */}
          <path d="M 72 42 C 80 34, 98 34, 102 48 C 94 55, 78 57, 72 42 Z" fill="#0A0C12" stroke="#F4F4F2" strokeWidth="0.8" />
          {/* Thoughtful profile looking down */}
          <path d="M 70 72 L 76 75" stroke="#F4F4F2" strokeWidth="1" />
          <path d="M 68 68 L 62 76 L 68 80 L 64 87 L 72 94" stroke="#F4F4F2" strokeWidth="0.9" fill="none" />

          {/* Shoulders & Torso (Symmetrically anchored) */}
          <path
            d="M 68 118 C 30 148, 20 200, 10 225 L 160 225 C 150 200, 140 148, 102 118 Z"
            fill="#11141B"
            stroke="#F4F4F2"
            strokeWidth="1.2"
          />
          {/* Symmetrical coat fold shading */}
          <path d="M 45 155 C 70 175, 100 175, 125 155" stroke="#787D8A" strokeWidth="0.8" fill="none" />
          <path d="M 30 185 C 65 205, 105 205, 140 185" stroke="#787D8A" strokeWidth="0.8" fill="none" />
          <path d="M 20 205 L 50 225 L 10 225 Z" fill="url(#sym-crosshatch)" />
          <path d="M 150 205 L 160 225 L 120 225 Z" fill="url(#sym-hatch-45)" />

          {/* Left Arm resting on desk */}
          <path d="M 30 155 C 5 185, -5 215, 5 225 C 15 228, 45 215, 60 200" stroke="#F4F4F2" strokeWidth="1" fill="#13161F" />
        </g>

        {/* Center Desk Surface: The Main Sheet of Paper with Subtle Movement */}
        <g transform={`translate(240, 280) translate(0, ${paperShift})`}>
          {/* Shadow */}
          <polygon points="5,10 215,8 222,125 8,127" fill="#000000" opacity="0.6" />
          {/* Main Ivory Sheet */}
          <polygon points="0,6 210,4 218,120 5,122" fill="#F7F4EB" stroke="#111318" strokeWidth="1.3" />
          {/* Inner Header Margin Rule */}
          <polygon points="7,12 203,10 210,114 11,116" fill="none" stroke="#222630" strokeWidth="0.6" />
          {/* Title Lines */}
          <line x1="20" y1="22" x2="130" y2="21" stroke="#111318" strokeWidth="1.4" />
          <line x1="20" y1="30" x2="190" y2="29" stroke="#525660" strokeWidth="0.8" />
          <line x1="20" y1="38" x2="160" y2="37" stroke="#787D8A" strokeWidth="0.6" strokeDasharray="3 2" />

          {/* Question lines with subtle crossed-out notes */}
          <line x1="20" y1="52" x2="190" y2="51" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="62" x2="170" y2="61" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="72" x2="180" y2="71" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="84" x2="140" y2="83" stroke="#111318" strokeWidth="0.8" />
          {/* Subtle question mark in etching */}
          <text x="175" y="105" fill="#111318" fontSize="24" fontFamily="serif" fontWeight="bold" opacity="0.3">?</text>
        </g>

        {/* Center: Writing Hand & Pencil with Subtle Motion */}
        <g transform={`translate(${330 + handShift}, ${295 + handShift * 0.25})`}>
          <path d="M 30 -30 C 20 -5, 10 10, 0 20 L 15 28 C 25 12, 38 -5, 45 -22 Z" fill="#11141B" stroke="#F4F4F2" strokeWidth="1" />
          <path
            d="M 5 18 C -3 23, -8 28, -2 36 C 5 40, 15 34, 20 26 C 18 20, 10 15, 5 18 Z"
            fill="#EFECE3"
            stroke="#111318"
            strokeWidth="1.1"
          />
          <line x1="-16" y1="42" x2="35" y2="4" stroke="#111318" strokeWidth="2.2" />
          <polygon points="-16,42 -19,46 -15,44" fill="#111318" />
        </g>

        {/* Small Symmetrical Balancers on Desk: Inkwell & Paperweight */}
        <g transform="translate(220, 335)">
          <rect x="0" y="0" width="16" height="20" rx="1" fill="#0C0E14" stroke="#F4F4F2" strokeWidth="0.8" />
          <circle cx="8" cy="-2" r="4" fill="#14171E" stroke="#F4F4F2" strokeWidth="0.6" />
        </g>
        <g transform="translate(465, 335)">
          <circle cx="10" cy="10" r="10" fill="#0C0E14" stroke="#F4F4F2" strokeWidth="0.8" />
          <circle cx="10" cy="10" r="6" fill="url(#sym-crosshatch)" />
        </g>
      </svg>
    </div>
  );
};

/**
 * SCENE 2: THE SEARCH
 * Symmetrical arrangement showing four learners distributed evenly around
 * a central motif of books and question papers:
 * Left: School student, Board-exam student.
 * Center: Central motif of open books, question papers, and hour-glass / compass.
 * Right: JEE/NEET aspirant, Student preparing to study abroad.
 */
export const Scene2Search: React.FC<{
  scrollProgress: number;
  isReducedMotion?: boolean;
}> = ({ isReducedMotion = false }) => {
  return (
    <div className="relative w-full max-w-2xl mx-auto aspect-[16/9] select-none">
      <svg
        viewBox="0 0 800 450"
        className="w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)]"
        aria-label="Symmetrical composition of four students arranged around a central motif of question papers and books"
      >
        {/* Background Symmetrical Frame */}
        <g stroke="#787D8A" strokeWidth="0.6" fill="none" opacity="0.35">
          <line x1="400" y1="40" x2="400" y2="410" strokeDasharray="3 4" />
          <circle cx="400" cy="225" r="160" strokeDasharray="2 3" />
          <circle cx="400" cy="225" r="190" strokeWidth="0.5" />
          <ellipse cx="400" cy="225" rx="360" ry="120" strokeDasharray="3 3" />
        </g>

        {/* ========================================================================= */}
        {/* CENTER MOTIF: Symmetrically Placed Stack of Question Papers & Open Folio */}
        {/* ========================================================================= */}
        <g transform="translate(290, 150)">
          {/* Back Folio (Open) */}
          <polygon points="0,50 110,35 110,135 0,145" fill="#F7F4EB" stroke="#111318" strokeWidth="1.2" />
          <polygon points="110,35 220,50 220,145 110,135" fill="#F7F4EB" stroke="#111318" strokeWidth="1.2" />
          {/* Spine */}
          <line x1="110" y1="35" x2="110" y2="135" stroke="#111318" strokeWidth="1.8" />
          {/* Text ruling on open pages */}
          {Array.from({ length: 6 }).map((_, i) => (
            <React.Fragment key={`page-rule-${i}`}>
              <line x1="12" y1={55 + i * 13} x2="98" y2={50 + i * 13} stroke="#787D8A" strokeWidth="0.6" strokeDasharray="2 2" />
              <line x1="122" y1={50 + i * 13} x2="208" y2={55 + i * 13} stroke="#787D8A" strokeWidth="0.6" strokeDasharray="2 2" />
            </React.Fragment>
          ))}

          {/* Central Question Paper in foreground */}
          <rect x="50" y="70" width="120" height="85" rx="1" fill="#FFFFFF" stroke="#111318" strokeWidth="1.3" />
          <line x1="62" y1="84" x2="158" y2="84" stroke="#111318" strokeWidth="1.4" />
          <text x="65" y="96" fill="#787D8A" fontSize="7" fontFamily="monospace" letterSpacing="1">PAST EXAM QUESTION</text>
          <line x1="62" y1="106" x2="158" y2="106" stroke="#111318" strokeWidth="0.7" />
          <line x1="62" y1="116" x2="140" y2="116" stroke="#111318" strokeWidth="0.7" />
          <line x1="62" y1="126" x2="150" y2="126" stroke="#111318" strokeWidth="0.7" />
          <text x="100" y="145" fill="#787D8A" fontSize="8" fontFamily="serif" textAnchor="middle">· SEARCHING ·</text>

          {/* Central Compass Needle motif */}
          <g transform="translate(110, 10)">
            <circle cx="0" cy="0" r="14" fill="#0C0E14" stroke="#F4F4F2" strokeWidth="1" />
            <polygon points="0,-12 3,0 0,12 -3,0" fill="#F4F4F2" />
          </g>
        </g>

        {/* ========================================================================= */}
        {/* LEFT FLANK: TWO LEARNERS (School Student & Board-Exam Student) */}
        {/* ========================================================================= */}
        {/* Learner 1 (Outer Left): The Young School Student */}
        <g transform="translate(60, 160)">
          {/* Framed Archival Circle Vignette */}
          <circle cx="50" cy="60" r="45" fill="#0E1118" stroke="#F4F4F2" strokeWidth="1" />
          <circle cx="50" cy="60" r="41" fill="none" stroke="#787D8A" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* Upright figure holding workbook */}
          <circle cx="50" cy="40" r="14" fill="#141720" stroke="#F4F4F2" strokeWidth="1" />
          <path d="M 38 60 L 62 60 L 68 95 L 32 95 Z" fill="#171A24" stroke="#F4F4F2" strokeWidth="1" />
          {/* Small arithmetic workbook */}
          <rect x="36" y="70" width="28" height="20" fill="#F7F4EB" stroke="#111318" strokeWidth="0.8" />
          <line x1="40" y1="76" x2="60" y2="76" stroke="#111318" strokeWidth="0.7" />
          <line x1="40" y1="82" x2="55" y2="82" stroke="#111318" strokeWidth="0.7" />
          {/* Label below */}
          <text x="50" y="122" fill="#F4F4F2" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
            School Student
          </text>
          <text x="50" y="136" fill="#787D8A" fontSize="8" fontFamily="monospace" textAnchor="middle">
            FOUNDATION
          </text>
        </g>

        {/* Learner 2 (Inner Left): The Board-Exam Student */}
        <g transform="translate(175, 120)">
          <circle cx="50" cy="70" r="48" fill="#0E1118" stroke="#F4F4F2" strokeWidth="1" />
          <circle cx="50" cy="70" r="44" fill="none" stroke="#787D8A" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* Thoughtful student reading 10-year paper */}
          <circle cx="50" cy="48" r="15" fill="#141720" stroke="#F4F4F2" strokeWidth="1" />
          <path d="M 36 70 L 64 70 L 70 108 L 30 108 Z" fill="#171A24" stroke="#F4F4F2" strokeWidth="1" />
          {/* Official paper booklet with marks */}
          <polygon points="35,80 65,76 65,102 35,104" fill="#F7F4EB" stroke="#111318" strokeWidth="0.8" />
          <line x1="40" y1="86" x2="60" y2="84" stroke="#111318" strokeWidth="0.7" />
          {/* Label below */}
          <text x="50" y="136" fill="#F4F4F2" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
            Board Candidate
          </text>
          <text x="50" y="150" fill="#787D8A" fontSize="8" fontFamily="monospace" textAnchor="middle">
            CBSE / ICSE
          </text>
        </g>

        {/* ========================================================================= */}
        {/* RIGHT FLANK: TWO LEARNERS (JEE/NEET Aspirant & Study Abroad Student) */}
        {/* ========================================================================= */}
        {/* Learner 3 (Inner Right): The JEE & NEET Aspirant */}
        <g transform="translate(525, 120)">
          <circle cx="50" cy="70" r="48" fill="#0E1118" stroke="#F4F4F2" strokeWidth="1" />
          <circle cx="50" cy="70" r="44" fill="none" stroke="#787D8A" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* Intense student solving questions */}
          <circle cx="50" cy="48" r="15" fill="#141720" stroke="#F4F4F2" strokeWidth="1" />
          <path d="M 36 70 L 64 70 L 70 108 L 30 108 Z" fill="#171A24" stroke="#F4F4F2" strokeWidth="1" />
          {/* OMR bubble sheet representation */}
          <rect x="36" y="80" width="28" height="22" fill="#F7F4EB" stroke="#111318" strokeWidth="0.8" />
          <circle cx="42" cy="86" r="1.5" fill="#111318" />
          <circle cx="48" cy="86" r="1.5" fill="none" stroke="#111318" strokeWidth="0.5" />
          <circle cx="54" cy="86" r="1.5" fill="none" stroke="#111318" strokeWidth="0.5" />
          <circle cx="42" cy="94" r="1.5" fill="none" stroke="#111318" strokeWidth="0.5" />
          <circle cx="48" cy="94" r="1.5" fill="#111318" />
          {/* Label below */}
          <text x="50" y="136" fill="#F4F4F2" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
            JEE & NEET
          </text>
          <text x="50" y="150" fill="#787D8A" fontSize="8" fontFamily="monospace" textAnchor="middle">
            ENTRANCE
          </text>
        </g>

        {/* Learner 4 (Outer Right): The Student Preparing to Study Abroad */}
        <g transform="translate(640, 160)">
          <circle cx="50" cy="60" r="45" fill="#0E1118" stroke="#F4F4F2" strokeWidth="1" />
          <circle cx="50" cy="60" r="41" fill="none" stroke="#787D8A" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* Student with diagnostic booklet & globe stand */}
          <circle cx="50" cy="40" r="14" fill="#141720" stroke="#F4F4F2" strokeWidth="1" />
          <path d="M 38 60 L 62 60 L 68 95 L 32 95 Z" fill="#171A24" stroke="#F4F4F2" strokeWidth="1" />
          {/* Standardized test diagnostic paper */}
          <polygon points="35,70 65,70 62,90 35,90" fill="#F7F4EB" stroke="#111318" strokeWidth="0.8" />
          <line x1="40" y1="76" x2="60" y2="76" stroke="#111318" strokeWidth="0.7" />
          {/* Label below */}
          <text x="50" y="122" fill="#F4F4F2" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
            Study Abroad
          </text>
          <text x="50" y="136" fill="#787D8A" fontSize="8" fontFamily="monospace" textAnchor="middle">
            GLOBAL EXAMS
          </text>
        </g>
      </svg>
    </div>
  );
};

/**
 * SCENE 3: THE DISCOVERY
 * The student discovers Studify and finds the relevant question paper.
 * Elegant visual transition from disorder to order:
 * Symmetrical order replacing chaos; neat stacks on both sides flanking
 * the central question paper with the Studify wordmark/open-book emblem naturally etched.
 */
export const Scene3Discovery: React.FC<{
  scrollProgress: number;
  isReducedMotion?: boolean;
}> = ({ scrollProgress, isReducedMotion = false }) => {
  const align = isReducedMotion ? 0 : Math.min(1, Math.max(0, scrollProgress));
  const orderShift = (1 - align) * 12;

  return (
    <div className="relative w-full max-w-xl mx-auto aspect-[16/10] select-none">
      <svg
        viewBox="0 0 700 440"
        className="w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)]"
        aria-label="Symmetrical engraving showing organized question papers with the Studify wordmark"
      >
        {/* Background Symmetrical Radiant Linework */}
        <g stroke="#787D8A" strokeWidth="0.6" fill="none" opacity="0.4">
          <circle cx="350" cy="190" r="150" strokeDasharray="3 3" />
          <circle cx="350" cy="190" r="180" strokeWidth="0.5" />
          <line x1="350" y1="30" x2="350" y2="350" strokeDasharray="2 4" />
          <line x1="170" y1="190" x2="530" y2="190" strokeDasharray="2 4" />
        </g>

        {/* Central Symmetrical Desk Surface */}
        <polygon points="70,300 630,300 600,410 100,410" fill="#10131A" stroke="#F4F4F2" strokeWidth="1.2" />
        <polygon points="70,300 630,300 625,312 75,312" fill="url(#sym-hatch-45)" stroke="#F4F4F2" strokeWidth="0.5" />
        <line x1="100" y1="410" x2="600" y2="410" stroke="#F4F4F2" strokeWidth="1.2" />

        {/* Left Balanced Folder: Organised Past Papers (Aligned from chaos) */}
        <g transform={`translate(${130 + orderShift}, 250)`}>
          <rect x="0" y="20" width="105" height="75" rx="2" fill="#F7F4EB" stroke="#111318" strokeWidth="1.1" />
          <rect x="5" y="25" width="95" height="14" fill="#111318" />
          <text x="12" y="35" fill="#FFFFFF" fontSize="8" fontFamily="monospace">CBSE PAPERS</text>
          <line x1="12" y1="48" x2="90" y2="48" stroke="#111318" strokeWidth="0.7" />
          <line x1="12" y1="56" x2="80" y2="56" stroke="#111318" strokeWidth="0.7" />
          <line x1="12" y1="64" x2="88" y2="64" stroke="#111318" strokeWidth="0.7" />
          <line x1="12" y1="72" x2="70" y2="72" stroke="#111318" strokeWidth="0.7" />
        </g>

        {/* Right Balanced Folder: Organised Entrance Tests */}
        <g transform={`translate(${465 - orderShift}, 250)`}>
          <rect x="0" y="20" width="105" height="75" rx="2" fill="#F7F4EB" stroke="#111318" strokeWidth="1.1" />
          <rect x="5" y="25" width="95" height="14" fill="#111318" />
          <text x="12" y="35" fill="#FFFFFF" fontSize="8" fontFamily="monospace">ENTRANCE SETS</text>
          <line x1="12" y1="48" x2="90" y2="48" stroke="#111318" strokeWidth="0.7" />
          <line x1="12" y1="56" x2="80" y2="56" stroke="#111318" strokeWidth="0.7" />
          <line x1="12" y1="64" x2="88" y2="64" stroke="#111318" strokeWidth="0.7" />
          <line x1="12" y1="72" x2="70" y2="72" stroke="#111318" strokeWidth="0.7" />
        </g>

        {/* Center: The Discovered Question Paper with the Studify Wordmark */}
        <g transform="translate(245, 140)">
          {/* Main Paper Sheet (Pristine Warm Ivory) */}
          <rect x="0" y="30" width="210" height="190" rx="3" fill="#FFFFFF" stroke="#111318" strokeWidth="1.5" />
          <rect x="6" y="36" width="198" height="178" rx="2" fill="none" stroke="#222630" strokeWidth="0.6" />

          {/* Symmetrical Studify Wordmark & Open Book Crest */}
          <g transform="translate(105, 55)" textAnchor="middle">
            {/* Etched open book crest */}
            <path d="M -16 0 C -8 -4, -2 -1, 0 3 C 2 -1, 8 -4, 16 0 L 16 12 C 8 8, 2 11, 0 8 C -2 11, -8 8, -16 12 Z" fill="#111318" stroke="#111318" strokeWidth="0.5" />
            <line x1="0" y1="3" x2="0" y2="9" stroke="#FFFFFF" strokeWidth="0.8" />
            {/* Studify Wordmark */}
            <text y="24" fill="#111318" fontSize="13" fontFamily="sans-serif" fontWeight="bold" letterSpacing="1">
              STUDIFY
            </text>
            <text y="33" fill="#787D8A" fontSize="7" fontFamily="monospace" letterSpacing="0.5">
              PREVIOUS YEAR QUESTION PAPERS
            </text>
          </g>

          <line x1="20" y1="98" x2="190" y2="98" stroke="#111318" strokeWidth="1.2" />

          {/* Neat Exam Header & Content */}
          <g transform="translate(20, 110)">
            <text x="0" y="10" fill="#111318" fontSize="9" fontFamily="serif" fontWeight="bold">
              OFFICIAL EXAMINATION ARCHIVE
            </text>
            <text x="0" y="20" fill="#787D8A" fontSize="7" fontFamily="monospace">
              COMPLETE QUESTION STRUCTURE & MARKING SCHEME
            </text>
            <line x1="0" y1="28" x2="170" y2="28" stroke="#111318" strokeWidth="0.7" />
            <line x1="0" y1="38" x2="155" y2="38" stroke="#111318" strokeWidth="0.7" />
            <line x1="0" y1="48" x2="165" y2="48" stroke="#111318" strokeWidth="0.7" />
            <line x1="0" y1="58" x2="140" y2="58" stroke="#111318" strokeWidth="0.7" />
            <line x1="0" y1="68" x2="150" y2="68" stroke="#111318" strokeWidth="0.7" />

            {/* Symmetrical Verification Stamp in Center-Right */}
            <g transform="translate(140, 64)">
              <circle cx="12" cy="12" r="16" fill="none" stroke="#111318" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx="12" cy="12" r="13" fill="none" stroke="#111318" strokeWidth="0.5" />
              <text x="12" y="14" fill="#111318" fontSize="6" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                VERIFIED
              </text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

/**
 * SCENE 4: THE COMMITMENT
 * Echoes the composition of Scene 1 in perfect visual symmetry.
 * Return to the student at the same desk, but now in calm, focused order:
 * pristine open paper, organized books, ink and pen placed with precision.
 */
export const Scene4Commitment: React.FC<{
  scrollProgress: number;
  isReducedMotion?: boolean;
}> = ({ scrollProgress, isReducedMotion = false }) => {
  const subtleShift = isReducedMotion ? 0 : scrollProgress * -5;

  return (
    <div className="relative w-full max-w-xl mx-auto aspect-[16/10] select-none">
      <svg
        viewBox="0 0 700 440"
        className="w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)]"
        aria-label="Symmetrical 18th-century engraving of the focused student studying with clear question papers"
      >
        {/* Background Symmetrical Arch (Harmonious with Scene 1) */}
        <g stroke="#787D8A" strokeWidth="0.7" fill="none" opacity="0.45">
          <path d="M 120 320 L 120 170 A 230 230 0 0 1 580 170 L 580 320" strokeWidth="0.8" />
          <path d="M 140 320 L 140 180 A 210 210 0 0 1 560 180 L 560 320" strokeDasharray="3 3" />

          {/* Central Clock: Time Now Focused */}
          <circle cx="350" cy="85" r="28" stroke="#F4F4F2" strokeWidth="1.2" />
          <circle cx="350" cy="85" r="24" stroke="#F4F4F2" strokeWidth="0.5" strokeDasharray="2 3" />
          <line x1="350" y1="85" x2="350" y2="64" stroke="#F4F4F2" strokeWidth="1.5" />
          <line x1="350" y1="85" x2="370" y2="85" stroke="#F4F4F2" strokeWidth="1.2" />
          <circle cx="350" cy="85" r="2" fill="#F4F4F2" />
          <text x="350" y="125" fill="#787D8A" fontSize="7" fontFamily="monospace" textAnchor="middle">
            STUDY TIME
          </text>
        </g>

        {/* Symmetrical Desk Surface */}
        <polygon points="70,300 630,300 600,410 100,410" fill="#10131A" stroke="#F4F4F2" strokeWidth="1.2" />
        <polygon points="70,300 630,300 625,312 75,312" fill="url(#sym-hatch-45)" stroke="#F4F4F2" strokeWidth="0.5" />
        <line x1="100" y1="410" x2="600" y2="410" stroke="#F4F4F2" strokeWidth="1.2" />

        {/* Left Balanced Element: Neatly Stacked Past Papers */}
        <g transform="translate(110, 240)">
          <rect x="0" y="40" width="100" height="20" rx="1" fill="#171A21" stroke="#F4F4F2" strokeWidth="0.9" />
          <rect x="5" y="42" width="90" height="16" fill="url(#sym-crosshatch)" />
          <rect x="6" y="22" width="88" height="18" rx="1" fill="#14171E" stroke="#F4F4F2" strokeWidth="0.9" />
          <rect x="10" y="24" width="80" height="14" fill="url(#sym-hatch-45)" />
          <rect x="12" y="4" width="76" height="18" rx="1" fill="#171A21" stroke="#F4F4F2" strokeWidth="0.9" />
          <line x1="20" y1="12" x2="80" y2="12" stroke="#F4F4F2" strokeWidth="0.8" />
        </g>

        {/* Right Balanced Element: Study Reference Tome & Notebook */}
        <g transform="translate(490, 240)">
          <rect x="0" y="40" width="100" height="20" rx="1" fill="#171A21" stroke="#F4F4F2" strokeWidth="0.9" />
          <rect x="5" y="42" width="90" height="16" fill="url(#sym-hatch-45)" />
          <rect x="6" y="22" width="88" height="18" rx="1" fill="#14171E" stroke="#F4F4F2" strokeWidth="0.9" />
          <rect x="10" y="24" width="80" height="14" fill="url(#sym-crosshatch)" />
          <rect x="12" y="4" width="76" height="18" rx="1" fill="#171A21" stroke="#F4F4F2" strokeWidth="0.9" />
          <line x1="20" y1="12" x2="80" y2="12" stroke="#F4F4F2" strokeWidth="0.8" />
        </g>

        {/* Center: Symmetrically Anchored Student Figure (Now Calm & Determined) */}
        <g transform="translate(265, 120)">
          <path
            d="M 85 40 C 70 35, 62 50, 65 65 C 55 75, 55 95, 65 105 C 70 115, 85 120, 100 115 C 105 105, 115 70, 100 45 Z"
            fill="#13161F"
            stroke="#F4F4F2"
            strokeWidth="1.2"
          />
          <path d="M 72 42 C 80 34, 98 34, 102 48 C 94 55, 78 57, 72 42 Z" fill="#0A0C12" stroke="#F4F4F2" strokeWidth="0.8" />
          {/* Eyes looking down with clarity */}
          <path d="M 70 72 L 76 75" stroke="#F4F4F2" strokeWidth="1" />
          <path d="M 68 68 L 62 76 L 68 80 L 64 87 L 72 94" stroke="#F4F4F2" strokeWidth="0.9" fill="none" />

          {/* Shoulders & Torso */}
          <path
            d="M 68 118 C 30 148, 20 200, 10 225 L 160 225 C 150 200, 140 148, 102 118 Z"
            fill="#11141B"
            stroke="#F4F4F2"
            strokeWidth="1.2"
          />
          <path d="M 45 155 C 70 175, 100 175, 125 155" stroke="#787D8A" strokeWidth="0.8" fill="none" />
          <path d="M 30 185 C 65 205, 105 205, 140 185" stroke="#787D8A" strokeWidth="0.8" fill="none" />
          <path d="M 20 205 L 50 225 L 10 225 Z" fill="url(#sym-crosshatch)" />
          <path d="M 150 205 L 160 225 L 120 225 Z" fill="url(#sym-hatch-45)" />

          <path d="M 30 155 C 5 185, -5 215, 5 225 C 15 228, 45 215, 60 200" stroke="#F4F4F2" strokeWidth="1" fill="#13161F" />
        </g>

        {/* Center: The Pristine Open Question Paper Being Actively Mastered */}
        <g transform={`translate(240, 280) translate(0, ${subtleShift})`}>
          <polygon points="5,10 215,8 222,125 8,127" fill="#000000" opacity="0.6" />
          <polygon points="0,6 210,4 218,120 5,122" fill="#F7F4EB" stroke="#111318" strokeWidth="1.3" />
          <polygon points="7,12 203,10 210,114 11,116" fill="none" stroke="#222630" strokeWidth="0.6" />

          {/* Clean question lines */}
          <line x1="20" y1="22" x2="150" y2="21" stroke="#111318" strokeWidth="1.4" />
          <line x1="20" y1="32" x2="190" y2="31" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="42" x2="175" y2="41" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="54" x2="190" y2="53" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="66" x2="180" y2="65" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="78" x2="160" y2="77" stroke="#111318" strokeWidth="0.8" />
          <line x1="20" y1="90" x2="185" y2="89" stroke="#111318" strokeWidth="0.8" />

          {/* Solved / Prepared Checkmark emblem */}
          <g transform="translate(170, 96)">
            <circle cx="10" cy="10" r="10" fill="#111318" />
            <path d="M 6 10 L 9 13 L 14 7" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </g>

        {/* Hand Steadily Writing */}
        <g transform="translate(330, 295)">
          <path d="M 30 -30 C 20 -5, 10 10, 0 20 L 15 28 C 25 12, 38 -5, 45 -22 Z" fill="#11141B" stroke="#F4F4F2" strokeWidth="1" />
          <path d="M 5 18 C -3 23, -8 28, -2 36 C 5 40, 15 34, 20 26 C 18 20, 10 15, 5 18 Z" fill="#EFECE3" stroke="#111318" strokeWidth="1.1" />
          <line x1="-16" y1="42" x2="35" y2="4" stroke="#111318" strokeWidth="2.2" />
          <polygon points="-16,42 -19,46 -15,44" fill="#111318" />
        </g>
      </svg>
    </div>
  );
};
