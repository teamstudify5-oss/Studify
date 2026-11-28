import React, { useState, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Download,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Paper } from '../types';
import {
  COMMUNITY_BUCKET,
  parseStorageBucketAndPath,
  supabaseStorage,
} from '../services/supabaseStorage';

interface PaperViewerProps {
  paper: Paper;
  onDownload: () => void;
  isDownloading?: boolean;
}

async function resolvePreviewBlobUrl(rawTarget: string): Promise<{ url: string; isObjectUrl: boolean }> {
  if (rawTarget.startsWith('blob:') || rawTarget.startsWith('data:')) {
    return { url: rawTarget, isObjectUrl: false };
  }

  const parsed = parseStorageBucketAndPath(rawTarget, COMMUNITY_BUCKET);
  if (parsed && parsed.isSupabaseStorage) {
    const direct = await supabaseStorage.downloadStorageBlob(rawTarget, COMMUNITY_BUCKET);
    if (direct.blob && !direct.error) {
      return { url: URL.createObjectURL(direct.blob), isObjectUrl: true };
    }

    const signed = await supabaseStorage.getSignedFileUrl(rawTarget, 300, {
      defaultBucket: parsed.bucket,
    });
    if (signed) {
      return { url: signed, isObjectUrl: false };
    }

    throw direct.error || new Error('Document preview could not be loaded from private storage.');
  }

  return { url: rawTarget, isObjectUrl: false };
}

