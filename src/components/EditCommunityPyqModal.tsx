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
  const [totalMarks, setTotalMarks] = useState(paper.totalMarks || 100);
  const [timeAllowedMinutes, setTimeAllowedMinutes] = useState(paper.timeAllowedMinutes || 180);

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
    const updates = {
      title: title.trim(),
      subject,
      grade,
      examBoard,
      year: Number(year),
      chapter: chapter.trim() || undefined,
      description: description.trim() || '',
      totalMarks: Number(totalMarks),
      timeAllowedMinutes: Number(timeAllowedMinutes),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-white/[0.12] rounded-2xl shadow-2xl p-6 text-[#F8FAFC] space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <h2 className="text-base font-semibold text-white">Edit Community Submission</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A7B4C8] hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#A7B4C8] font-medium mb-1">Paper Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A7B4C8] font-medium mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-cyan-400"
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
              <label className="block text-[#A7B4C8] font-medium mb-1">Board / Exam</label>
              <select
                value={examBoard}
                onChange={(e) => setExamBoard(e.target.value as ExamBoard)}
                className="w-full px-3 py-2 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-cyan-400"
              >
                {EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A7B4C8] font-medium mb-1">Class / Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as GradeLevel)}
                className="w-full px-3 py-2 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-cyan-400"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#A7B4C8] font-medium mb-1">Examination Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-cyan-400"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#A7B4C8] font-medium mb-1">Chapter / Topic (Optional)</label>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Thermodynamics, Calculus, Full Syllabus"
              className="w-full px-3.5 py-2.5 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-[#A7B4C8] font-medium mb-1">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add key highlights, paper set number, or instructions for students..."
              className="w-full px-3.5 py-2 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A7B4C8] font-medium mb-1">Total Marks</label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-cyan-400"
                min={1}
                max={500}
              />
            </div>
            <div>
              <label className="block text-[#A7B4C8] font-medium mb-1">Time (Minutes)</label>
              <input
                type="number"
                value={timeAllowedMinutes}
                onChange={(e) => setTimeAllowedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-cyan-400"
                min={15}
                max={360}
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] font-bold transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20 disabled:opacity-50"
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
