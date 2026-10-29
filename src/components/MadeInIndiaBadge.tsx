import React from 'react';

interface MadeInIndiaBadgeProps {
  className?: string;
}

export const MadeInIndiaBadge: React.FC<MadeInIndiaBadgeProps> = ({ className = '' }) => {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0D1526]/90 border border-white/[0.12] shadow-sm hover:border-orange-500/40 hover:bg-[#101B2D] transition-all duration-200 select-none ${className}`}
      aria-label="Made in India"
    >
      {/* Crisp Indian National Flag SVG with Ashoka Chakra */}
      <span className="flex items-center shrink-0" role="img" aria-label="Indian National Flag">
        <svg
          viewBox="0 0 36 24"
          className="w-5 h-3.5 rounded-[2px] ring-1 ring-white/20 shadow-xs overflow-hidden"
          aria-hidden="true"
        >
          {/* Saffron band */}
          <rect width="36" height="8" fill="#FF9933" />
          {/* White band */}
          <rect y="8" width="36" height="8" fill="#FFFFFF" />
          {/* Green band */}
          <rect y="16" width="36" height="8" fill="#138808" />
          {/* Ashoka Chakra */}
          <g transform="translate(18, 12)">
            <circle r="3.2" fill="none" stroke="#000080" strokeWidth="0.55" />
            <circle r="0.75" fill="#000080" />
            {Array.from({ length: 24 }).map((_, i) => (
              <line
                key={i}
                x1="0"
                y1="0"
                x2={3.1 * Math.cos((i * 15 * Math.PI) / 180)}
                y2={3.1 * Math.sin((i * 15 * Math.PI) / 180)}
                stroke="#000080"
                strokeWidth="0.25"
              />
            ))}
          </g>
        </svg>
      </span>

      {/* Subtle Divider */}
      <span className="h-3 w-[1px] bg-white/20" aria-hidden="true" />

      {/* Label: Made in India */}
      <span className="text-[11px] font-bold tracking-wider uppercase text-orange-300/95 leading-none">
        Made in India
      </span>
    </div>
  );
};
