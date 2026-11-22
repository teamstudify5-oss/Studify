import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  UploadCloud,
  X,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { workspaceService } from '../../services/workspaceService';
import {
  formatFileSize,
  validateNoteFileCandidate,
} from '../../services/noteAttachmentStore';
import { ProjectNoteAttachment } from '../../types/workspace';

export type NoteAttachInitialMode = 'camera' | 'upload';

interface StagedFileItem {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl?: string;
}

interface CameraNoteScannerModalProps {
  isOpen: boolean;
  initialMode?: NoteAttachInitialMode;
  projectId: string;
  projectTitle: string;
  isGuest: boolean;
  onClose: () => void;
  onSaved: (attachment: ProjectNoteAttachment) => void;
}

export const CameraNoteScannerModal: React.FC<CameraNoteScannerModalProps> = ({
  isOpen,
  initialMode = 'upload',
  projectId,
  projectTitle,
  isGuest,
  onClose,
  onSaved,
}) => {
  const [mode, setMode] = useState<NoteAttachInitialMode>(initialMode);
  const [noteTitle, setNoteTitle] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFileItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Camera state
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stagedFilesRef = useRef<StagedFileItem[]>([]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    stagedFilesRef.current = stagedFiles;
  }, [stagedFiles]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  };

  const clearAllStaged = () => {
    stagedFilesRef.current.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setStagedFiles([]);
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setNoteTitle('');
      setErrorMsg(null);
      setCameraError(null);
      clearAllStaged();
    } else {
      stopCameraStream();
      clearAllStaged();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  useEffect(() => {
    return () => {
      stopCameraStream();
      stagedFilesRef.current.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  useEffect(() => {
    if (!isOpen || mode !== 'camera') {
      stopCameraStream();
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Live camera preview is unavailable here. Use the "Capture Photo" button below to take or pick a photo.'
        );
        return;
      }

      stopCameraStream();
      setCameraStarting(true);
      setCameraError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraActive(true);
      } catch (err: any) {
        if (cancelled) return;
        const msg = String(err?.message || '').toLowerCase();
        setCameraError(
          msg.includes('denied') || msg.includes('permission')
            ? 'Camera permission was blocked. Allow camera access or use "Capture from Device" below.'
            : 'Could not open live camera preview. Use "Capture from Device" below to snap a photo.'
        );
      } finally {
        if (!cancelled) {
          setCameraStarting(false);
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [isOpen, mode, facingMode]);

  if (!isOpen) return null;

  const appendFiles = (incoming: FileList | File[]) => {
    setErrorMsg(null);
    const arr = Array.from(incoming || []);
    if (arr.length === 0) return;

    const currentHasPdf = stagedFiles.some((f) => f.mimeType === 'application/pdf');
    const incomingValidated: StagedFileItem[] = [];

    for (const file of arr) {
      const check = validateNoteFileCandidate(file);
      if (!check.valid) {
        setErrorMsg(check.error || 'Unsupported file.');
        return;
      }

      if (check.kind === 'pdf') {
        if (arr.length > 1 || stagedFiles.length > 0 || currentHasPdf) {
          setErrorMsg('Attach one PDF file at a time, or bundle multiple note photos together.');
          return;
        }
      } else if (currentHasPdf) {
        setErrorMsg('Remove the staged PDF first if you want to bundle handwritten note photos instead.');
        return;
      }

      const previewUrl =
        check.kind === 'image' ? URL.createObjectURL(file) : undefined;
      incomingValidated.push({
        id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        blob: file,
        fileName: file.name || (check.kind === 'pdf' ? 'study_notes.pdf' : 'note_page.jpg'),
        mimeType: check.mimeType,
        sizeBytes: file.size,
        previewUrl,
      });
    }

    const totalNext = stagedFiles.length + incomingValidated.length;
    if (totalNext > 12) {
      incomingValidated.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setErrorMsg('You can attach up to 12 photo pages per note bundle.');
      return;
    }

    if (!noteTitle.trim() && incomingValidated.length === 1 && incomingValidated[0].mimeType === 'application/pdf') {
      setNoteTitle(incomingValidated[0].fileName.replace(/\.pdf$/i, '').trim());
    }

    setStagedFiles((prev) => [...prev, ...incomingValidated]);
  };

  const handleCaptureFromVideo = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    if (stagedFiles.some((f) => f.mimeType === 'application/pdf')) {
      setErrorMsg('Remove the staged PDF first before capturing photo pages.');
      return;
    }
    if (stagedFiles.length >= 12) {
      setErrorMsg('Maximum 12 photos per note bundle.');
      return;
    }

    setErrorMsg(null);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    );
    if (!blob) {
      setErrorMsg('Could not capture photo frame. Please try again.');
      return;
    }

    const pageNum = stagedFiles.length + 1;
    const previewUrl = URL.createObjectURL(blob);
    setStagedFiles((prev) => [
      ...prev,
      {
        id: `cam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        blob,
        fileName: `note_photo_${pageNum}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: blob.size,
        previewUrl,
      },
    ]);
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleSave = async () => {
    if (stagedFiles.length === 0 || isSaving) return;

    setIsSaving(true);
    setErrorMsg(null);

    const res = await workspaceService.addProjectNoteAttachmentAsync(projectId, {
      title: noteTitle.trim() || undefined,
      files: stagedFiles.map((f) => ({
        blob: f.blob,
        fileName: f.fileName,
        mimeType: f.mimeType,
      })),
    });

    setIsSaving(false);

    if (res.error || !res.attachment) {
      setErrorMsg(res.error?.message || 'Could not save notes attachment. Please try again.');
      return;
    }

    stopCameraStream();
    clearAllStaged();
    onSaved(res.attachment);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-attachment-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-[var(--border-divider)] shadow-2xl overflow-hidden text-[var(--text-primary)] max-h-[90vh] flex flex-col"
        style={{ backgroundColor: 'var(--modal-bg)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-divider)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="note-attachment-modal-title"
              className="text-base font-bold text-[var(--text-primary)] truncate"
            >
              Back Up Notes to {projectTitle}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {isGuest
                ? 'Saved locally on this device · Sign in anytime to sync across devices'
                : 'Encrypted private cloud backup · Accessible from any device'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close attachment dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="px-5 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-divider)]">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('camera');
              }}
              className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'camera'
                  ? 'bg-[var(--surface-main)] text-[var(--text-primary)] shadow-xs border border-[var(--border-divider)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Take Note Photos</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('upload');
              }}
              className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'upload'
                  ? 'bg-[var(--surface-main)] text-[var(--text-primary)] shadow-xs border border-[var(--border-divider)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload PDF / Images</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 text-xs text-[var(--color-red)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title Field */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Note Title <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value.slice(0, 120))}
              placeholder="e.g., Electrostatics Handwritten Notes Ch. 1"
              disabled={isSaving}
              className="w-full px-3 py-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {mode === 'camera' ? (
            <div className="space-y-3">
              {/* Live Camera Viewfinder */}
              <div className="relative rounded-xl overflow-hidden bg-black/90 border border-[var(--border-divider)] aspect-[4/3] flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />

                {!cameraActive && (
                  <div className="p-5 text-center space-y-3 max-w-sm">
                    {cameraStarting ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-white/80 mx-auto" />
                        <p className="text-xs text-white/80">Opening camera...</p>
                      </>
                    ) : (
                      <>
                        <Camera className="w-7 h-7 text-white/75 mx-auto" />
                        <p className="text-xs text-white/85 leading-relaxed">
                          {cameraError || 'Camera preview unavailable.'}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {cameraActive && (
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                    }
                    className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-black/65 text-white text-[11px] font-medium flex items-center gap-1.5 hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Flip Camera</span>
                  </button>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {cameraActive && (
                  <button
                    type="button"
                    onClick={handleCaptureFromVideo}
                    disabled={isSaving || stagedFiles.length >= 12}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-opacity cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Page ({stagedFiles.length}/12)</span>
                  </button>
                )}

                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) appendFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  disabled={isSaving || stagedFiles.length >= 12}
                  className={`${
                    cameraActive ? '' : 'flex-1'
                  } min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap`}
                >
                  <ImageIcon className="w-4 h-4 text-[var(--accent-blue)]" />
                  <span>{cameraActive ? 'From Device' : 'Capture / Choose Photo'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) appendFiles(e.dataTransfer.files);
              }}
              className="rounded-xl border border-dashed border-[var(--border-hover)] bg-[var(--surface-secondary)]/55 p-6 text-center space-y-3"
            >
              <UploadCloud className="w-7 h-7 text-[var(--accent-blue)] mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Drop your Notes PDF or handwritten photos here
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Supports 1 PDF (up to 25 MB) or up to 12 PNG/JPG/WebP note pages
                </p>
              </div>

              <input
                ref={uploadInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) appendFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isSaving}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
              >
                Browse PDF or Photos
              </button>
            </div>
          )}

          {/* Staged Files / Captured Pages Preview */}
          {stagedFiles.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  Ready to Save ({stagedFiles.length}{' '}
                  {stagedFiles[0].mimeType === 'application/pdf'
                    ? 'PDF'
                    : stagedFiles.length === 1
                    ? 'photo'
                    : 'photos'}
                  )
                </span>
                <button
                  type="button"
                  onClick={clearAllStaged}
                  disabled={isSaving}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--color-red)] cursor-pointer whitespace-nowrap"
                >
                  Clear all
                </button>
              </div>

              {stagedFiles[0].mimeType === 'application/pdf' ? (
                <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-divider)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {stagedFiles[0].fileName}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                        PDF · {formatFileSize(stagedFiles[0].sizeBytes)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStaged(stagedFiles[0].id)}
                    disabled={isSaving}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-red)] cursor-pointer"
                    aria-label="Remove staged PDF"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {stagedFiles.map((item, idx) => (
                    <div
                      key={item.id}
                      className="relative group rounded-xl overflow-hidden border border-[var(--border-divider)] bg-[var(--surface-secondary)] aspect-[3/4]"
                    >
                      {item.previewUrl && (
                        <img
                          src={item.previewUrl}
                          alt={`Note page ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1 flex items-center justify-between text-[10px] text-white tabular-nums">
                        <span>Page {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaged(item.id)}
                          disabled={isSaving}
                          className="hover:text-red-300 cursor-pointer"
                          aria-label={`Remove page ${idx + 1}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border-divider)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-[var(--border-divider)] bg-[var(--surface-secondary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || stagedFiles.length === 0}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-2 transition-opacity cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isGuest ? 'Saving Locally...' : 'Backing Up...'}</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save to Project Notes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
