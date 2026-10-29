import React from 'react';
import { Recommendation } from '../../types/audit';
import { ArrowUpRight, CheckCircle2, Clock, Zap } from 'lucide-react';

interface RecommendationsListProps {
  recommendations: Recommendation[];
  onApplyAction: (actionId: string, currentState: boolean) => void;
}

export const RecommendationsList: React.FC<RecommendationsListProps> = ({
  recommendations,
  onApplyAction,
}) => {
  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Prioritized Action Items & Upgrades
          </h3>
          <p className="text-xs text-[#A7B4C8]">
            Direct recommendations based on educational repository best practices and student study ergonomics.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.map(rec => (
          <div
            key={rec.id}
            className={`bg-[#111622] border rounded-xl p-4 transition-all ${
              rec.remediated
                ? 'border-emerald-500/20 bg-emerald-500/[0.01]'
                : 'border-white/[0.08] hover:border-white/[0.15]'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${getPriorityBadge(
                    rec.priority
                  )}`}
                >
                  {rec.priority} Priority
                </span>
                <span className="text-xs text-[#A7B4C8] font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {rec.effort}
                </span>
              </div>

              {rec.remediated ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Remediated & Live</span>
                </div>
              ) : (
                rec.actionId && (
                  <button
                    onClick={() => onApplyAction(rec.actionId!, false)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-medium rounded-lg shadow-sm transition-all self-start sm:self-auto"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{rec.actionLabel || 'Apply Upgrade'}</span>
                  </button>
                )
              )}
            </div>

            <h4 className="text-sm font-semibold text-white mb-1.5">{rec.title}</h4>
            <p className="text-xs text-[#A7B4C8] leading-relaxed mb-2">{rec.rationale}</p>

            <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-950/20 border border-cyan-500/10 rounded-lg px-2.5 py-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>{rec.impact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
