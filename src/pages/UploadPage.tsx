import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { ExamBoard, GradeLevel, Paper } from '../types';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { EXAM_BOARDS, GRADE_LEVELS, POPULAR_SUBJECTS, YEARS } from '../data/samplePapers';
import { supabase } from '../supabaseClient.js';
import { communityPyqService } from '../services/communityPyqService';
import { downloadQuotaService, DownloadQuota } from '../services/downloadQuotaService';

interface UploadPageProps {
  onPaperSubmitted: (newPaper: Paper) => void;
  onNavigateToSubmissions: () => void;
  onNavigateToBrowse?: () => void;
  onRedirectToLogin?: () => void;
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

  const [uploadMethod, setUploadMethod] = useState<'pdf' | 'images'>('pdf');
  const [examBoard, setExamBoard] = useState<ExamBoard>('CBSE');
  const [grade, setGrade] = useState<GradeLevel>('Class 12');
  const [subject, setSubject] = useState('Physics');
  const [eventName, setEventName] = useState('');
  const [year, setYear] = useState<number>(2024);
  const [chapter, setChapter] = useState('');
  const [description, setDescription] = useState('');
  const [totalMarksInput, setTotalMarksInput] = useState('');
  const [timeAllowedInput, setTimeAllowedInput] = useState('');

  // Title state defaults directly to "Sample" without auto-generated label
  const [title, setTitle] = useState('Sample');

  // PDF upload state
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [actualFile, setActualFile] = useState<File | null>(null);

  // Multi-image upload state
  interface ImagePageItem {
    id: string;
    file: File;
    previewUrl: string;
  }
  const [imagePages, setImagePages] = useState<ImagePageItem[]>([]);
  const [activePreviewPageIndex, setActivePreviewPageIndex] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Feature 2: PDF download quota and contribution unlocking states
  const [quota, setQuota] = useState<DownloadQuota | null>(null);
  const [hasRightsConfirmed, setHasRightsConfirmed] = useState(false);
  const [unlockCelebration, setUnlockCelebration] = useState<string | null>(null);