export const PaperViewer: React.FC<PaperViewerProps> = ({
  paper,
  onDownload,
  isDownloading = false,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [resolvedImageUrls, setResolvedImageUrls] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [currentImagePageIndex, setCurrentImagePageIndex] = useState<number>(0);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const rawImageTargets: string[] =
    paper.imagePaths && paper.imagePaths.length > 0
      ? paper.imagePaths.filter(Boolean)
      : paper.imageUrls && paper.imageUrls.length > 0
      ? paper.imageUrls.filter(Boolean)
      : paper.isImageBased && (paper.filePath || paper.fileUrl)
      ? [paper.filePath || paper.fileUrl!]
      : [];

  const isImagePaper =
    paper.isImageBased ||
    rawImageTargets.length > 0 ||
    /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(paper.fileName || paper.fileUrl || paper.filePath || '');

  const primaryPdfTarget = !isImagePaper ? paper.filePath || paper.fileUrl || null : null;
  const serializedImagesKey = rawImageTargets.join('|');

  useEffect(() => {
    setCurrentImagePageIndex(0);
  }, [paper.id]);

  useEffect(() => {
    let active = true;
    const createdObjectUrls: string[] = [];

    const loadPreview = async () => {
      setPreviewError(null);

      if (isImagePaper && rawImageTargets.length > 0) {
        setLoadingPreview(true);
        try {
          const settled = await Promise.all(
            rawImageTargets.map(async (target) => {
              const res = await resolvePreviewBlobUrl(target);
              if (res.isObjectUrl) createdObjectUrls.push(res.url);
              return res.url;
            })
          );
          if (active) {
            setResolvedImageUrls(settled);
            setPreviewPdfUrl(null);
            setLoadingPreview(false);
          } else {
            createdObjectUrls.forEach((u) => URL.revokeObjectURL(u));
          }
        } catch (err: any) {
          createdObjectUrls.forEach((u) => URL.revokeObjectURL(u));
          if (active) {
            setResolvedImageUrls([]);
            setPreviewError(err?.message || 'Unable to load paper images.');
            setLoadingPreview(false);
          }
        }
        return;
      }

      if (primaryPdfTarget) {
        setLoadingPreview(true);
        try {
          const res = await resolvePreviewBlobUrl(primaryPdfTarget);
          if (res.isObjectUrl) createdObjectUrls.push(res.url);
          if (active) {
            setPreviewPdfUrl(res.url);
            setResolvedImageUrls([]);
            setLoadingPreview(false);
          } else {
            createdObjectUrls.forEach((u) => URL.revokeObjectURL(u));
          }
        } catch (err: any) {
          createdObjectUrls.forEach((u) => URL.revokeObjectURL(u));
          if (active) {
            setPreviewPdfUrl(null);
            setPreviewError(err?.message || 'Unable to load embedded PDF preview.');
            setLoadingPreview(false);
          }
        }
        return;
      }

      setPreviewPdfUrl(null);
      setResolvedImageUrls([]);
      setLoadingPreview(false);
    };

    loadPreview();

    return () => {
      active = false;
      createdObjectUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore revoke failure
        }
      });
    };
  }, [paper.id, isImagePaper, primaryPdfTarget, serializedImagesKey, reloadNonce]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(140, Math.max(75, prev + delta)));
  };

  const handleRetryPreview = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const sections = paper.sections || [];
  const hasStructuredTextQuestions =
    !isImagePaper &&
    Array.isArray(sections) &&
    sections.some((s) => Array.isArray(s.questions) && s.questions.length > 0);
  const currentImageUrl =
    resolvedImageUrls.length > 0 ? resolvedImageUrls[currentImagePageIndex] || resolvedImageUrls[0] : null;

  const hasMarks = typeof paper.totalMarks === 'number' && paper.totalMarks > 0;
  const hasDuration = typeof paper.timeAllowedMinutes === 'number' && paper.timeAllowedMinutes > 0;

  const downloadLabel = isDownloading
    ? 'Preparing Download...'
    : isImagePaper
    ? rawImageTargets.length > 1
      ? 'Download All (.zip)'
      : 'Download Photo'
    : 'Download PDF';

  const footerDownloadLabel = isDownloading
    ? 'Preparing Download...'
    : isImagePaper
    ? rawImageTargets.length > 1
      ? 'Download All Pages (.zip)'
      : 'Download Photo'
    : 'Download PDF';

  return (
    <div className="border border-[var(--border-divider)] rounded-2xl bg-[var(--surface-main)] overflow-hidden shadow-xs">
      {/* Top Toolbar */}
      <div className="border-b border-[var(--border-divider)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--surface-elevated)]">
        <div className="text-[var(--text-primary)] truncate font-mono text-[11px] flex items-center gap-2">
          {isImagePaper ? (
            <Layers className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          ) : (
            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
          )}
          <span>{paper.fileName || `${paper.subject}_${paper.year}`}</span>
          {isImagePaper && rawImageTargets.length > 1 && (
            <span className="text-[var(--accent-blue)] font-semibold tabular-nums text-[11px]">
              · Page {currentImagePageIndex + 1} of {rawImageTargets.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
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
            <span className="px-1.5 font-mono tabular-nums text-[11px] text-[var(--accent-blue)] font-bold select-none">
              {zoomLevel}%
            </span>
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

          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="px-3.5 py-1.5 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] font-semibold text-xs rounded-lg transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadLabel}</span>
          </button>
        </div>
      </div>

      {/* Reading Canvas */}
      <div className="p-4 sm:p-6 overflow-x-auto flex justify-center bg-black/5 dark:bg-black/30 min-h-[480px]">
        <div
          style={{ width: `${zoomLevel}%`, maxWidth: '860px' }}
          className="space-y-6 transition-all duration-150"
        >
          {hasStructuredTextQuestions ? (
            <div className="space-y-4">
              <div className="border border-[var(--border-divider)] rounded-xl p-5 bg-[var(--surface-main)] text-center space-y-2 shadow-xs">
                <div className="text-[11px] font-mono text-[var(--accent-blue)] uppercase tracking-wider font-semibold">
                  Authentic Examination Paper
                </div>
                <h2 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  {paper.examBoard} — {paper.grade}
                </h2>
                <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                  {paper.subject} · Year {paper.year} {paper.eventName ? `· ${paper.eventName}` : ''}
                </div>
                {(hasMarks || hasDuration) && (
                  <div className="text-xs text-[var(--text-secondary)] flex justify-between font-mono tabular-nums border-t border-[var(--border-divider)] pt-2 px-1">
                    <span>{hasDuration ? `Duration: ${paper.timeAllowedMinutes! / 60} Hours` : ''}</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {hasMarks ? `Total Marks: ${paper.totalMarks}` : ''}
                    </span>
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
                        className="p-4 bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl space-y-2"
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
            <div className="space-y-4">
              {rawImageTargets.length > 1 && (
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
                    {rawImageTargets.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentImagePageIndex(idx)}
                        className={`w-7 h-7 rounded-lg font-mono tabular-nums text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                          currentImagePageIndex === idx
                            ? 'bg-[var(--accent-blue)] text-white dark:text-[#0A2640]'
                            : 'bg-[var(--surface-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-divider)]'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentImagePageIndex((prev) => Math.min(rawImageTargets.length - 1, prev + 1))
                    }
                    disabled={currentImagePageIndex === rawImageTargets.length - 1}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-main)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] disabled:opacity-30 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Next Page</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="border border-[var(--border-divider)] rounded-2xl overflow-hidden bg-[var(--surface-main)] p-2 sm:p-4 flex flex-col items-center shadow-xs">
                {loadingPreview ? (
                  <div className="py-20 text-center text-xs text-[var(--text-secondary)] space-y-3">
                    <div className="w-5 h-5 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p>Loading private document photograph...</p>
                  </div>
                ) : previewError ? (
                  <div className="py-16 text-center text-xs text-[var(--color-red)] space-y-3">
                    <AlertCircle className="w-6 h-6 mx-auto" />
                    <p>{previewError}</p>
                    <button
                      type="button"
                      onClick={handleRetryPreview}
                      className="px-3 py-1.5 border border-[var(--border-divider)] rounded-lg text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Preview</span>
                    </button>
                  </div>
                ) : currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={`${paper.title} - Page ${currentImagePageIndex + 1}`}
                    className="w-full h-auto rounded-xl object-contain max-h-[85vh] shadow-sm select-none"
                  />
                ) : (
                  <div className="py-20 text-center text-xs text-[var(--text-secondary)]">
                    No preview photograph available.
                  </div>
                )}
              </div>

              {resolvedImageUrls.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
                  {resolvedImageUrls.map((url, idx) => (
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

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={isDownloading}
                  className="px-4 py-2 text-xs font-semibold text-white dark:text-[#0A2640] bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{footerDownloadLabel}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {loadingPreview ? (
                <div className="py-16 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-8 space-y-3">
                  <div className="w-5 h-5 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading embedded PDF preview...</p>
                </div>
              ) : previewPdfUrl ? (
                <div className="space-y-3">
                  <div className="border border-[var(--border-divider)] rounded-xl overflow-hidden bg-[var(--surface-main)]">
                    <iframe
                      src={`${previewPdfUrl}#toolbar=0`}
                      title={paper.fileName || paper.title}
                      className="w-full h-[620px] rounded-lg bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={onDownload}
                      disabled={isDownloading}
                      className="px-4 py-2 text-xs font-semibold text-white dark:text-[#0A2640] bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{footerDownloadLabel}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-8 space-y-3">
                  <p>{previewError || `Document: ${paper.fileName}`}</p>
                  <div className="flex items-center justify-center gap-2">
                    {previewError && (
                      <button
                        type="button"
                        onClick={handleRetryPreview}
                        className="px-3.5 py-2 text-xs font-medium border border-[var(--border-divider)] rounded-lg text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Preview</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onDownload}
                      disabled={isDownloading}
                      className="px-4 py-2 text-xs font-semibold text-white dark:text-[#0A2640] bg-[var(--accent-blue)] hover:opacity-90 rounded-lg transition-opacity cursor-pointer disabled:opacity-60"
                    >
                      {footerDownloadLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
