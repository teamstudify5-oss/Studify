import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, AlertOctagon, Sparkles } from 'lucide-react';
import { MetricCategory } from '../../types/audit';

interface HealthScoreGaugeProps {
  score: number;
  categoryScores: Record<MetricCategory, number>;
  metricsPassed: number;
  metricsWarning: number;
  metricsCritical: number;
  lastRunTimestamp: string;
  isAuditing: boolean;
  onRunAudit: () => void;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
}

export const HealthScoreGauge: React.FC<HealthScoreGaugeProps> = ({
  score,
  categoryScores,
  metricsPassed,
  metricsWarning,
  metricsCritical,
  lastRunTimestamp,
  isAuditing,
  onRunAudit,
  onExportMarkdown,
  onExportJSON,
}) => {
  // SVG circumference math
  const radius = 64;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = (val: number) => {
    if (val >= 90) return 'text-emerald-400 stroke-emerald-400';
    if (val >= 70) return 'text-amber-400 stroke-amber-400';
    return 'text-rose-400 stroke-rose-400';
  };

  const getScoreBadge = (val: number) => {
    if (val >= 90) return { label: 'Optimal Health', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (val >= 70) return { label: 'Actionable Warnings', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { label: 'Needs Immediate Attention', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  };

  const badge = getScoreBadge(score);

  return (
    <div className="bg-[#111622] border border-white/[0.08] rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Left: Circular Health Gauge */}
        <div className="flex items-center gap-6">
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="text-white/[0.06]"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className={`transition-all duration-700 ease-out ${getScoreColor(score)}`}
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-4xl font-bold font-mono tabular-nums tracking-tight ${getScoreColor(score)}`}>
                {score}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#A7B4C8] font-medium mt-0.5">
                Health Score
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-md border font-medium ${badge.bg}`}>
                {badge.label}
              </span>
              <span className="text-xs text-[#A7B4C8]">
                Audited <span className="font-mono text-white">{lastRunTimestamp}</span>
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Platform Health & Security Diagnostic
            </h2>
            <p className="text-sm text-[#A7B4C8] max-w-md leading-relaxed">
              Continuous inspection of search indexing, PDF reading ergonomics, upload integrity, and Google discoverability.
            </p>

            {/* Metric counters */}
            <div className="flex items-center gap-4 pt-1 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{metricsPassed} Passed</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{metricsWarning} Warnings</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-400 font-mono">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>{metricsCritical} Critical</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 w-full lg:w-auto">
          <button
            onClick={onRunAudit}
            disabled={isAuditing}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg ${
              isAuditing
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-wait'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white hover:shadow-cyan-500/25'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? 'Running Diagnostic Suite...' : 'Run Full Diagnostic'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportMarkdown}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-[#A7B4C8] hover:text-white rounded-lg border border-white/[0.08] transition-colors"
              title="Download audit report as Markdown"
            >
              Export Report (MD)
            </button>
            <button
              onClick={onExportJSON}
              className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-[#A7B4C8] hover:text-white rounded-lg border border-white/[0.08] transition-colors"
              title="Download audit report as JSON"
            >
              Export Raw (JSON)
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Pillar Quick Progress Bars */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.06]">
        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#A7B4C8]">Search & Taxonomy</span>
            <span className="font-mono text-cyan-400">{categoryScores.search_discovery}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${categoryScores.search_discovery}%` }}
            />
          </div>
        </div>

        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#A7B4C8]">UX & PDF Viewer</span>
            <span className="font-mono text-emerald-400">{categoryScores.ux_reader}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${categoryScores.ux_reader}%` }}
            />
          </div>
        </div>

        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#A7B4C8]">Security & Uploads</span>
            <span className="font-mono text-blue-400">{categoryScores.security_safety}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all duration-500"
              style={{ width: `${categoryScores.security_safety}%` }}
            />
          </div>
        </div>

        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#A7B4C8]">SEO & Web Vitals</span>
            <span className="font-mono text-purple-400">{categoryScores.performance_seo}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-400 transition-all duration-500"
              style={{ width: `${categoryScores.performance_seo}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
