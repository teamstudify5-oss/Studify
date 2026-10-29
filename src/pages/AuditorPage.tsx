import React, { useState, useEffect } from 'react';
import { Paper } from '../types';
import { 
  runFullAudit, 
  setStoredRemediation, 
  defaultRoadmap 
} from '../services/auditEngine';
import { MetricCategory, SystemAuditReport } from '../types/audit';
import { HealthScoreGauge } from '../components/auditor/HealthScoreGauge';
import { DiagnosticPillars } from '../components/auditor/DiagnosticPillars';
import { RecommendationsList } from '../components/auditor/RecommendationsList';
import { UpgradeRoadmap } from '../components/auditor/UpgradeRoadmap';
import { 
  ShieldAlert, 
  Sparkles, 
  Sliders, 
  ListChecks, 
  Milestone, 
  Check, 
  Download,
  AlertCircle
} from 'lucide-react';

interface AuditorPageProps {
  papers: Paper[];
  onNavigateToTab?: (tab: string) => void;
}

export const AuditorPage: React.FC<AuditorPageProps> = ({ papers, onNavigateToTab }) => {
  const [report, setReport] = useState<SystemAuditReport>(() => runFullAudit(papers));
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<MetricCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'recommendations' | 'roadmap'>('diagnostics');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRunAudit = () => {
    setIsAuditing(true);
    // Simulate real diagnostic sequence running asynchronously
    setTimeout(() => {
      const fresh = runFullAudit(papers);
      setReport(fresh);
      setIsAuditing(false);
      showToast('Diagnostic completed: System health calculated across 12 inspection points.');
    }, 800);
  };

  const handleToggleRemediation = (actionId: string, currentState: boolean) => {
    setStoredRemediation(actionId, !currentState);
    const fresh = runFullAudit(papers);
    setReport(fresh);
    showToast(
      !currentState 
        ? `Remediation activated! System score updated to ${fresh.overallScore}/100.`
        : `Remediation deactivated. Reverted to standard benchmark.`
    );
  };

  const handleExportMarkdown = () => {
    const md = `# Studify Autonomous Website Audit & Research Report
Date: ${new Date().toLocaleDateString()} ${report.timestamp}
Overall Health Score: ${report.overallScore}/100
Passed: ${report.metricsPassed} | Warnings: ${report.metricsWarning} | Critical: ${report.metricsCritical}

## Category Breakdown:
- Search & Taxonomy: ${report.categoryScores.search_discovery}%
- UX & PDF Viewing: ${report.categoryScores.ux_reader}%
- Security & Safety: ${report.categoryScores.security_safety}%
- SEO & Web Vitals: ${report.categoryScores.performance_seo}%

## Audit Findings:
${report.metrics
  .map(
    m => `### [${m.status.toUpperCase()}] ${m.name} (${m.score}/100)
- Observed: ${m.value}
- Benchmark: ${m.benchmark}
- Impact: ${m.impact}
- Details: ${m.details}`
  )
  .join('\n\n')}

## Prioritized Recommendations:
${report.recommendations
  .map(
    r => `- [${r.priority.toUpperCase()}] ${r.title}
  Rationale: ${r.rationale}
  Impact: ${r.impact}
  Effort: ${r.effort}
  Remediated: ${r.remediated ? 'YES' : 'NO'}`
  )
  .join('\n\n')}
`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Studify_Audit_Report_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported audit report as Markdown.');
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Studify_Audit_Raw_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported raw audit telemetry as JSON.');
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#151D2A] border border-cyan-500/40 text-cyan-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Breadcrumbs / Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#A7B4C8] mb-1">
              <span>Studify Engine</span>
              <span>/</span>
              <span className="text-cyan-400">Autonomous Website Auditor & Feature Planner</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Platform Auditor & Research Console
            </h1>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#111622] border border-white/[0.08] rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'diagnostics'
                  ? 'bg-white/[0.1] text-cyan-400 font-semibold shadow-sm'
                  : 'text-[#A7B4C8] hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Live Diagnostics</span>
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'recommendations'
                  ? 'bg-white/[0.1] text-cyan-400 font-semibold shadow-sm'
                  : 'text-[#A7B4C8] hover:text-white'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Action Items</span>
            </button>
            <button
              onClick={() => setActiveTab('roadmap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'roadmap'
                  ? 'bg-white/[0.1] text-cyan-400 font-semibold shadow-sm'
                  : 'text-[#A7B4C8] hover:text-white'
              }`}
            >
              <Milestone className="w-3.5 h-3.5" />
              <span>Evolution Roadmap</span>
            </button>
          </div>
        </div>

        {/* Overall Health Score Gauge */}
        <HealthScoreGauge
          score={report.overallScore}
          categoryScores={report.categoryScores}
          metricsPassed={report.metricsPassed}
          metricsWarning={report.metricsWarning}
          metricsCritical={report.metricsCritical}
          lastRunTimestamp={report.timestamp}
          isAuditing={isAuditing}
          onRunAudit={handleRunAudit}
          onExportMarkdown={handleExportMarkdown}
          onExportJSON={handleExportJSON}
        />

        {/* Tab Content */}
        {activeTab === 'diagnostics' && (
          <DiagnosticPillars
            metrics={report.metrics}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            onToggleRemediation={handleToggleRemediation}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationsList
            recommendations={report.recommendations}
            onApplyAction={handleToggleRemediation}
          />
        )}

        {activeTab === 'roadmap' && (
          <UpgradeRoadmap roadmap={defaultRoadmap} />
        )}

        {/* Explanatory Info Card */}
        <div className="bg-[#111622]/60 border border-white/[0.06] rounded-xl p-4 text-xs text-[#A7B4C8] leading-relaxed flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Continuous Self-Improvement Policy: </span>
            This console audits the PYQ repository against real student pain points: quick downloads, zero-result search drops, reading eye strain during night prep, and file upload safety. All recommendations are actionable with zero cosmetic clutter.
          </div>
        </div>
      </div>
    </div>
  );
};
