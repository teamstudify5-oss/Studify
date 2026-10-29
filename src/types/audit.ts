export type MetricCategory = 'ux_reader' | 'search_discovery' | 'security_safety' | 'performance_seo';

export type MetricStatus = 'passed' | 'warning' | 'critical';

export interface AuditMetric {
  id: string;
  name: string;
  category: MetricCategory;
  status: MetricStatus;
  score: number; // 0 - 100
  value: string;
  benchmark: string;
  impact: string;
  details: string;
  remediationAvailable: boolean;
  remediated: boolean;
  remediationActionId?: string;
  remediationLabel?: string;
}

export interface Recommendation {
  id: string;
  category: MetricCategory;
  priority: 'high' | 'medium' | 'low';
  title: string;
  rationale: string;
  impact: string;
  effort: 'Quick Fix' | 'Moderate' | 'Architectural';
  remediated: boolean;
  actionId?: string;
  actionLabel?: string;
}

export interface RoadmapMilestone {
  id: string;
  phase: string;
  title: string;
  timeframe: string;
  status: 'completed' | 'in_progress' | 'planned';
  items: {
    name: string;
    description: string;
    done: boolean;
  }[];
}

export interface SystemAuditReport {
  timestamp: string;
  overallScore: number;
  categoryScores: Record<MetricCategory, number>;
  metrics: AuditMetric[];
  recommendations: Recommendation[];
  metricsPassed: number;
  metricsWarning: number;
  metricsCritical: number;
}
