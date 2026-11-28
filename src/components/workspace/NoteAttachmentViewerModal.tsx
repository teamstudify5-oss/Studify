import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { ProjectNoteAttachment } from '../../types/workspace';
import { noteAttachmentStore, formatFileSize } from '../../services/noteAttachmentStore';
import { APP_BUCKET, supabaseStorage } from '../../services/supabaseStorage';

interface NoteAttachmentViewerModalProps {
  attachment: ProjectNoteAttachment | null;
  onClose: () => void;
}

export async function resolveAttachmentPageBlob(page: {
  localBlobKey?: string;
  storagePath?: string;
  storageBucket?: string;
}): Promise<{ blob: Blob | null; error: string | null }> {
  if (page.localBlobKey) {
    const local = await noteAttachmentStore.getLocalBlob(page.localBlobKey);
    if (local) return { blob: local, error: null };
  }

  if (page.storagePath) {
    const res = await supabaseStorage.downloadStorageBlob(
      page.storagePath,
      page.storageBucket || APP_BUCKET
    );
    if (res.blob && !res.error) {
      return { blob: res.blob, error: null };
    }
    return {
      blob: null,
      error: res.error?.message || 'Could not load note file from cloud storage.',
    };
  }

  return {
    blob: null,
    error: 'Note file could not be located on this device or in cloud storage.',
  };
}

export const NoteAttachmentViewerModal: React.FC<NoteAttachmentViewerModalProps> = ({
  attachment,
  onClose,
}) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setPageIndex(0);
  }, [attachment?.id]);

  useEffect(() => {
    if (!attachment) return;
    const pages = attachment.pages || [];
    const page = pages[pageIndex];
    if (!page) {
      setObjectUrl(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setIsLoading(true);
    setLoadError(null);
    setObjectUrl(null);

    resolveAttachmentPageBlob(page).then((res) => {
      if (!active) return;
      setIsLoading(false);
      if (res.blob) {
        createdUrl = URL.createObjectURL(res.blob);
        setObjectUrl(createdUrl);
      } else {
        setLoadError(res.error || 'Could not display attachment.');
      }
    });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [attachment, pageIndex]);

  useEffect(() => {
    if (!attachment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && pageIndex < attachment.pages.length - 1) {
        setPageIndex((p) => p + 1);
      }
      if (e.key === 'ArrowLeft' && pageIndex > 0) {
        setPageIndex((p) => p - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachment, pageIndex, onClose]);

  if (!attachment) return null;

  const pages = attachment.pages || [];
  const currentPage = pages[pageIndex];
  const isPdf = attachment.kind === 'pdf' || currentPage?.mimeType === 'application/pdf';

  const handleDownloadCurrent = async () => {
    if (!currentPage) return;
    const res = await resolveAttachmentPageBlob(currentPage);
    if (!res.blob) {
      setLoadError(res.error || 'Download failed.');
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentPage.fileName || `${attachment.title}.${isPdf ? 'pdf' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-viewer-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl border border-[var(--border-divider)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text-primary)]"
        style={{ backgroundColor: 'var(--modal-bg)' }}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-divider)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="note-viewer-title" className="font-display text-sm sm:text-base font-bold truncate">
              {attachment.title}
            </h3>
            {currentPage && (
              <p className="text-xs text-[var(--text-secondary)] tabular-nums truncate">
                {isPdf ? 'PDF Document' : `Page ${pageIndex + 1} of ${pages.length}`} ·{' '}
                {currentPage.fileName} · {formatFileSize(currentPage.sizeBytes)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadCurrent}
              disabled={!currentPage}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewer Stage */}
        <div className="flex-1 bg-[var(--surface-secondary)]/70 flex items-center justify-center p-4 overflow-auto min-h-[340px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-blue)]" />
              <span>Loading note file...</span>
            </div>
          ) : loadError ? (
            <div className="max-w-md p-4 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
          ) : objectUrl ? (
            isPdf ? (
              <div className="w-full h-[65vh] flex flex-col gap-2">
                <iframe
                  title={attachment.title}
                  src={objectUrl}
                  className="w-full flex-1 rounded-xl border border-[var(--border-divider)] bg-white"
                />
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>If inline preview doesn&apos;t render on your browser, click Download above.</span>
                  </span>
                </div>
              </div>
            ) : (
              <img
                src={objectUrl}
                alt={`${attachment.title} page ${pageIndex + 1}`}
                className="max-w-full max-h-[68vh] object-contain rounded-xl border border-[var(--border-divider)] bg-black/5"
              />
            )
          ) : null}
        </div>

        {/* Multi-page navigation footer */}
        {pages.length > 1 && (
          <div className="px-5 py-3 border-t border-[var(--border-divider)] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-secondary)] text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
              Page {pageIndex + 1} / {pages.length}
            </span>
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
              disabled={pageIndex >= pages.length - 1}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-secondary)] text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
