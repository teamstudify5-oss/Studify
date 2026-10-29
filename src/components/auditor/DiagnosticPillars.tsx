import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Search, 
  BookOpen, 
  ShieldCheck, 
  Globe, 
  Sliders, 
  ArrowRight
} from 'lucide-react';
import { AuditMetric, MetricCategory } from '../../types/audit';

interface DiagnosticPillarsProps {
  metrics: AuditMetric[];
  activeCategory: MetricCategory | 'all';
  onSelectCategory: (cat: MetricCategory | 'all') => void;
  onToggleRemediation: (actionId: string, currentState: boolean) => void;
}

export const DiagnosticPillars: React.FC<DiagnosticPillarsProps> = ({
  metrics,
  activeCategory,
  onSelectCategory,
  onToggleRemediation,
}) => {
  const categories: { id: MetricCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'search_discovery', label: 'Search & Taxonomy', icon: Search },
    { id: 'ux_reader', label: 'UX & PDF Viewer', icon: BookOpen },
    { id: 'security_safety', label: 'Security & Safety', icon: ShieldCheck },
    { id: 'performance_seo', label: 'SEO & Web Vitals', icon: Globe },
  ];

  const filteredMetrics = activeCategory === 'all' 
    ? metrics 
    : metrics.filter(m => m.category === activeCategory);

  const getStatusIcon = (status: 'passed' | 'warning' | 'critical') => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'critical':
        return <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />;
    }
  };

  const getStatusBorder = (status: 'passed' | 'warning' | 'critical') => {
    switch (status) {
      case 'passed':
        return 'border-emerald-500/20 bg-emerald-500/[0.02]';
      case 'warning':
        return 'border-amber-500/20 bg-amber-500/[0.02]';
      case 'critical':
        return 'border-rose-500/20 bg-rose-500/[0.02]';
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#111622] border border-white/[0.08] rounded-xl overflow-x-auto">
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeCategory === 'all'
              ? 'bg-white/[0.1] text-cyan-400 font-semibold shadow-sm'
              : 'text-[#A7B4C8] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>All Findings ({metrics.length})</span>
        </button>

        {categories.map(cat => {
          const Icon = cat.icon;
          const count = metrics.filter(m => m.category === cat.id).length;
          const hasIssue = metrics.some(m => m.category === cat.id && m.status !== 'passed');

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-white/[0.1] text-cyan-400 font-semibold shadow-sm'
                  : 'text-[#A7B4C8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${hasIssue ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.06] text-white/70'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredMetrics.map(metric => (
          <div
            key={metric.id}
            className={`border rounded-xl p-4 transition-all hover:border-white/[0.15] ${getStatusBorder(metric.status)}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(metric.status)}
                <h4 className="text-sm font-semibold text-white tracking-tight">{metric.name}</h4>
              </div>
              <span className="font-mono text-xs font-semibold text-white/90 shrink-0 tabular-nums">
                {metric.score} / 100
              </span>
            </div>

            <div className="text-xs space-y-2 mt-2.5">
              <div className="flex items-center justify-between text-[#A7B4C8] bg-black/30 px-2.5 py-1.5 rounded-lg font-mono">
                <span>Observed State:</span>
                <span className="text-white font-medium truncate max-w-[200px]">{metric.value}</span>
              </div>

              <div className="flex items-center justify-between text-[#A7B4C8] px-1">
                <span>Benchmark:</span>
                <span className="text-white/70 font-mono text-[11px]">{metric.benchmark}</span>
              </div>

              <p className="text-xs text-[#A7B4C8] leading-relaxed pt-1">
                {metric.details}
              </p>

              <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                <span className="text-[11px] text-cyan-400/90 italic truncate pr-2">
                  Impact: {metric.impact}
                </span>

                {metric.remediationAvailable && metric.remediationActionId && (
                  <button
                    onClick={() => onToggleRemediation(metric.remediationActionId!, metric.remediated)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                      metric.remediated
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30'
                    }`}
                  >
                    <span>{metric.remediationLabel || 'Toggle Remediation'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
