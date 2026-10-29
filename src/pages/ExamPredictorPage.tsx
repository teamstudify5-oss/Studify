import React, { useState } from 'react';
import { 
  BarChart3, 
  FileText, 
  Download, 
  Eye, 
  FolderPlus, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Award,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Sliders,
  Printer,
  Info,
  Calculator,
  Check
} from 'lucide-react';
import { Paper, ExamBoard, GradeLevel } from '../types';
import { 
  calculateStatisticalPrediction, 
  StatisticalExamPrediction 
} from '../services/statisticalPredictor';
import { AddToProjectModal } from '../components/workspace/AddToProjectModal';

interface ExamPredictorPageProps {
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  onDownloadPaper: (paper: Paper, e?: React.MouseEvent) => void;
  onNavigateToWorkspace: () => void;
}

export const ExamPredictorPage: React.FC<ExamPredictorPageProps> = ({
  papers,
  onSelectPaper,
  onDownloadPaper,
}) => {
  const [board, setBoard] = useState<ExamBoard>('CBSE');
  const [grade, setGrade] = useState<GradeLevel>('Class 12');
  const [subject, setSubject] = useState<string>('Physics');
  const [targetYear, setTargetYear] = useState<number>(2025);
  
  const [prediction, setPrediction] = useState<StatisticalExamPrediction>(() => 
    calculateStatisticalPrediction('CBSE', 'Class 12', 'Physics', 2025, papers)
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setTimeout(() => {
      const res = calculateStatisticalPrediction(board, grade, subject, targetYear, papers);
      setPrediction(res);
      setIsGenerating(false);
      showToast('Statistical syllabus model generated successfully');
    }, 250);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Header Banner - Pure Mathematical & Transparent */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-[#0A1222] to-emerald-950/30 border border-white/[0.14] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold">
            <Calculator className="w-3.5 h-3.5" />
            <span>STATISTICAL RECURRENCE MODEL (NO AI / NO LLM)</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-[#F8FAFC] tracking-tight">
            Exam Statistical Predictor & Mock Assembly
          </h1>

          <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed">
            Computes deterministic topic probabilities using empirical recurrence frequency (F/N), Beta-Binomial Laplace smoothing (P = (F+1)/(N+2)), recency (R), gap analysis (G), and historical marks weightage (W).
          </p>
        </div>
      </div>

      {/* Configuration Controls Bar */}
      <form onSubmit={handleGenerate} className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.12] grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[11px] text-[#A7B4C8] mb-1 font-semibold uppercase">Exam Board</label>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value as ExamBoard)}
            className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="JEE Main">JEE Main</option>
            <option value="JEE Advanced">JEE Advanced</option>
            <option value="NEET UG">NEET UG</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-[#A7B4C8] mb-1 font-semibold uppercase">Class / Level</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as GradeLevel)}
            className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="Class 10">Class 10</option>
            <option value="Class 11">Class 11</option>
            <option value="Class 12">Class 12</option>
            <option value="Competitive">Competitive</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-[#A7B4C8] mb-1 font-semibold uppercase">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Science">Science (Class 10)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-[#A7B4C8] mb-1 font-semibold uppercase">Target Year</label>
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value))}
            className="w-full px-3 py-2 bg-[#0A1222] border border-white/[0.14] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isGenerating}
          className="col-span-2 sm:col-span-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{isGenerating ? 'Calculating...' : 'Calculate Model'}</span>
        </button>
      </form>

      {/* Insufficient Historical Data Alert */}
      {prediction.hasInsufficientData ? (
        <div className="p-6 sm:p-8 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <h3 className="text-lg font-bold text-amber-300">
              Insufficient Historical Data (Sample Size N &lt; 2)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-2xl">
            {prediction.insufficientDataReason}
          </p>
          <div className="text-xs text-[#A7B4C8]">
            To generate statistically meaningful Laplace smoothing and Wilson confidence bounds, please contribute or upload at least 2 past year examination papers for this category.
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in">
          {/* Statistical Metrics Overview Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
              <div className="text-xs text-[#A7B4C8] flex items-center justify-between">
                <span>Sample Size (N)</span>
                <Calculator className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {prediction.sampleSizeN} Years
              </div>
              <div className="text-[11px] text-[#A7B4C8] truncate">
                Past papers: {prediction.historicalYearsAnalyzed.join(', ')}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
              <div className="text-xs text-[#A7B4C8] flex items-center justify-between">
                <span>Backtest Precision</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {(prediction.backtest.laplaceAveragePrecision * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-emerald-300/80">
                vs {(prediction.backtest.baselineAveragePrecision * 100).toFixed(1)}% naive uniform baseline
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
              <div className="text-xs text-[#A7B4C8] flex items-center justify-between">
                <span>Paper Marks & Time</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {prediction.totalMarks} Marks · {prediction.timeAllowedMinutes / 60}h
              </div>
              <div className="text-[11px] text-cyan-400">
                {prediction.assembledPaper.sections.length} Standard Sections
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-1">
              <div className="text-xs text-[#A7B4C8] flex items-center justify-between">
                <span>Target Focus</span>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-300 font-mono truncate">
                {prediction.board} {prediction.targetYear}
              </div>
              <div className="text-[11px] text-[#A7B4C8]">
                {prediction.grade} — {prediction.subject}
              </div>
            </div>
          </div>

          {/* Mathematical Formula & Methodology Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0F172A]/90 border border-white/[0.12] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Statistical Formulation & Variables Guide</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-[#A7B4C8]">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <span className="font-mono text-cyan-300 font-bold">F (Frequency)</span>
                <p className="text-[11px] leading-relaxed">Number of historical exam years where this topic appeared.</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <span className="font-mono text-emerald-300 font-bold">P(Laplace) = (F+1)/(N+2)</span>
                <p className="text-[11px] leading-relaxed">Bayesian Beta-Binomial smoothing avoiding 0% or 100% boundary biases.</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <span className="font-mono text-amber-300 font-bold">R &amp; G (Recency &amp; Gap)</span>
                <p className="text-[11px] leading-relaxed">R = ∑ 1/(Target - Year) and G = Gap in years since last appearance.</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <span className="font-mono text-teal-300 font-bold">Wilson 95% CI</span>
                <p className="text-[11px] leading-relaxed">Conservative confidence interval [Lower, Upper] for small sample sizes.</p>
              </div>
            </div>
          </div>

          {/* Table: Explicit Topic Variables & Statistical Breakdown */}
          <div className="p-5 sm:p-7 rounded-3xl bg-[#0A1222]/90 border border-white/[0.12] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Topic Statistical Analysis (N={prediction.sampleSizeN} Years)
                </h3>
                <p className="text-xs text-[#A7B4C8]">
                  Deterministic ranking of syllabus chapters based on empirical data from {prediction.historicalYearsAnalyzed.join(', ')}.
                </p>
              </div>
              <span className="text-xs text-cyan-400 font-mono">
                Laplace Probability Sorted
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.1] text-[#A7B4C8] font-mono text-[11px]">
                    <th className="py-2.5 px-3">Chapter / Topic</th>
                    <th className="py-2.5 px-2 text-center">F / N</th>
                    <th className="py-2.5 px-2 text-center">P(Empirical)</th>
                    <th className="py-2.5 px-2 text-center font-bold text-cyan-300">P(Laplace)</th>
                    <th className="py-2.5 px-2 text-center">Wilson 95% CI</th>
                    <th className="py-2.5 px-2 text-center">Recency (R)</th>
                    <th className="py-2.5 px-2 text-center">Gap (G)</th>
                    <th className="py-2.5 px-3 text-right">Avg Marks (W)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {prediction.topicProfiles.map((topic, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{topic.chapter}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                              topic.difficulty === 'hard'
                                ? 'bg-rose-500/20 text-rose-300'
                                : topic.difficulty === 'medium'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {topic.difficulty}
                          </span>
                          <span className="text-[10px] text-[#A7B4C8]">
                            Appeared: {topic.historicalYears.join(', ') || 'None'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-white/90">
                        {topic.F} / {topic.N}
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-[#A7B4C8]">
                        {(topic.empiricalFrequency * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-bold text-cyan-300">
                        {(topic.laplaceSmoothedProbability * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-[11px] text-emerald-400/90">
                        [{(topic.confidenceInterval95[0] * 100).toFixed(0)}% – {(topic.confidenceInterval95[1] * 100).toFixed(0)}%]
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-[#A7B4C8]">
                        {topic.R.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-[#A7B4C8]">
                        {topic.G} yr{topic.G > 1 ? 's' : ''}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                        ~{topic.W} Marks
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chronological Backtesting Validation Section */}
          <div className="p-5 sm:p-7 rounded-3xl bg-[#0A1222]/90 border border-white/[0.12] space-y-4">
            <div className="border-b border-white/[0.08] pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Chronological Backtesting Validation
              </h3>
              <p className="text-xs text-[#A7B4C8]">
                Testing predictions sequentially on historical years using strictly past training data (e.g. 2022 trained on 2020-2021).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {prediction.backtest.yearlyMetrics.map((bm) => (
                <div key={bm.year} className="p-4 rounded-2xl bg-[#101B2D]/70 border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span>Year {bm.year} Backtest</span>
                    <span className="font-mono text-cyan-300">
                      Hit Rate: {(bm.laplacePrecision * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-[#A7B4C8]">
                    <div className="flex justify-between">
                      <span>Laplace Precision:</span>
                      <span className="font-mono text-emerald-300 font-bold">{(bm.laplacePrecision * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uniform Baseline:</span>
                      <span className="font-mono text-white/70">{(bm.baselinePrecision * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Brier Score (lower is better):</span>
                      <span className="font-mono text-cyan-300">{bm.laplaceBrierScore} vs {bm.baselineBrierScore}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Preparation Strategy Bullet Points */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#101B2D]/80 border border-white/[0.1] space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Recommended Syllabus Prioritization Strategy</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#A7B4C8]">
              {prediction.preparationStrategy.map((tip, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-2">
                  <span className="text-cyan-400 font-mono font-bold shrink-0">{i + 1}.</span>
                  <span className="leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Assembled Mock Examination Paper */}
          <div className="p-5 sm:p-7 rounded-3xl bg-[#0A1222] border border-white/[0.14] space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  Assembled Statistical Mock Examination Paper
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                  {prediction.assembledPaper.title}
                </h3>
                <p className="text-xs text-[#A7B4C8]">
                  Full timed question set with formulas and step-by-step marking guidelines.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onSelectPaper(prediction.assembledPaper)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Practice in Viewer</span>
                </button>

                <button
                  onClick={(e) => onDownloadPaper(prediction.assembledPaper, e)}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Download Paper</span>
                </button>

                <button
                  onClick={() => setIsAddToProjectOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                  title="Attach this paper to a study project"
                >
                  <FolderPlus className="w-4 h-4 text-teal-400" />
                  <span>Save to Project</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white cursor-pointer"
                  title="Print examination paper"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Questions by Sections */}
            <div className="space-y-6">
              {prediction.assembledPaper.sections.map((section) => (
                <div key={section.id} className="space-y-4">
                  <div className="bg-[#101B2D]/80 p-3 sm:p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{section.name}: {section.title}</h4>
                      <p className="text-[11px] text-[#A7B4C8] mt-0.5">{section.instructions}</p>
                    </div>
                    <span className="font-mono text-xs text-cyan-300 font-bold shrink-0">
                      [{section.totalMarks} Marks]
                    </span>
                  </div>

                  <div className="space-y-3">
                    {section.questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] space-y-2.5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-xs sm:text-sm font-medium text-white leading-relaxed">
                            <span className="font-bold text-cyan-400 mr-2 font-mono">Q.{q.number}</span>
                            <span>{q.text}</span>
                          </div>
                          <span className="text-[11px] font-mono text-[#A7B4C8] shrink-0 font-semibold">
                            [{q.marks} Mark{q.marks > 1 ? 's' : ''}]
                          </span>
                        </div>

                        {/* Choices if MCQ */}
                        {q.choices && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-4">
                            {q.choices.map((c) => (
                              <div
                                key={c.key}
                                className="text-xs p-2 rounded-xl bg-[#0A1222] border border-white/[0.08] text-[#E2E8F0] flex items-center gap-2"
                              >
                                <span className="font-mono font-bold text-cyan-400">({c.key})</span>
                                <span>{c.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Formula or solution hint */}
                        {q.formula && (
                          <div className="text-[11px] font-mono text-teal-300 bg-teal-950/30 border border-teal-500/20 px-3 py-1.5 rounded-xl">
                            Formula: {q.formula}
                          </div>
                        )}
                        {q.solutionHint && (
                          <div className="text-[11px] text-[#A7B4C8] pl-2 border-l-2 border-cyan-400/40 italic">
                            Hint: {q.solutionHint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add To Project Modal */}
      {prediction && !prediction.hasInsufficientData && (
        <AddToProjectModal
          paper={prediction.assembledPaper}
          isOpen={isAddToProjectOpen}
          onClose={() => setIsAddToProjectOpen(false)}
          onSuccess={(projName) => {
            showToast(`Paper attached to ${projName}`);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#101B2D] text-[#F8FAFC] border border-white/[0.14] text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default ExamPredictorPage;
