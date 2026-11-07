import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Download, BookOpen, ExternalLink, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
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
  const [currentImagePageIndex, setCurrentImagePageIndex] = useState<number>(0);

  // Multi-image collection
  const imageUrls: string[] = paper.imageUrls && paper.imageUrls.length > 0
    ? paper.imageUrls
    : (paper.isImageBased && paper.fileUrl ? [paper.fileUrl] : []);
  const isImagePaper = paper.isImageBased || imageUrls.length > 0 || /\.(png|jpe?g|webp|gif)$/i.test(paper.fileName || paper.fileUrl || '');

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
    setZoomLevel((prev) => Math.min(140, Math.max(75, prev + delta)));
  };

  const sections = paper.sections || [];
  const currentImageUrl = imageUrls.length > 0 ? imageUrls[currentImagePageIndex] : signedUrl;

  const hasMarks = typeof paper.totalMarks === 'number' && paper.totalMarks > 0;
  const hasDuration = typeof paper.timeAllowedMinutes === 'number' && paper.timeAllowedMinutes > 0;

  return (
    <div className="border border-[var(--border-divider)] rounded-2xl bg-[var(--surface-main)]/90 backdrop-blur-md overflow-hidden shadow-sm">
      {/* Top Floating Toolbar */}
      <div className="border-b border-[var(--border-divider)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--surface-elevated)]/80">
        <div className="text-[var(--text-primary)] truncate font-mono text-[11px] flex items-center gap-2">
          {isImagePaper ? (
            <Layers className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          ) : (
            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          )}
          <span>{paper.fileName || `${paper.subject}_${paper.year}`}</span>
          {isImagePaper && imageUrls.length > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-bold text-[10px]">
              Page {currentImagePageIndex + 1} of {imageUrls.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center border border-[var(--border-divider)] rounded-lg bg-[var(--surface-main)] overflow-hidden">
            <button
              type="button"
              onClick={() => handleZoom(-10)}
              disabled={zoomLevel <= 75}
              className="px-2.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-[var(--accent-blue)] font-bold select-none">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => handleZoom(10)}
              disabled={zoomLevel >= 140}
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
            className="px-3.5 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Reading Canvas */}
      <div className="p-4 sm:p-6 overflow-x-auto flex justify-center bg-black/5 dark:bg-black/30 min-h-[480px]">
        <div
          style={{ width: `${zoomLevel}%`, maxWidth: '860px' }}
          className="space-y-6 transition-all duration-150"
        >
          {sections.length > 0 && !isImagePaper ? (
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
                  {paper.subject} · Year {paper.year} {paper.eventName ? `· ${paper.eventName}` : ''}
                </div>
                {(hasMarks || hasDuration) && (
                  <div className="text-xs text-[var(--text-secondary)] flex justify-between font-mono tabular-nums border-t border-[var(--border-divider)] pt-2 px-1">
                    <span>{hasDuration ? `Duration: ${paper.timeAllowedMinutes! / 60} Hours` : ''}</span>
                    <span className="font-semibold text-[var(--text-primary)]">{hasMarks ? `Total Marks: ${paper.totalMarks}` : ''}</span>
                  </div>
                )}
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
                    {section.totalMarks && (
                      <span className="font-mono text-xs text-[var(--accent-green)] font-semibold">
                        {section.totalMarks} Marks
                      </span>
                    )}
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
                          {q.marks && (
                            <span className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded-md border border-[var(--border-divider)] shrink-0 font-semibold">
                              [{q.marks}M]
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : isImagePaper ? (
            /* ========================================================== */
            /* IMAGE-BASED QUESTION PAPER VIEWER (Multi-page photo reader) */
            /* ========================================================== */
            <div className="space-y-4">
              {/* Pagination controls top bar */}
              {imageUrls.length > 1 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentImagePageIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentImagePageIndex === 0}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] disabled:opacity-30 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous Page</span>
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[280px] sm:max-w-md py-1">
                    {imageUrls.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentImagePageIndex(idx)}
                        className={`w-7 h-7 rounded-lg font-mono text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                          currentImagePageIndex === idx
                            ? 'bg-[var(--accent-blue)] text-white'
                            : 'bg-[var(--surface-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-divider)]'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentImagePageIndex((prev) => Math.min(imageUrls.length - 1, prev + 1))}
                    disabled={currentImagePageIndex === imageUrls.length - 1}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] disabled:opacity-30 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Next Page</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Main Photo Render */}
              <div className="border border-[var(--border-divider)] rounded-2xl overflow-hidden bg-[var(--surface-main)] p-2 sm:p-4 flex flex-col items-center shadow-xs">
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={`${paper.title} - Page ${currentImagePageIndex + 1}`}
                    className="w-full h-auto rounded-xl object-contain max-h-[85vh] shadow-sm select-none"
                    loading="lazy"
                  />
                ) : (
                  <div className="py-20 text-center text-xs text-[var(--text-secondary)]">
                    Loading page photograph...
                  </div>
                )}
              </div>

              {/* Page Strip Thumbnails */}
              {imageUrls.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
                  {imageUrls.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentImagePageIndex(idx)}
                      className={`relative rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                        currentImagePageIndex === idx
                          ? 'border-[var(--accent-blue)] ring-2 ring-[var(--accent-blue)]/30 scale-105'
                          : 'border-[var(--border-divider)] hover:border-[var(--text-muted)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Page thumbnail ${idx + 1}`}
                        className="w-14 h-18 object-cover bg-[var(--surface-elevated)]"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white font-mono text-[9px] text-center py-0.5">
                        P.{idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Bottom Quick Links */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {currentImageUrl && (
                  <a
                    href={currentImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Open Full Page Photo</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download This Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* STANDARD PDF VIEWER                                       */
            /* ========================================================== */
            <div className="space-y-4">
              {loadingSignedUrl ? (
                <div className="py-16 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)]/90 backdrop-blur-md p-8 space-y-3">
                  <div className="w-5 h-5 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading document preview...</p>
                </div>
              ) : signedUrl ? (
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
                      className="px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-lg transition-all flex items-center gap-1.5"
                    >
                      <span>Open in New Window</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                    </a>
                    <button
                      type="button"
                      onClick={onDownload}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)]/90 backdrop-blur-md p-8 space-y-3">
                  <p>Document: {paper.fileName}</p>
                  <button
                    type="button"
                    onClick={onDownload}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-all cursor-pointer"
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
