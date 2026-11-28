import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle } from 'lucide-react';
import { Paper, ExamBoard, GradeLevel } from '../types';
import { EXAM_BOARDS, GRADE_LEVELS, POPULAR_SUBJECTS, YEARS } from '../data/samplePapers';
import { communityPyqService } from '../services/communityPyqService';

interface EditCommunityPyqModalProps {
  paper: Paper;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedPaper: Paper) => void;
}

export const EditCommunityPyqModal: React.FC<EditCommunityPyqModalProps> = ({
  paper,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [title, setTitle] = useState(paper.title);
  const [subject, setSubject] = useState(paper.subject);
  const [grade, setGrade] = useState<GradeLevel>(paper.grade);
  const [examBoard, setExamBoard] = useState<ExamBoard>(paper.examBoard);
  const [year, setYear] = useState<number>(paper.year);
  const [chapter, setChapter] = useState(paper.chapter || '');
  const [description, setDescription] = useState(paper.description || '');
  const [totalMarks, setTotalMarks] = useState<number | string>(paper.totalMarks || '');
  const [timeAllowedMinutes, setTimeAllowedMinutes] = useState<number | string>(paper.timeAllowedMinutes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isSubmittingRef = useRef(isSubmitting);

  onCloseRef.current = onClose;
  isSubmittingRef.current = isSubmitting;

  // Keep local fields synchronized whenever the modal opens or target paper props update
  useEffect(() => {
    if (!isOpen) return;
    setTitle(paper.title);
    setSubject(paper.subject);
    setGrade(paper.grade);
    setExamBoard(paper.examBoard);
    setYear(paper.year);
    setChapter(paper.chapter || '');
    setDescription(paper.description || '');
    setTotalMarks(paper.totalMarks || '');
    setTimeAllowedMinutes(paper.timeAllowedMinutes || '');
    setErrorMessage(null);
  }, [
    isOpen,
    paper.id,
    paper.title,
    paper.subject,
    paper.grade,
    paper.examBoard,
    paper.year,
    paper.chapter,
    paper.description,
    paper.totalMarks,
    paper.timeAllowedMinutes,
  ]);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
      const timer = setTimeout(() => {
        const input = modalRef.current?.querySelector<HTMLInputElement>('input');
        input?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmittingRef.current) {
          onCloseRef.current();
        } else if (e.key === 'Tab') {
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Title is required.');
      return;
    }

    const marksStr = String(totalMarks).trim();
    const durationStr = String(timeAllowedMinutes).trim();
    const parsedMarks = marksStr ? Number(marksStr) : null;
    const parsedDuration = durationStr ? Number(durationStr) : null;

    if (parsedMarks !== null && (!Number.isInteger(parsedMarks) || parsedMarks <= 0)) {
      setErrorMessage('Total marks must be a positive whole number, or leave blank.');
      return;
    }

    if (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration <= 0)) {
      setErrorMessage('Time allowed must be a positive whole number (minutes), or leave blank.');
      return;
    }

    setIsSubmitting(true);

    const updates = {
      title: title.trim(),
      subject,
      grade,
      examBoard,
      year: Number(year),
      chapter: chapter.trim() || undefined,
      description: description.trim() || '',
      totalMarks: parsedMarks,
      timeAllowedMinutes: parsedDuration,
      tags: [examBoard, grade, subject, String(year)],
    };

    const { success, error } = await communityPyqService.updateCommunityPyq(paper.id, updates);

    setIsSubmitting(false);
    if (!success || error) {
      setErrorMessage(error?.message || 'Failed to update paper metadata.');
      return;
    }

    const updatedPaper: Paper = {
      ...paper,
      ...updates,
      totalMarks: parsedMarks ?? undefined,
      timeAllowedMinutes: parsedDuration ?? undefined,
      chapter: updates.chapter,
    };

    onUpdated(updatedPaper);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[var(--modal-backdrop)]"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-paper-title"
        className="relative w-full max-w-lg bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-2xl shadow-xl p-6 text-[var(--text-primary)] space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-divider)]">
          <h2 id="edit-paper-title" className="font-display text-base font-semibold text-[var(--text-primary)]">
            Edit Community Submission
          </h2>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-[var(--accent-red-bg)] border border-[var(--color-red)]/30 rounded-xl text-xs text-[var(--color-red)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-red)]" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[var(--text-secondary)] font-medium mb-1">Paper Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                {POPULAR_SUBJECTS.filter((s) => s !== 'Other').map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {!POPULAR_SUBJECTS.includes(subject) && (
                  <option value={subject}>{subject}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Board / Exam</label>
              <select
                value={examBoard}
                onChange={(e) => setExamBoard(e.target.value as ExamBoard)}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                {EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Class / Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as GradeLevel)}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Examination Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer tabular-nums"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] font-medium mb-1">Chapter / Topic (Optional)</label>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Thermodynamics, Calculus, Full Syllabus"
              className="w-full px-3.5 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] font-medium mb-1">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add key highlights, paper set number, or instructions for students..."
              className="w-full px-3.5 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Total Marks (optional)</label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                placeholder="Unspecified"
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] tabular-nums"
                min={1}
                max={500}
              />
            </div>
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Time (Minutes, optional)</label>
              <input
                type="number"
                value={timeAllowedMinutes}
                onChange={(e) => setTimeAllowedMinutes(e.target.value)}
                placeholder="Unspecified"
                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] tabular-nums"
                min={10}
                max={600}
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--border-divider)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] font-medium transition-colors cursor-pointer border border-[var(--border-divider)] disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] font-semibold transition-opacity flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
