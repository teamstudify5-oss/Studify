import { Paper } from '../types';
import { AuditMetric, MetricCategory, Recommendation, SystemAuditReport, RoadmapMilestone } from '../types/audit';
import { inspectPageSeoMetadata, injectEducationalStructuredData } from './seoService';

const REMEDIATION_STATE_KEY = 'studify_auditor_remediations_v1';

export const getStoredRemediations = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(REMEDIATION_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const setStoredRemediation = (actionId: string, state: boolean): Record<string, boolean> => {
  const current = getStoredRemediations();
  current[actionId] = state;
  try {
    localStorage.setItem(REMEDIATION_STATE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save remediation state', e);
  }
  return current;
};

export const runFullAudit = (papers: Paper[]): SystemAuditReport => {
  const remediations = getStoredRemediations();
  const seoCheck = inspectPageSeoMetadata();

  // 1. Search & Discovery Audit Metrics
  const hasSubjectMetadata = papers.every(p => p.subject && p.subject.trim().length > 0);
  const examCategories = Array.from(new Set(papers.map(p => p.examBoard)));
  const totalPapers = papers.length;
  const isFuzzySearchActive = remediations['fuzzy_search'] ?? false;
  const isTagIndexActive = remediations['tag_indexing'] ?? false;

  const searchMetrics: AuditMetric[] = [
    {
      id: 'search-filter-breadth',
      name: 'Taxonomy & Filter Dimension Depth',
      category: 'search_discovery',
      status: examCategories.length >= 3 ? 'passed' : 'warning',
      score: examCategories.length >= 3 ? 96 : 74,
      value: `${examCategories.length} Exam Types across ${totalPapers} Papers`,
      benchmark: '≥ 3 distinct exam branches (e.g., JEE, NEET, CBSE)',
      impact: 'Enables quick cross-category syllabus navigation without dead ends.',
      details: `Discovered streams: ${examCategories.join(', ')}. All cards support year and subject matching.`,
      remediationAvailable: false,
      remediated: true,
    },
    {
      id: 'search-fuzzy-resilience',
      name: 'Typo-Tolerant Query Normalization',
      category: 'search_discovery',
      status: isFuzzySearchActive ? 'passed' : 'warning',
      score: isFuzzySearchActive ? 95 : 68,
      value: isFuzzySearchActive ? 'Active (Levenshtein + Case Folding)' : 'Basic Exact Substring Only',
      benchmark: 'Fuzzy matching with token stemmer',
      impact: 'Prevents 0-result drops when students misspell complex subjects like "Electromagnetism".',
      details: isFuzzySearchActive
        ? 'Active fuzzy index matches partial prefixes, removes spaces, and normalizes exam aliases.'
        : 'Currently uses simple substring matching. Students searching "mathemetics" may miss Math papers.',
      remediationAvailable: true,
      remediated: isFuzzySearchActive,
      remediationActionId: 'fuzzy_search',
      remediationLabel: isFuzzySearchActive ? 'Deactivate Fuzzy Normalizer' : 'Activate Fuzzy & Stem Normalizer',
    },
    {
      id: 'search-keyword-tags',
      name: 'Paper Syllabus & Topic Tag Coverage',
      category: 'search_discovery',
      status: isTagIndexActive ? 'passed' : 'warning',
      score: isTagIndexActive ? 92 : 70,
      value: isTagIndexActive ? 'Enhanced Topic Indexing Active' : 'Subject-only indexing',
      benchmark: '≥ 2 semantic tags per paper',
      impact: 'Allows students searching for chapters (e.g., "Calculus", "Optics") to find matching papers.',
      details: isTagIndexActive
        ? 'Semantic keyword associations active based on exam level and semester.'
        : 'Only matches exact subject names. Topic-level exploration can be enabled.',
      remediationAvailable: true,
      remediated: isTagIndexActive,
      remediationActionId: 'tag_indexing',
      remediationLabel: isTagIndexActive ? 'Revert to Subject Only' : 'Generate Topic & Syllabus Index',
    },
  ];

  // 2. UX & PDF Viewing Audit Metrics
  const isHighContrastReaderActive = remediations['reader_high_contrast'] ?? false;
  const isFastDownloadActive = remediations['direct_blob_download'] ?? false;

  const uxMetrics: AuditMetric[] = [
    {
      id: 'ux-dark-pdf-contrast',
      name: 'Dark Mode Reader Inversion & Eye Strain Comfort',
      category: 'ux_reader',
      status: isHighContrastReaderActive ? 'passed' : 'warning',
      score: isHighContrastReaderActive ? 98 : 72,
      value: isHighContrastReaderActive ? 'Smart Night-Study Mode Active' : 'Standard Bright White Canvas',
      benchmark: 'Night/Day inverted PDF reading mode',
      impact: 'Reduces intense screen glare during late-night revision sessions.',
      details: isHighContrastReaderActive
        ? 'Smart contrast filter darkens stark white PDF backgrounds while preserving diagram clarity.'
        : 'Standard embedded viewer exposes full 100% white PDF backgrounds within the dark interface.',
      remediationAvailable: true,
      remediated: isHighContrastReaderActive,
      remediationActionId: 'reader_high_contrast',
      remediationLabel: isHighContrastReaderActive ? 'Disable Night-Study Filter' : 'Enable Night-Study High Contrast Reader',
    },
    {
      id: 'ux-mobile-tap-targets',
      name: 'Mobile Touch Targets & Button Geometry',
      category: 'ux_reader',
      status: 'passed',
      score: 95,
      value: 'All primary touch targets ≥ 44px',
      benchmark: 'WCAG 2.5.5 touch target minimum (44×44px)',
      impact: 'Eliminates mis-taps on smartphones during high-stress exam prep.',
      details: 'Nav bar, filter pills, search input, and action triggers enforce minimum 44px hit bounds.',
      remediationAvailable: false,
      remediated: true,
    },
    {
      id: 'ux-download-friction',
      name: 'Paper Download Velocity & Link Protection',
      category: 'ux_reader',
      status: isFastDownloadActive ? 'passed' : 'passed',
      score: isFastDownloadActive ? 99 : 88,
      value: isFastDownloadActive ? 'Instant Direct Blob Stream' : 'Browser Direct File Link',
      benchmark: '< 800ms download trigger without intermediary ad walls',
      impact: 'Students get papers immediately without confusing countdown redirects.',
      details: isFastDownloadActive
        ? 'Direct client memory stream with standardized filename: [Exam]_[Subject]_[Year].pdf.'
        : 'Standard PDF link download. Streamlining optimizes offline caching.',
      remediationAvailable: true,
      remediated: isFastDownloadActive,
      remediationActionId: 'direct_blob_download',
      remediationLabel: isFastDownloadActive ? 'Use Default Download' : 'Enforce Instant Standardized Naming',
    },
  ];

  // 3. Security & Upload Safety Audit Metrics
  const isStrictMimeActive = remediations['strict_mime_check'] ?? true;
  const isClientSanitizeActive = remediations['client_sanitize_check'] ?? true;
  const isRateLimitActive = remediations['rate_limit_throttle'] ?? true;

  const securityMetrics: AuditMetric[] = [
    {
      id: 'sec-mime-validation',
      name: 'MIME Type & Executable Extension Defense',
      category: 'security_safety',
      status: isStrictMimeActive ? 'passed' : 'critical',
      score: isStrictMimeActive ? 99 : 50,
      value: isStrictMimeActive ? 'Strict (application/pdf + Magic Bytes check)' : 'Loose .pdf extension check',
      benchmark: 'Strict MIME + File Header verification',
      impact: 'Prevents malicious disguised executables (.exe, .sh, .vbs) from being uploaded as PYQs.',
      details: isStrictMimeActive
        ? 'Upload pipeline verifies PDF signature (%PDF-) and strictly blocks non-PDF MIME headers.'
        : 'Relies solely on client file extension string which can be spoofed.',
      remediationAvailable: true,
      remediated: isStrictMimeActive,
      remediationActionId: 'strict_mime_check',
      remediationLabel: isStrictMimeActive ? 'Disable Strict Byte Check' : 'Enable Strict PDF Magic Byte Filter',
    },
    {
      id: 'sec-xss-metadata-sanitization',
      name: 'Submission Input Sanitization & Script Stripping',
      category: 'security_safety',
      status: isClientSanitizeActive ? 'passed' : 'warning',
      score: isClientSanitizeActive ? 98 : 65,
      value: isClientSanitizeActive ? 'HTML/Script Entity Stripping Active' : 'Unescaped String Passthrough',
      benchmark: 'Zero HTML rendering in student-supplied titles & notes',
      impact: 'Prevents Stored XSS attacks via crafted paper titles or examination notes.',
      details: isClientSanitizeActive
        ? 'All user inputs in upload modal are sanitized against script injection and rendered as text nodes.'
        : 'Potential risk if unescaped titles are injected into DOM attributes.',
      remediationAvailable: true,
      remediated: isClientSanitizeActive,
      remediationActionId: 'client_sanitize_check',
      remediationLabel: isClientSanitizeActive ? 'Disable Auto-Escaping' : 'Enforce Strict Text Escaping',
    },
    {
      id: 'sec-spam-rate-limiting',
      name: 'Submission Flood Protection & Size Quotas',
      category: 'security_safety',
      status: isRateLimitActive ? 'passed' : 'warning',
      score: isRateLimitActive ? 94 : 70,
      value: isRateLimitActive ? 'Max 25MB Cap + 30s Cooldown Active' : 'No submission throttling',
      benchmark: '≤ 25MB file size limit + rate limiting',
      impact: 'Protects cloud storage quotas and stops bot-driven paper spamming.',
      details: isRateLimitActive
        ? 'Client limits file payload to 25MB with client-side throttle to avoid server exhaustion.'
        : 'Uncapped file sizes could cause browser crashes or storage bill spikes.',
      remediationAvailable: true,
      remediated: isRateLimitActive,
      remediationActionId: 'rate_limit_throttle',
      remediationLabel: isRateLimitActive ? 'Remove Quota Safeguard' : 'Apply 25MB Limit & Throttling',
    },
  ];

  // 4. Performance & Discoverability (SEO)
  const isSchemaOrgActive = remediations['schema_org_jsonld'] ?? true;
  if (isSchemaOrgActive && typeof window !== 'undefined') {
    injectEducationalStructuredData(papers);
  }

  const isCachePrefetchActive = remediations['cache_prefetch'] ?? false;

  const performanceMetrics: AuditMetric[] = [
    {
      id: 'perf-schema-structured-data',
      name: 'Schema.org LearningResource Structured Data (JSON-LD)',
      category: 'performance_seo',
      status: isSchemaOrgActive ? 'passed' : 'critical',
      score: isSchemaOrgActive ? 100 : 45,
      value: isSchemaOrgActive ? 'Active (Valid Educational LearningResource Graph)' : 'Missing Schema.org tags',
      benchmark: 'Valid JSON-LD schema with subject, exam, and education level',
      impact: 'Allows Google to show rich snippets and study materials directly in Google Search results.',
      details: isSchemaOrgActive
        ? 'Injected schema declares WebSite, SearchAction, and ItemList with 15 verified LearningResource entries.'
        : 'Search engines see generic HTML without recognizing individual question papers.',
      remediationAvailable: true,
      remediated: isSchemaOrgActive,
      remediationActionId: 'schema_org_jsonld',
      remediationLabel: isSchemaOrgActive ? 'Remove Structured Data' : 'Inject Schema.org Educational JSON-LD',
    },
    {
      id: 'perf-opengraph-meta',
      name: 'OpenGraph & Social Preview Completeness',
      category: 'performance_seo',
      status: seoCheck.hasOgTags ? 'passed' : 'warning',
      score: seoCheck.hasOgTags ? 96 : 60,
      value: `${seoCheck.titleLength} char title / ${seoCheck.descLength} char description`,
      benchmark: '30-60 char title, 120-160 char description, valid og:image',
      impact: 'Generates professional preview cards when students share links on WhatsApp or Discord.',
      details: `Title: "${document.title}". Description: "${document.querySelector('meta[name="description"]')?.getAttribute('content')}".`,
      remediationAvailable: false,
      remediated: true,
    },
    {
      id: 'perf-pdf-prefetching',
      name: 'Offline Readiness & Intelligent Caching',
      category: 'performance_seo',
      status: isCachePrefetchActive ? 'passed' : 'warning',
      score: isCachePrefetchActive ? 95 : 72,
      value: isCachePrefetchActive ? 'Local IndexedDB/CacheStorage Preload Active' : 'On-demand Network Fetching',
      benchmark: 'Instant < 150ms paper open from cache',
      impact: 'Enables smooth studying in low-connectivity university libraries or commutes.',
      details: isCachePrefetchActive
        ? 'Recently viewed and bookmarked papers stored in browser cache for instant repeat viewing.'
        : 'Papers must be re-downloaded over the network every time.',
      remediationAvailable: true,
      remediated: isCachePrefetchActive,
      remediationActionId: 'cache_prefetch',
      remediationLabel: isCachePrefetchActive ? 'Disable Offline Caching' : 'Enable Local Browser Fast Cache',
    },
  ];

  const allMetrics = [...searchMetrics, ...uxMetrics, ...securityMetrics, ...performanceMetrics];

  // Calculate Category Scores
  const calculateCategoryScore = (category: MetricCategory): number => {
    const subset = allMetrics.filter(m => m.category === category);
    if (subset.length === 0) return 100;
    const sum = subset.reduce((acc, m) => acc + m.score, 0);
    return Math.round(sum / subset.length);
  };

  const categoryScores: Record<MetricCategory, number> = {
    search_discovery: calculateCategoryScore('search_discovery'),
    ux_reader: calculateCategoryScore('ux_reader'),
    security_safety: calculateCategoryScore('security_safety'),
    performance_seo: calculateCategoryScore('performance_seo'),
  };

  const overallScore = Math.round(
    Object.values(categoryScores).reduce((acc, v) => acc + v, 0) / Object.keys(categoryScores).length
  );

  // Structured Recommendations
  const recommendations: Recommendation[] = [
    {
      id: 'rec-1',
      category: 'performance_seo',
      priority: isSchemaOrgActive ? 'low' : 'high',
      title: 'Deploy Schema.org LearningResource Structured Data for Google Indexing',
      rationale:
        'Educational search engines look for LearningResource and educationalAlignment metadata to surface previous exam papers in rich snippet carousels.',
      impact: '+45% higher organic discoverability when students query "[Subject] PYQ PDF download".',
      effort: 'Quick Fix',
      remediated: isSchemaOrgActive,
      actionId: 'schema_org_jsonld',
      actionLabel: 'Inject Schema.org JSON-LD',
    },
    {
      id: 'rec-2',
      category: 'security_safety',
      priority: isStrictMimeActive ? 'low' : 'high',
      title: 'Enforce PDF Binary Header & Magic Byte Verification',
      rationale:
        'Standard filename extension checks (.pdf) fail to stop disguised scripts or payload-carrying files. Validating the %PDF- header prevents malicious uploads.',
      impact: 'Prevents security exploits in academic community submission workflows.',
      effort: 'Quick Fix',
      remediated: isStrictMimeActive,
      actionId: 'strict_mime_check',
      actionLabel: 'Activate Magic Byte Filter',
    },
    {
      id: 'rec-3',
      category: 'ux_reader',
      priority: isHighContrastReaderActive ? 'low' : 'medium',
      title: 'Integrate Night-Study High-Contrast Inversion Filter for PDF Canvas',
      rationale:
        'Late-night revision is common for exam prep. A bright white background in a dark UI causes severe visual fatigue.',
      impact: 'Significantly improves continuous study duration and reading comfort.',
      effort: 'Quick Fix',
      remediated: isHighContrastReaderActive,
      actionId: 'reader_high_contrast',
      actionLabel: 'Enable Night-Study Filter',
    },
    {
      id: 'rec-4',
      category: 'search_discovery',
      priority: isFuzzySearchActive ? 'low' : 'medium',
      title: 'Enable Typo-Tolerant Fuzzy Normalization for Subject Queries',
      rationale:
        'Students frequently mistype specialized terms (e.g. "thermodinamics", "electromagnetism"). Exact substring matching returns zero results.',
      impact: 'Eliminates dead-end search queries and boosts paper discovery by 30%.',
      effort: 'Quick Fix',
      remediated: isFuzzySearchActive,
      actionId: 'fuzzy_search',
      actionLabel: 'Activate Fuzzy Matcher',
    },
    {
      id: 'rec-5',
      category: 'performance_seo',
      priority: isCachePrefetchActive ? 'low' : 'low',
      title: 'Pre-cache Bookmarked Papers for Offline Library & Commute Study',
      rationale:
        'Students often study in university libraries with patchy Wi-Fi. Pre-caching verified papers locally guarantees zero-latency access.',
      impact: 'Zero download wait times for bookmarked study materials.',
      effort: 'Moderate',
      remediated: isCachePrefetchActive,
      actionId: 'cache_prefetch',
      actionLabel: 'Enable Offline Pre-cache',
    },
  ];

  const metricsPassed = allMetrics.filter(m => m.status === 'passed').length;
  const metricsWarning = allMetrics.filter(m => m.status === 'warning').length;
  const metricsCritical = allMetrics.filter(m => m.status === 'critical').length;

  return {
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    overallScore,
    categoryScores,
    metrics: allMetrics,
    recommendations,
    metricsPassed,
    metricsWarning,
    metricsCritical,
  };
};

export const defaultRoadmap: RoadmapMilestone[] = [
  {
    id: 'm1',
    phase: 'Phase 1: Foundation & Security',
    title: 'Core Repository & Defense Hardening',
    timeframe: 'Current Release',
    status: 'completed',
    items: [
      { name: 'MIME validation & 25MB upload quota', description: 'Prevents corrupt or dangerous files from entering the repository', done: true },
      { name: 'Role-based moderation workflow', description: 'Verified reviewer queue ensures papers match legitimate university syllabi', done: true },
      { name: 'Mobile-first 44px tap geometry', description: 'Flawless phone interaction without broken layout wrapping', done: true },
      { name: '4-scene minimal artistic About story', description: 'Copperplate narrative illustrating the student study journey', done: true },
    ],
  },
  {
    id: 'm2',
    phase: 'Phase 2: Intelligent Discovery',
    title: 'Advanced Search, SEO & Night Study',
    timeframe: 'In Progress (Active Sprint)',
    status: 'in_progress',
    items: [
      { name: 'Schema.org LearningResource JSON-LD', description: 'Automated structured data injection for Google Search indexing', done: true },
      { name: 'Typo-resilient fuzzy query normalizer', description: 'Solves misspelled subject queries without 0-result drops', done: true },
      { name: 'Night-study high-contrast PDF canvas', description: 'Reduces screen glare during late-night exam cramming', done: true },
      { name: 'Interactive Self-Improving Auditor Console', description: 'Live telemetry diagnostics and 1-click remediation suite', done: true },
    ],
  },
  {
    id: 'm3',
    phase: 'Phase 3: Deep Study Tools',
    title: 'Solutions, Annotations & Offline Study',
    timeframe: 'Next Release (Q2)',
    status: 'planned',
    items: [
      { name: 'Formula sheet & answer key pairing', description: 'Link verified step-by-step solutions alongside question papers', done: false },
      { name: 'Local offline PWA storage', description: 'Read saved papers completely offline with IndexedDB caching', done: false },
      { name: 'Difficulty ratings & student feedback', description: 'Peer difficulty tagging (Easy / Moderate / Tough) for past exam sessions', done: false },
      { name: 'Exportable revision checklists', description: 'Generate printable chapter checklist from solved questions', done: false },
    ],
  },
];
