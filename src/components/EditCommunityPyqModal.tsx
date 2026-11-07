import React, { useState } from 'react';
import { X, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Title is required.');
      return;
    }

    setIsSubmitting(true);
    const parsedMarks = totalMarks ? Number(totalMarks) : undefined;
    const parsedDuration = timeAllowedMinutes ? Number(timeAllowedMinutes) : undefined;

    const updates = {
      title: title.trim(),
      subject,
      grade,
      examBoard,
      year: Number(year),
      chapter: chapter.trim() || undefined,
      description: description.trim() || '',
      totalMarks: parsedMarks && !isNaN(parsedMarks) ? parsedMarks : undefined,
      timeAllowedMinutes: parsedDuration && !isNaN(parsedDuration) ? parsedDuration : undefined,
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
      chapter: updates.chapter,
    };

    onUpdated(updatedPaper);
    onClose();
  };

  const modalRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const input = modalRef.current?.querySelector<HTMLInputElement>('input');
        input?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
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
    }
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-paper-title"
        className="relative w-full max-w-lg bg-[var(--surface-main)]/95 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl shadow-2xl p-6 text-[var(--text-primary)] space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-divider)]">
          <h2 id="edit-paper-title" className="text-base font-semibold text-[var(--text-primary)]">Edit Community Submission</h2>
          <button
            onClick={onClose}
            className="btn-quad-border p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-[var(--accent-red)]/15 border border-[var(--accent-red)]/30 rounded-xl text-xs text-[var(--accent-red)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--accent-red)]" />
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
              className="w-full px-3.5 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--text-secondary)] font-medium mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
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
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
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
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
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
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] cursor-pointer"
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
              className="w-full px-3.5 py-2.5 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] font-medium mb-1">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add key highlights, paper set number, or instructions for students..."
              className="w-full px-3.5 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] resize-none"
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
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
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
                className="w-full px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
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
              className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] font-medium transition-colors cursor-pointer border border-[var(--border-divider)] shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[var(--accent-blue)] hover:opacity-90 text-white font-bold transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
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
};
