import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, Lock, ArrowRight, User, Sparkles, FileText, AlertCircle } from 'lucide-react';
import { ExamBoard, GradeLevel, Paper } from '../types';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { EXAM_BOARDS, GRADE_LEVELS, POPULAR_SUBJECTS, YEARS } from '../data/samplePapers';
import { supabase } from '../supabaseClient.js';
import { supabaseStorage } from '../services/supabaseStorage';

interface UploadPageProps {
  onPaperSubmitted: (newPaper: Paper) => void;
  onNavigateToSubmissions: () => void;
  onRedirectToLogin?: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({
  onPaperSubmitted,
  onNavigateToSubmissions,
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

  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<GradeLevel>('Class 12');
  const [subject, setSubject] = useState(POPULAR_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [examBoard, setExamBoard] = useState<ExamBoard>('CBSE');
  const [year, setYear] = useState<number>(2024);
  const [chapter, setChapter] = useState('');
  const [description, setDescription] = useState('');

  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [actualFile, setActualFile] = useState<File | Blob | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 bg-[#101B2D] border border-white/[0.14] rounded-2xl flex items-center justify-center mx-auto text-cyan-400 shadow-xl shadow-cyan-950/30">
          <Lock className="w-6 h-6 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-[#F8FAFC]">
          Sign in to upload papers
        </h1>
        <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-sm mx-auto">
          You need an account to upload papers and share study resources with fellow students.
        </p>
        <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
          <button
            onClick={() => openAuthModal('login')}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20"
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
        setErrorMessage('This file cannot be uploaded. File is larger than 20MB.');
        return;
      }
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
      });
      setActualFile(file);
      setErrorMessage(null);
    }
  };

  const handleAttachSample = () => {
    const sampleName = `${examBoard}_${grade.replace(' ', '')}_${subject}_${year}.pdf`;
    const dummyPdfContent = `%PDF-1.4\n%Studify Question Paper Document\n1 0 obj\n<< /Title (${title || 'Sample Examination Paper'}) /Author (Studify Community) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
    const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
    setSelectedFile({
      name: sampleName,
      size: 2400000,
      type: 'application/pdf',
    });
    setActualFile(blob);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please enter a paper title.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please select a PDF or image file.');
      return;
    }

    const resolvedSubject = subject === 'Other' ? customSubject.trim() || 'General' : subject;
    setIsSubmitting(true);

    try {
      const newPaperId = `pyq-user-${Date.now()}`;
      let uploadedFilePath: string | undefined = undefined;

      // Upload file to Supabase Storage bucket 'app-files'
      // Path format: ${auth.uid()}/papers/${itemId}/${uuid}.${extension}
      if (actualFile && currentUser?.id) {
        const uploadRes = await supabaseStorage.uploadAppFile({
          userId: currentUser.id,
          featureName: 'papers',
          itemId: newPaperId,
          file: actualFile,
          fileName: selectedFile.name,
          contentType: selectedFile.type,
        });

        if (uploadRes.error) {
          console.warn('Supabase storage upload notice:', uploadRes.error.message);
        } else if (uploadRes.path) {
          uploadedFilePath = uploadRes.path;
        }
      }

      // Save paper metadata and returned storage file path in database
      const submitted = storageService.submitPaper({
        id: newPaperId,
        title: title.trim(),
        grade,
        subject: resolvedSubject,
        examBoard,
        year: Number(year),
        chapter: chapter.trim() || undefined,
        totalMarks: 70,
        timeAllowedMinutes: 180,
        description: description.trim() || '',
        submittedBy: {
          id: currentUser!.id,
          name: currentUser!.name,
          email: currentUser!.email,
        },
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        fileUrl: uploadedFilePath,
        tags: [examBoard, grade, resolvedSubject, `${year}`],
        sections: [],
      });

      setIsSubmitting(false);
      setSubmissionSuccess(true);
      onPaperSubmitted(submitted);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Something went wrong. Try again.');
    }
  };

  if (submissionSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-400/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950/30">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-[#F8FAFC]">
          Paper submitted for review
        </h1>
        <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-sm mx-auto">
          Thank you for contributing! The site administrator reviews all question papers before they appear publicly.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onNavigateToSubmissions}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20"
          >
            My Materials
          </button>
          <button
            onClick={() => {
              setSubmissionSuccess(false);
              setTitle('');
              setSelectedFile(null);
              setActualFile(null);
              setDescription('');
              setChapter('');
            }}
            className="px-5 py-2.5 bg-[#101B2D] hover:bg-[#15233D] border border-white/[0.12] text-[#F8FAFC] text-xs font-medium rounded-xl transition-all"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
          Upload Question Paper
        </h1>
        <p className="text-xs sm:text-sm text-[#A7B4C8] mt-1">
          Share previous year questions and test sets with the student community.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Floating Upload Container with exact 8-field order */}
      <div className="bg-[#101B2D]/85 backdrop-blur-xl border border-white/[0.14] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/20">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Paper title */}
          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              1. Paper Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CBSE Class 12 Physics Theory Board Paper 2024"
              className="w-full px-3.5 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/50 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          {/* 2. Class */}
          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              2. Class / Grade
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as GradeLevel)}
              className="w-full px-3 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400"
            >
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 3. Subject */}
          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              3. Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400"
            >
              {POPULAR_SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="Other">Other</option>
            </select>
            {subject === 'Other' && (
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Enter subject name"
                className="mt-2 w-full px-3 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400"
                required
              />
            )}
          </div>

          {/* 4. Exam */}
          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              4. Exam Board / Examination
            </label>
            <select
              value={examBoard}
              onChange={(e) => setExamBoard(e.target.value as ExamBoard)}
              className="w-full px-3 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400"
            >
              {EXAM_BOARDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* 5. Year */}
          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              5. Examination Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] focus:outline-none focus:border-cyan-400"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* 6. Chapter (optional) */}
          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              6. Chapter / Unit Scope (optional)
            </label>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Complete Syllabus or Term 2 Units"
              className="w-full px-3.5 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/50 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* 7. Description (optional) */}
          <div>
            <label className="block text-xs font-semibold text-[#F8FAFC] mb-1.5">
              7. Notes & Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Notes on paper shift, answer keys, or question types..."
              className="w-full px-3.5 py-2.5 text-xs bg-[#0A1222] border border-white/[0.1] rounded-xl text-[#F8FAFC] placeholder-[#A7B4C8]/50 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* 8. Select PDF or image */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#F8FAFC]">
                8. Select Document File
              </label>
              <button
                type="button"
                onClick={handleAttachSample}
                className="text-[11px] text-cyan-300 hover:text-cyan-200 underline"
              >
                Attach sample PDF
              </button>
            </div>

            <div className="border border-dashed border-white/[0.16] hover:border-cyan-400/50 rounded-2xl p-6 text-center bg-[#0A1222] transition-colors cursor-pointer">
              <input
                type="file"
                id="file-input"
                accept=".pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-input" className="cursor-pointer block">
                <UploadCloud className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                {selectedFile ? (
                  <div>
                    <span className="font-bold text-[#F8FAFC] block text-xs">{selectedFile.name}</span>
                    <span className="text-emerald-400 text-[11px] mt-0.5 block font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready for submission
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-cyan-300 font-semibold underline text-xs">Choose PDF or image</span>
                    <span className="text-[#A7B4C8] text-[11px] block mt-1">
                      Supported: PDF, PNG, JPG (maximum 20MB)
                    </span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-[#050914] text-xs font-black rounded-xl transition-all shadow-xl shadow-cyan-500/25 active:scale-[0.99] disabled:opacity-50 mt-5"
          >
            {isSubmitting ? 'Uploading Document...' : 'Submit Paper for Review'}
          </button>
        </form>
      </div>
    </div>
  );
};