  useEffect(() => {
    downloadQuotaService.getQuota().then(setQuota);
  }, []);

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

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 25MB limit.');
        return;
      }

      // Feature 2: Validate genuine PDF format (%PDF- header), not just file extension
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

  const handleAddImageFiles = (files: FileList | File[]) => {
    const newItems: ImagePageItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage(`Photo "${file.name}" exceeds 15MB size limit.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
      });
    }

    if (imagePages.length + newItems.length > 25) {
      setErrorMessage('Maximum of 25 pages allowed per paper.');
      return;
    }

    setImagePages((prev) => [...prev, ...newItems]);
    setErrorMessage(null);
  };

  const handleRemoveImagePage = (indexToRemove: number) => {
    setImagePages((prev) => {
      const item = prev[indexToRemove];
      if (item) URL.revokeObjectURL(item.previewUrl);
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (activePreviewPageIndex >= updated.length) {
        setActivePreviewPageIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const handleMovePage = (index: number, direction: 'up' | 'down') => {
    setImagePages((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please provide a paper title.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please specify the subject.');
      return;
    }
    if (!year || isNaN(Number(year))) {
      setErrorMessage('Please enter a valid examination year.');
      return;
    }

    if (uploadMethod === 'pdf') {
      if (!selectedFile || !actualFile) {
        setErrorMessage('Please select a PDF document to upload.');
        return;
      }
    } else {
      if (imagePages.length === 0) {
        setErrorMessage('Please add at least one photograph / page of the question paper.');
        return;
      }
    }

    if (!hasRightsConfirmed) {
      setErrorMessage('Please confirm that you have the right to share this educational past paper with the student community.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(uploadMethod === 'images' ? `Uploading ${imagePages.length} photograph pages...` : 'Uploading file to storage...');

    try {
      const parsedMarks = totalMarksInput.trim() ? Number(totalMarksInput.trim()) : undefined;
      const parsedDuration = timeAllowedInput.trim() ? Number(timeAllowedInput.trim()) : undefined;

      const { paper, error } = await communityPyqService.uploadCommunityPyq({
        isImageBased: uploadMethod === 'images',
        files: uploadMethod === 'images' ? imagePages.map((p) => p.file) : undefined,
        file: uploadMethod === 'pdf' ? (actualFile || undefined) : undefined,
        fileName: uploadMethod === 'pdf' ? selectedFile?.name : `${imagePages.length} Pages (Images)`,
        title: title.trim(),
        subject: subject.trim(),
        examBoard,
        grade,
        year: Number(year),
        eventName: eventName.trim() || undefined,
        chapter: chapter.trim() || undefined,
        description: description.trim() || '',
        totalMarks: parsedMarks && !isNaN(parsedMarks) ? parsedMarks : undefined,
        timeAllowedMinutes: parsedDuration && !isNaN(parsedDuration) ? parsedDuration : undefined,
        uploaderDisplayName: currentUser?.name || 'Academic Contributor',
      });

      if (error || !paper) {
        throw error || new Error('Upload could not be processed.');
      }

      // Feature 2: If user uploaded a valid PDF, credit their contribution towards unlocking downloads
      if (uploadMethod === 'pdf' && actualFile) {
        const hash = await downloadQuotaService.computeFileHash(actualFile);
        const contrib = await downloadQuotaService.recordPdfContribution(hash, paper.id);

        if (contrib.unlocked) {
          setUnlockCelebration('🎉 Contribution Goal Completed! You uploaded 2 valid PDFs. 10 new downloads unlocked!');
        } else if (contrib.success) {
          setUnlockCelebration('✅ 1/2 PDFs uploaded! Upload 1 more unique PDF to unlock your next 10 downloads.');
        } else if (contrib.error) {
          console.warn('Duplicate contribution hash notice:', contrib.error);
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
              setImagePages([]);
              setTitle('Sample');
              setEventName('');
              setDescription('');
              setChapter('');
              setTotalMarksInput('');
              setTimeAllowedInput('');
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
            onClick={() => setUploadMethod('pdf')}
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
            onClick={() => setUploadMethod('images')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              uploadMethod === 'images'
                ? 'bg-[var(--accent-blue)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="font-mono text-xs">📷</span>
            <span>Upload Photographs (Camera / Gallery)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Metadata Grid: Only Class and Board remain dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Exam Board - Retains Dropdown */}
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

            {/* Class / Grade - Retains Dropdown */}
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

            {/* Subject - Manually Editable Text Input */}
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

            {/* Examination Year - Manually Editable Text/Number Input */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Examination Year *
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={1990}
                max={2030}
                placeholder="e.g. 2024"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                required
              />
            </div>
          </div>

          {/* Exam / Event Name - Manually Editable Text Input */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Exam or Event Name <span className="text-[11px] font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Mid-Term Exam, Session 1, Annual Board Exam"
              className="w-full px-3 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {/* Paper Title - Shows "Sample" directly, no "Auto Generated" label */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Paper Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sample"
              className="w-full px-3 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              required
            />
          </div>

          {/* Chapter / Topic Scope */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Chapter / Topic Scope <span className="text-[11px] font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Full Syllabus, Term 2 Units, or Electrostatics"
              className="w-full px-3 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {/* Optional Marks & Duration - No assumed values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Total Marks <span className="text-[11px] font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                type="number"
                value={totalMarksInput}
                onChange={(e) => setTotalMarksInput(e.target.value)}
                placeholder="Leave blank if unspecified"
                min={1}
                max={500}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Duration in Minutes <span className="text-[11px] font-normal text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                type="number"
                value={timeAllowedInput}
                onChange={(e) => setTimeAllowedInput(e.target.value)}
                placeholder="Leave blank if unspecified"
                min={10}
                max={600}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
          </div>

          {/* Description or Notes */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description or Notes <span className="text-[11px] font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Notes on paper shift, difficulty, or marking instructions..."
              className="w-full px-3 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
            />
          </div>

          {/* ============================================================== */}
          {/* UPLOAD METHOD A: SINGLE PDF UPLOAD                             */}
          {/* ============================================================== */}
          {uploadMethod === 'pdf' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Upload Document File (.pdf) <span className="text-[var(--color-red)]">*</span>
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
          {/* UPLOAD METHOD B: MULTIPLE IMAGE UPLOAD / CAMERA PHOTOS         */}
          {/* ============================================================== */}
          {uploadMethod === 'images' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Question Paper Pages / Photos <span className="text-[var(--color-red)]">*</span>
                </label>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {imagePages.length} {imagePages.length === 1 ? 'page' : 'pages'} added
                </span>
              </div>

              {/* Page Strip: Page 1 | Page 2 | Page 3 | + Add Another Page */}
              {imagePages.length > 0 && (
                <div className="p-3 bg-[var(--surface-elevated)] border border-[var(--border-divider)] rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {imagePages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePreviewPageIndex(idx)}
                        className={`px-3 py-1 rounded-lg font-mono text-xs transition-colors shrink-0 cursor-pointer ${
                          activePreviewPageIndex === idx
                            ? 'bg-[var(--accent-blue)] text-white font-semibold'
                            : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Page {idx + 1}
                      </button>
                    ))}
                    <label
                      htmlFor="camera-more-input"
                      className="px-2.5 py-1 rounded-lg bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] hover:opacity-90 font-medium text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <span>+ Add Another Page</span>
                    </label>
                  </div>

                  {/* Active Page Card Preview */}
                  {imagePages[activePreviewPageIndex] && (
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-2.5 bg-[var(--surface-main)] rounded-lg border border-[var(--border-divider)]">
                      <img
                        src={imagePages[activePreviewPageIndex].previewUrl}
                        alt={`Page ${activePreviewPageIndex + 1}`}
                        className="w-20 h-28 object-cover rounded-md border border-[var(--border-divider)] shadow-xs"
                      />
                      <div className="flex-1 space-y-1 text-xs">
                        <div className="font-semibold text-[var(--text-primary)]">
                          Page {activePreviewPageIndex + 1} of {imagePages.length}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate max-w-xs">
                          {imagePages[activePreviewPageIndex].file.name} · {(imagePages[activePreviewPageIndex].file.size / 1024).toFixed(0)} KB
                        </div>
                        <div className="pt-1 flex items-center gap-2">
                          {activePreviewPageIndex > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMovePage(activePreviewPageIndex, 'up')}
                              className="px-2 py-0.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] rounded text-[11px] text-[var(--text-primary)] cursor-pointer"
                            >
                              ← Move Left
                            </button>
                          )}
                          {activePreviewPageIndex < imagePages.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMovePage(activePreviewPageIndex, 'down')}
                              className="px-2 py-0.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] rounded text-[11px] text-[var(--text-primary)] cursor-pointer"
                            >
                              Move Right →
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImagePage(activePreviewPageIndex)}
                            className="px-2 py-0.5 bg-[var(--accent-red-bg)] text-[var(--color-red)] hover:opacity-90 rounded text-[11px] cursor-pointer"
                          >
                            Remove Page
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Controls for Images: Camera & File Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Take Photo / Mobile Camera */}
                <div className="border border-dashed border-[var(--border-divider)] hover:border-[var(--accent-blue)] rounded-xl p-4 text-center bg-[var(--surface-elevated)] transition-colors cursor-pointer">
                  <input
                    type="file"
                    id="camera-photo-input"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      if (e.target.files) handleAddImageFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <label htmlFor="camera-photo-input" className="cursor-pointer block space-y-1">
                    <span className="text-xl block">📷</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">Take Photo with Camera</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Use your phone to photograph each question page</span>
                  </label>
                </div>

                {/* Choose from Gallery / Files */}
                <div className="border border-dashed border-[var(--border-divider)] hover:border-[var(--accent-blue)] rounded-xl p-4 text-center bg-[var(--surface-elevated)] transition-colors cursor-pointer">
                  <input
                    type="file"
                    id="camera-more-input"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleAddImageFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <label htmlFor="camera-more-input" className="cursor-pointer block space-y-1">
                    <UploadCloud className="w-5 h-5 text-[var(--accent-blue)] mx-auto" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">Select Photos from Device</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Choose multiple page pictures at once</span>
                  </label>
                </div>
              </div>
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
              <span className="leading-relaxed">
                I confirm I have the right to share this educational question paper with the Studify student community and that the uploaded file is authentic.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-opacity shadow-xs disabled:opacity-50 mt-3 cursor-pointer"
          >
            {isSubmitting ? 'Uploading & Verifying...' : 'Publish Paper to Library'}
          </button>
        </form>
      </div>
    </div>
  );
};
