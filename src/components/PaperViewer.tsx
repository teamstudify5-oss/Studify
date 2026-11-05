import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Download, BookOpen, ExternalLink } from 'lucide-react';
import { Paper } from '../types';
import { supabaseStorage } from '../services/supabaseStorage';

interface PaperViewerProps {
  paper: Paper;
  onDownload: () => void;
}

export const PaperViewer: React.FC<PaperViewerProps> = ({ paper, onDownload }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState<boolean>(false);

  useEffect(() => {
    let isCurrent = true;
    if (paper.fileUrl) {
      if (paper.fileUrl.startsWith('http://') || paper.fileUrl.startsWith('https://') || paper.fileUrl.startsWith('blob:')) {
        setSignedUrl(paper.fileUrl);
        setLoadingSignedUrl(false);
        return;
      }

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

  const sections = paper.sections || [];

  return (
    <div className="border border-[var(--border-divider)] rounded-2xl bg-[var(--surface-main)]/90 backdrop-blur-md overflow-hidden shadow-sm">
      {/* Minimal Top Floating Toolbar */}
      <div className="border-b border-[var(--border-divider)] px-4 py-3 flex items-center justify-between gap-3 text-xs bg-[var(--surface-elevated)]/80">
        <div className="text-[var(--text-primary)] truncate font-mono text-[11px] flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          <span>{paper.fileName || `${paper.subject}_${paper.year}.pdf`}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-[var(--border-divider)] rounded-lg bg-[var(--surface-main)] overflow-hidden">
            <button
              type="button"
              onClick={() => handleZoom(-10)}
              disabled={zoomLevel <= 80}
              className="px-2.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-[var(--accent-blue)] font-bold select-none">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => handleZoom(10)}
              disabled={zoomLevel >= 130}
              className="px-2.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download button */}
          <button
            type="button"
            onClick={onDownload}
            className="px-3.5 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer btn-quad-border"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Reading Canvas */}
      <div className="p-4 sm:p-6 overflow-x-auto flex justify-center bg-black/10 dark:bg-black/30 min-h-[480px]">
        <div
          style={{ width: `${zoomLevel}%`, maxWidth: '820px' }}
          className="space-y-6 transition-all duration-150"
        >
          {sections.length > 0 ? (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="border border-[var(--border-divider)] rounded-xl p-5 bg-[var(--surface-main)]/90 backdrop-blur-md text-center space-y-2 shadow-xs">
                <div className="text-[11px] font-mono text-[var(--accent-blue)] uppercase tracking-wider font-semibold">
                  Authentic Examination Paper
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  {paper.examBoard} — {paper.grade}
                </h2>
                <div className="text-xs text-[var(--text-secondary)]">
                  {paper.subject} · Year {paper.year}
                </div>
                <div className="text-xs text-[var(--text-secondary)] flex justify-between font-mono tabular-nums border-t border-[var(--border-divider)] pt-2 px-1">
                  <span>Duration: {paper.timeAllowedMinutes / 60} Hours</span>
                  <span className="font-semibold text-[var(--text-primary)]">Total Marks: {paper.totalMarks}</span>
                </div>
              </div>

              {sections.map((section) => (
                <div key={section.id} className="space-y-3">
                  <div className="border-b border-[var(--border-divider)] pb-1.5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)]">
                        {section.name} — {section.title}
                      </h3>
                      {section.instructions && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{section.instructions}</p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-[var(--accent-green)] font-semibold">
                      {section.totalMarks} Marks
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {section.questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 bg-[var(--surface-main)]/90 backdrop-blur-md border border-[var(--border-divider)] rounded-xl space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="font-mono text-xs text-[var(--accent-blue)] font-bold shrink-0">
                              Q{q.number}.
                            </span>
                            <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                              {q.text}
                            </p>
                          </div>
                          <span className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-md border border-[var(--border-divider)] shrink-0 font-semibold">
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
                <div className="py-16 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)]/90 backdrop-blur-md p-8 space-y-3">
                  <div className="w-5 h-5 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading document preview...</p>
                </div>
              ) : signedUrl ? (
                /\.(png|jpe?g|webp|gif)$/i.test(paper.fileName || paper.fileUrl || '') ? (
                  <div className="space-y-3">
                    <div className="border border-[var(--border-divider)] rounded-xl overflow-hidden bg-[var(--surface-main)]/90 backdrop-blur-md p-2 flex justify-center">
                      <img
                        src={signedUrl}
                        alt={paper.title}
                        className="max-w-full h-auto rounded-lg object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-lg transition-all flex items-center gap-1.5 btn-quad-border"
                      >
                        <span>Open Full Image</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                      </a>
                      <button
                        type="button"
                        onClick={onDownload}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer btn-quad-border"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="border border-[var(--border-divider)] rounded-xl overflow-hidden bg-[var(--surface-main)]/90 backdrop-blur-md">
                      <iframe
                        src={`${signedUrl}#toolbar=0`}
                        title={paper.fileName || paper.title}
                        className="w-full h-[620px] rounded-lg bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-lg transition-all flex items-center gap-1.5 btn-quad-border"
                      >
                        <span>Open in New Window</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                      </a>
                      <button
                        type="button"
                        onClick={onDownload}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer btn-quad-border"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)]/90 backdrop-blur-md p-8 space-y-3">
                  <p>Document: {paper.fileName}</p>
                  <button
                    type="button"
                    onClick={onDownload}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-all cursor-pointer btn-quad-border"
                  >
                    Download File
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
