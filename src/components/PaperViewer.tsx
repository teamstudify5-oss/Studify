import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Download, HelpCircle, BookOpen, Check } from 'lucide-react';
import { Paper } from '../types';
import { supabaseStorage } from '../services/supabaseStorage';

interface PaperViewerProps {
  paper: Paper;
  onDownload: () => void;
}

export const PaperViewer: React.FC<PaperViewerProps> = ({ paper, onDownload }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [revealedHints, setRevealedHints] = useState<{ [qId: string]: boolean }>({});
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState<boolean>(false);

  useEffect(() => {
    let isCurrent = true;
    if (paper.fileUrl) {
      setLoadingSignedUrl(true);
      supabaseStorage.getSignedFileUrl(paper.fileUrl)
        .then((url) => {
          if (isCurrent) {
            setSignedUrl(url);
            setLoadingSignedUrl(false);
          }
        })
        .catch(() => {
          if (isCurrent) setLoadingSignedUrl(false);
        });
    } else {
      setSignedUrl(null);
      setLoadingSignedUrl(false);
    }
    return () => {
      isCurrent = false;
    };
  }, [paper.fileUrl]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(130, Math.max(80, prev + delta)));
  };

  const toggleHint = (qId: string) => {
    setRevealedHints((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const sections = paper.sections || [];

  return (
    <div className="border border-white/[0.14] rounded-3xl bg-[#101B2D]/90 backdrop-blur-xl overflow-hidden text-[#F8FAFC] shadow-2xl shadow-cyan-950/20">
      {/* Floating Toolbar */}
      <div className="border-b border-white/[0.08] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 text-xs bg-[#0A1222]/80">
        <div className="text-[#A7B4C8] truncate font-mono text-[11px] flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span>{paper.fileName || `${paper.subject}_${paper.year}.pdf`}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-white/[0.1] rounded-xl bg-[#050914] overflow-hidden">
            <button
              onClick={() => handleZoom(-10)}
              disabled={zoomLevel <= 80}
              className="px-2.5 py-1 text-[#A7B4C8] hover:text-white disabled:opacity-30 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-[#A7B4C8] select-none">{zoomLevel}%</span>
            <button
              onClick={() => handleZoom(10)}
              disabled={zoomLevel >= 130}
              className="px-2.5 py-1 text-[#A7B4C8] hover:text-white disabled:opacity-30 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download button */}
          <button
            onClick={onDownload}
            className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-sm shadow-cyan-500/20 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Reading Canvas */}
      <div className="p-4 sm:p-8 overflow-x-auto flex justify-center bg-[#050914]/70">
        <div
          style={{ width: `${zoomLevel}%`, maxWidth: '820px' }}
          className="space-y-8 text-[#F8FAFC] transition-all duration-150"
        >
          {/* Document Header */}
          <div className="border border-white/[0.12] rounded-2xl p-6 bg-[#0A1222] text-center space-y-3 shadow-xl">
            <div className="text-[11px] font-mono text-cyan-400 tracking-widest uppercase font-semibold">
              Official Examination Material
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#F8FAFC]">
              {paper.examBoard} — {paper.grade}
            </h2>
            <div className="text-sm font-semibold text-[#A7B4C8]">
              {paper.subject} · Year {paper.year}
            </div>

            <div className="text-xs text-[#A7B4C8] flex justify-between font-mono border-t border-white/[0.08] pt-3 px-2">
              <span>Duration: {paper.timeAllowedMinutes / 60} Hours</span>
              <span>Total Marks: {paper.totalMarks}</span>
            </div>
          </div>

          {/* Sections and Questions */}
          {sections.length > 0 ? (
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.id} className="space-y-4">
                  <div className="border-b border-white/[0.08] pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-cyan-300">
                        {section.name} — {section.title}
                      </h3>
                      {section.instructions && (
                        <p className="text-xs text-[#A7B4C8] mt-0.5">{section.instructions}</p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-white/60">
                      {section.totalMarks} Marks
                    </span>
                  </div>

                  <div className="space-y-4">
                    {section.questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 sm:p-5 bg-[#0A1222] border border-white/[0.08] hover:border-cyan-400/30 rounded-2xl space-y-3 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="font-mono text-xs text-cyan-400 font-bold mt-0.5 shrink-0">
                              Q{q.number}.
                            </span>
                            <div className="space-y-2.5 flex-1">
                              <p className="text-sm text-[#F8FAFC] leading-relaxed">
                                {q.text}
                              </p>

                              {q.formula && (
                                <div className="text-xs font-mono bg-[#050914] p-2.5 border border-white/[0.08] rounded-xl text-teal-300">
                                  {q.formula}
                                </div>
                              )}

                              {q.choices && q.choices.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                                  {q.choices.map((c) => (
                                    <div
                                      key={c.key}
                                      className="p-2.5 bg-[#101B2D] border border-white/[0.06] rounded-xl flex items-center gap-2 text-[#A7B4C8]"
                                    >
                                      <span className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center justify-center font-mono font-bold text-[10px]">
                                        {c.key}
                                      </span>
                                      <span>{c.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {q.solutionHint && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleHint(q.id)}
                                    className="text-[11px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 transition-colors underline underline-offset-2"
                                  >
                                    <HelpCircle className="w-3.5 h-3.5" />
                                    <span>{revealedHints[q.id] ? 'Hide explanation' : 'Explain answer & solution'}</span>
                                  </button>
                                  {revealedHints[q.id] && (
                                    <div className="mt-2 p-3.5 bg-[#050914] border border-cyan-400/25 rounded-xl text-xs text-[#A7B4C8] leading-relaxed animate-in fade-in duration-150">
                                      <div className="text-[11px] text-cyan-300 font-semibold mb-1">Solution Breakdown:</div>
                                      {q.solutionHint}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <span className="font-mono text-xs text-[#A7B4C8] bg-[#050914] px-2 py-0.5 rounded-lg border border-white/[0.06] shrink-0">
                            [{q.marks}M]
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {loadingSignedUrl ? (
                <div className="py-16 text-center text-xs text-[#A7B4C8] border border-white/[0.08] rounded-2xl bg-[#0A1222] p-8 space-y-3">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Resolving secure document link for {paper.fileName}...</p>
                </div>
              ) : signedUrl ? (
                /\.(png|jpe?g|webp|gif)$/i.test(paper.fileName || paper.fileUrl || '') ? (
                  <div className="space-y-4">
                    <div className="border border-white/[0.1] rounded-2xl overflow-hidden bg-[#0A1222] p-3 flex justify-center shadow-xl">
                      <img
                        src={signedUrl}
                        alt={paper.title}
                        className="max-w-full h-auto rounded-xl object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#101B2D] hover:bg-[#15233D] border border-white/[0.12] rounded-xl transition-all"
                      >
                        Open Full Image
                      </a>
                      <button
                        onClick={onDownload}
                        className="px-4 py-2 text-xs font-semibold text-[#050914] bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download image</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border border-white/[0.1] rounded-2xl overflow-hidden bg-[#0A1222] shadow-xl">
                      <iframe
                        src={`${signedUrl}#toolbar=0`}
                        title={paper.fileName || paper.title}
                        className="w-full h-[620px] rounded-xl bg-white"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#101B2D] hover:bg-[#15233D] border border-white/[0.12] rounded-xl transition-all"
                      >
                        Open PDF in New Window
                      </a>
                      <button
                        onClick={onDownload}
                        className="px-4 py-2 text-xs font-semibold text-[#050914] bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download paper file</span>
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="py-12 text-center text-xs text-[#A7B4C8] border border-white/[0.08] rounded-2xl bg-[#0A1222] p-8 space-y-3">
                  <p>Uploaded document: {paper.fileName}</p>
                  <button
                    onClick={onDownload}
                    className="px-4 py-2 text-xs font-semibold text-[#050914] bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl transition-all"
                  >
                    Download paper file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
