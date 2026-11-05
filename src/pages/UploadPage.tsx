import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { ExamBoard, GradeLevel, Paper } from '../types';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { EXAM_BOARDS, GRADE_LEVELS, POPULAR_SUBJECTS, YEARS } from '../data/samplePapers';
import { supabase } from '../supabaseClient.js';
import { communityPyqService } from '../services/communityPyqService';

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

  const [examBoard, setExamBoard] = useState<ExamBoard>('CBSE');
  const [grade, setGrade] = useState<GradeLevel>('Class 12');
  const [subject, setSubject] = useState(POPULAR_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [year, setYear] = useState<number>(2024);
  const [chapter, setChapter] = useState('');
  const [description, setDescription] = useState('');

  // Title state with auto-generation tracking
  const [title, setTitle] = useState(`${examBoard} ${grade} ${subject} Question Paper ${year}`);
  const [isTitleCustomized, setIsTitleCustomized] = useState(false);

  useEffect(() => {
    if (!isTitleCustomized) {
      const resolvedSubject = subject === 'Other' ? (customSubject.trim() || 'Subject') : subject;
      setTitle(`${examBoard} ${grade} ${resolvedSubject} Question Paper ${year}`);
    }
  }, [examBoard, grade, subject, customSubject, year, isTitleCustomized]);

  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [actualFile, setActualFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            className="w-full py-2.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer btn-quad-border"
          >
            Sign In to Studify
          </button>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 20MB limit.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please provide a paper title.');
      return;
    }
    if (!selectedFile || !actualFile) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress('Uploading file to storage...');

    try {
      const finalSubject = subject === 'Other' ? (customSubject.trim() || 'General') : subject;
      const { paper, error } = await communityPyqService.uploadCommunityPyq({
        file: actualFile,
        fileName: selectedFile.name,
        title: title.trim(),
        subject: finalSubject,
        examBoard,
        grade,
        year,
        chapter: chapter.trim() || undefined,
        description: description.trim() || '',
        totalMarks: 70,
        timeAllowedMinutes: 180,
        uploaderDisplayName: currentUser?.name || 'Academic Contributor',
      });

      if (error || !paper) {
        throw error || new Error('Upload could not be processed.');
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
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
          {onNavigateToBrowse && (
            <button
              type="button"
              onClick={onNavigateToBrowse}
              className="px-4 py-2 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer btn-quad-border"
            >
              Browse Library
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateToSubmissions}
            className="px-4 py-2 bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors cursor-pointer btn-quad-border"
          >
            My Materials
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmissionSuccess(false);
              setSelectedFile(null);
              setActualFile(null);
              setDescription('');
              setChapter('');
              setIsTitleCustomized(false);
            }}
            className="px-4 py-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors cursor-pointer btn-quad-border"
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

      {errorMessage && (
        <div className="p-3 bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 rounded-xl text-xs text-[var(--color-red)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Form Container */}
      <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 sm:p-6 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Exam Board */}
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

            {/* Class / Grade */}
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

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                {POPULAR_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Examination Year */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Examination Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {subject === 'Other' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Custom Subject Name
              </label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Enter subject name (e.g. Political Science)"
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                required
              />
            </div>
          )}

          {/* Paper Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                Paper Title
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">
                {isTitleCustomized ? 'Customized' : 'Auto-generated'}
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsTitleCustomized(true);
              }}
              placeholder="e.g. CBSE Class 12 Physics Theory Board Paper 2024"
              className="w-full px-3 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              required
            />
          </div>

          {/* Chapter / Scope */}
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

          {/* Notes & Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description or Notes <span className="text-[11px] font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Notes on paper shift, difficulty, or marking scheme..."
              className="w-full px-3 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
            />
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Upload Document File <span className="text-[var(--color-red)]">*</span>
            </label>

            <div className="border border-dashed border-[var(--border-divider)] hover:border-[var(--accent-blue)] rounded-xl p-5 text-center bg-[var(--surface-elevated)] transition-colors cursor-pointer">
              <input
                type="file"
                id="file-input"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-input" className="cursor-pointer block">
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
                    <span className="text-[var(--accent-blue)] font-medium underline text-xs">Choose PDF or image</span>
                    <span className="text-[var(--text-muted)] text-[11px] block mt-0.5">
                      Supported formats: PDF, PNG, JPG, WEBP (maximum 20MB)
                    </span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {uploadProgress && (
            <div className="p-2.5 bg-[var(--accent-blue-bg)] border border-[var(--accent-blue)]/30 rounded-lg text-xs text-[var(--accent-blue)] flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
              <span>{uploadProgress}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-opacity shadow-xs disabled:opacity-50 mt-3 cursor-pointer btn-quad-border"
          >
            {isSubmitting ? 'Uploading & Verifying...' : 'Publish Paper to Library'}
          </button>
        </form>
      </div>
    </div>
  );
};
