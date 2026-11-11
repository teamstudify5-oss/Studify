import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, Lock, AlertCircle, X, Camera } from 'lucide-react';
import { ExamBoard, GradeLevel, Paper } from '../types';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { EXAM_BOARDS, GRADE_LEVELS } from '../data/samplePapers';
import { supabase } from '../supabaseClient.js';
import { communityPyqService } from '../services/communityPyqService';
import { downloadQuotaService, DownloadQuota } from '../services/downloadQuotaService';

interface UploadPageProps {
  onPaperSubmitted: (newPaper: Paper) => void;
  onNavigateToSubmissions: () => void;
  onNavigateToBrowse?: () => void;
  onRedirectToLogin?: () => void;
}

interface SelectedPhotoItem {
  id: string;
  file: File;
  previewUrl: string;
}

export const UploadPage: React.FC<UploadPageProps> = ({
  onPaperSubmitted,
  onNavigateToSubmissions,
  onNavigateToBrowse,
  onRedirectToLogin,
}) => {
  const { currentUser, isAuthenticated, openAuthModal } = useAuth();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (window.location.pathname !== '/login') {
          window.history.pushState(null, '', '/login');
        }
        if (onRedirectToLogin) {
          onRedirectToLogin();
        } else {
          window.location.href = '/login';
        }
      }
    });
  }, [onRedirectToLogin]);

  // Upload method: 'pdf' or 'images'
  const [uploadMethod, setUploadMethod] = useState<'pdf' | 'images'>('pdf');

  // Essential metadata fields only
  const [examBoard, setExamBoard] = useState<ExamBoard>('CBSE');
  const [grade, setGrade] = useState<GradeLevel>('Class 12');
  const [subject, setSubject] = useState('Physics');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [title, setTitle] = useState('');

  // Single PDF upload state
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [actualFile, setActualFile] = useState<File | null>(null);

  // Simple multi-image upload state (no page tabs, no page management)
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhotoItem[]>([]);

  // Submission & quota state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRightsConfirmed, setHasRightsConfirmed] = useState(false);

  // Quota & contribution tracking
  const [quota, setQuota] = useState<DownloadQuota | null>(null);
  const [unlockCelebration, setUnlockCelebration] = useState<string | null>(null);

  useEffect(() => {
    downloadQuotaService.getQuota().then(setQuota);
  }, []);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      selectedPhotos.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [selectedPhotos]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl flex items-center justify-center mx-auto text-[var(--accent-blue)] shadow-xs">
          <Lock className="w-5 h-5 text-[var(--accent-blue)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Sign in to upload papers
        </h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
          You need an account to upload papers and share study resources with fellow students.
        </p>
        <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="w-full py-2.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
          >
            Sign In to Studify
          </button>
        </div>
      </div>
    );
  }

  // Handle PDF file selection
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 25MB limit.');
        return;
      }

      const check = await downloadQuotaService.validatePdfMagicBytes(file);
      if (!check.isValid) {
        setErrorMessage(check.error || 'The selected file is not a valid PDF document.');
        setSelectedFile(null);
        setActualFile(null);
        return;
      }

      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type,
      });
      setActualFile(file);
      setErrorMessage(null);
    }
  };

  // Add photographs from file picker or camera
  const handleAddPhotoFiles = (files: FileList | File[]) => {
    const newItems: SelectedPhotoItem[] = [];
    const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (!ALLOWED_EXTENSIONS.includes(ext) && !file.type.startsWith('image/')) {
        setErrorMessage(`"${file.name}" has an unsupported format. Only JPG, PNG, and WEBP photographs are permitted.`);
        continue;
      }

      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage(`Photograph "${file.name}" exceeds the 15MB limit.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        previewUrl,
      });
    }

    if (selectedPhotos.length + newItems.length > 25) {
      setErrorMessage('A maximum of 25 photographs can be uploaded per paper.');
      return;
    }

    setSelectedPhotos((prev) => [...prev, ...newItems]);
    setErrorMessage(null);
  };

  // Remove a photograph by id
  const handleRemovePhoto = (idToRemove: string) => {
    setSelectedPhotos((prev) => {
      const target = prev.find((p) => p.id === idToRemove);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== idToRemove);
    });
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please provide a paper title.');
      return;
    }

    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setErrorMessage('Please enter the subject name.');
      return;
    }

    const numericYear = Number(year);
    if (!numericYear || isNaN(numericYear) || numericYear < 1980 || numericYear > 2035) {
      setErrorMessage('Please enter a valid examination year (e.g. 2024).');
      return;
    }

    if (uploadMethod === 'pdf') {
      if (!selectedFile || !actualFile) {
        setErrorMessage('Please select a PDF document to upload.');
        return;
      }
    } else {
      if (selectedPhotos.length === 0) {
        setErrorMessage('Please add at least one photograph of the question paper.');
        return;
      }
    }

    if (!hasRightsConfirmed) {
      setErrorMessage('Please confirm that you have the right to share this educational past paper with the student community.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(
      uploadMethod === 'images'
        ? `Uploading ${selectedPhotos.length} ${selectedPhotos.length === 1 ? 'photograph' : 'photographs'}...`
        : 'Uploading PDF to storage...'
    );

    try {
      const { paper, error } = await communityPyqService.uploadCommunityPyq({
        isImageBased: uploadMethod === 'images',
        files: uploadMethod === 'images' ? selectedPhotos.map((p) => p.file) : undefined,
        file: uploadMethod === 'pdf' ? (actualFile || undefined) : undefined,
        fileName: uploadMethod === 'pdf' ? selectedFile?.name : `${selectedPhotos.length} Pages (Images)`,
        title: trimmedTitle,
        subject: trimmedSubject,
        examBoard,
        grade,
        year: numericYear,
        uploaderDisplayName: currentUser?.name || 'Academic Contributor',
      });

      if (error || !paper) {
        throw error || new Error('Upload could not be processed.');
      }

      // If user uploaded a valid PDF, credit contribution
      if (uploadMethod === 'pdf' && actualFile) {
        const hash = await downloadQuotaService.computeFileHash(actualFile);
        const contrib = await downloadQuotaService.recordPdfContribution(hash, paper.id);

        if (contrib.unlocked) {
          setUnlockCelebration('Contribution Goal Completed! You uploaded 2 valid PDFs. 10 new downloads unlocked!');
        } else if (contrib.success) {
          setUnlockCelebration('1/2 PDFs uploaded! Upload 1 more unique PDF to unlock your next 10 downloads.');
        }
        setQuota(contrib.quota);
      }

      storageService.savePaper(paper);
      onPaperSubmitted(paper);

      setUploadProgress(null);
      setIsSubmitting(false);
      setSubmissionSuccess(true);
    } catch (err: any) {
      console.error('Error submitting paper:', err);
      setErrorMessage(err.message || 'Failed to upload paper. Please check your network and try again.');
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  if (submissionSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-[var(--accent-green-bg)] text-[var(--color-green)] rounded-xl flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Paper Published Successfully!
        </h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
          Your document is now available in the public library for fellow students to study, review, and practice.
        </p>

        {unlockCelebration ? (
          <div className="p-3 bg-[var(--color-green)]/15 border border-[var(--color-green)]/30 rounded-xl text-xs text-[var(--color-green)] font-medium text-center">
            {unlockCelebration}
          </div>
        ) : quota ? (
          <div className="p-2.5 bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-xl text-xs text-[var(--text-secondary)] font-mono text-center">
            Download Unlock Progress: {quota.currentCycleUploads}/2 PDFs uploaded
          </div>
        ) : null}

        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
          {onNavigateToBrowse && (
            <button
              type="button"
              onClick={onNavigateToBrowse}
              className="px-4 py-2 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
            >
              Browse Library
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateToSubmissions}
            className="px-4 py-2 bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            My Materials
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmissionSuccess(false);
              setSelectedFile(null);
              setActualFile(null);
              selectedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
              setSelectedPhotos([]);
              setTitle('');
              setHasRightsConfirmed(false);
              setErrorMessage(null);
            }}
            className="px-4 py-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Upload Question Paper
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Share previous year questions and practice sets with the community.
        </p>
      </div>

      {quota && (
        <div className="p-3.5 rounded-2xl bg-[var(--surface-main)]/90 border border-[var(--border-divider)] shadow-xs flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <span>PDF Contribution Progress:</span>
              <span className="font-mono text-[var(--accent-blue)] font-bold">{quota.currentCycleUploads}/2 uploaded</span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Upload 2 unique PDFs to unlock 10 more downloads. (Downloads remaining: {quota.remainingDownloads})
            </div>
          </div>
          <div className="text-right font-mono text-[11px] font-bold text-[var(--color-yellow)]">
            {quota.currentCycleUploads === 2 ? 'Unlocked' : `${2 - quota.currentCycleUploads} more needed`}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 rounded-xl text-xs text-[var(--color-red)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Form Container */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 sm:p-6 shadow-xs">
        {/* Method Toggle: PDF vs Photographs */}
        <div className="flex rounded-xl bg-[var(--surface-elevated)] p-1 border border-[var(--border-divider)] mb-4">
          <button
            type="button"
            onClick={() => {
              setUploadMethod('pdf');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              uploadMethod === 'pdf'
                ? 'bg-[var(--accent-blue)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload PDF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadMethod('images');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              uploadMethod === 'images'
                ? 'bg-[var(--accent-blue)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Upload Photographs</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Metadata Grid: Exam Board and Class Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Exam Board / Organization */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Exam Board / Organization
              </label>
              <select
                value={examBoard}
                onChange={(e) => setExamBoard(e.target.value as ExamBoard)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                {EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Class / Grade Level */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Class / Grade Level
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as GradeLevel)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject and Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Subject Name */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics, Mathematics, Science"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                required
              />
            </div>

            {/* Examination Year */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Examination Year *
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={1980}
                max={2035}
                placeholder="e.g. 2024"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                required
              />
            </div>
          </div>

          {/* Paper Title (Required, clean empty default) */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Paper Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Examination 2024"
              className="w-full px-3 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              required
            />
          </div>

          {/* ============================================================== */}
          {/* FILE SELECTION: SINGLE PDF UPLOAD                              */}
          {/* ============================================================== */}
          {uploadMethod === 'pdf' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Select PDF Document *
              </label>

              <div className="border border-dashed border-[var(--border-divider)] hover:border-[var(--accent-blue)] rounded-xl p-5 text-center bg-[var(--surface-elevated)] transition-colors cursor-pointer">
                <input
                  type="file"
                  id="pdf-file-input"
                  accept=".pdf"
                  onChange={handlePdfChange}
                  className="hidden"
                />
                <label htmlFor="pdf-file-input" className="cursor-pointer block">
                  <UploadCloud className="w-6 h-6 text-[var(--accent-blue)] mx-auto mb-1.5" />
                  {selectedFile ? (
                    <div>
                      <span className="font-semibold text-[var(--text-primary)] block text-xs">{selectedFile.name}</span>
                      <span className="text-[var(--color-green)] text-[11px] mt-0.5 block font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready to upload
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[var(--accent-blue)] font-medium underline text-xs">Choose PDF file</span>
                      <span className="text-[var(--text-muted)] text-[11px] block mt-0.5">
                        Supported format: PDF document (up to 25MB)
                      </span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* FILE SELECTION: MULTIPLE PHOTOGRAPHS                           */}
          {/* ============================================================== */}
          {uploadMethod === 'images' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Select Photographs (Camera / Gallery) *
              </label>

              {/* Photo Input Controls: Camera & Device Gallery */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Take Photo with Phone Camera */}
                <div className="border border-dashed border-[var(--border-divider)] hover:border-[var(--accent-blue)] rounded-xl p-3.5 text-center bg-[var(--surface-elevated)] transition-colors cursor-pointer">
                  <input
                    type="file"
                    id="camera-photo-input"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      if (e.target.files) handleAddPhotoFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <label htmlFor="camera-photo-input" className="cursor-pointer block space-y-1">
                    <Camera className="w-5 h-5 text-[var(--accent-blue)] mx-auto" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">Take Photo with Camera</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Photograph each page directly</span>
                  </label>
                </div>

                {/* Choose multiple photos from device */}
                <div className="border border-dashed border-[var(--border-divider)] hover:border-[var(--accent-blue)] rounded-xl p-3.5 text-center bg-[var(--surface-elevated)] transition-colors cursor-pointer">
                  <input
                    type="file"
                    id="gallery-photo-input"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleAddPhotoFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <label htmlFor="gallery-photo-input" className="cursor-pointer block space-y-1">
                    <UploadCloud className="w-5 h-5 text-[var(--accent-blue)] mx-auto" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">Choose from Device</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Select multiple photos together</span>
                  </label>
                </div>
              </div>

              {/* Dynamic Photo Count and Simple Responsive Thumbnail Grid */}
              {selectedPhotos.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--accent-blue)]">
                      {selectedPhotos.length} {selectedPhotos.length === 1 ? 'photo' : 'photos'} added
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        selectedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
                        setSelectedPhotos([]);
                      }}
                      className="text-[11px] text-[var(--color-red)] hover:underline cursor-pointer"
                    >
                      Remove all
                    </button>
                  </div>

                  {/* Responsive grid of thumbnails with remove icons */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-divider)] max-h-60 overflow-y-auto">
                    {selectedPhotos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="relative group rounded-lg overflow-hidden border border-[var(--border-divider)] bg-[var(--surface-main)] aspect-[3/4] flex items-center justify-center shadow-xs"
                      >
                        <img
                          src={photo.previewUrl}
                          alt={`Uploaded page ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/75 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-sm"
                          title="Remove photo"
                          aria-label={`Remove photo ${index + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[9px] text-white font-mono truncate text-center">
                          {(photo.file.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadProgress && (
            <div className="p-2.5 bg-[var(--accent-blue-bg)] border border-[var(--accent-blue)]/30 rounded-lg text-xs text-[var(--accent-blue)] flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
              <span>{uploadProgress}</span>
            </div>
          )}

          {/* Rights Confirmation Required by Community Policy */}
          <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-divider)]">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={hasRightsConfirmed}
                onChange={(e) => setHasRightsConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-[var(--border-divider)] text-[var(--accent-blue)] focus:ring-0 cursor-pointer"
                required
              />
              <span>
                I confirm that this is an authentic past question paper and I have the right to contribute it for student reference.
              </span>
            </label>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-[var(--accent-blue)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer btn-quad-border"
          >
            {isSubmitting ? (
              <span>Publishing Paper...</span>
            ) : (
              <span>Publish Paper</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
