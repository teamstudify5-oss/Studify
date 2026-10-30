import { Paper, PaperStatus, PaperReview, PaperComment } from '../types';
import { SAMPLE_PAPERS } from '../data/samplePapers';
import { supabaseDb } from './supabaseDb';
import { supabaseStorage } from './supabaseStorage';

const PAPERS_STORAGE_KEY = 'pyq_papers_clean_v3';
const SAVED_PAPERS_STORAGE_KEY = 'pyq_saved_paper_ids_clean_v3';
const LEGACY_PAPERS_PURGED = 'studify_test_papers_purged_v3';

// Clean out preexisting test papers from localStorage
function purgeLegacyTestPapers() {
  try {
    if (!localStorage.getItem(LEGACY_PAPERS_PURGED)) {
      localStorage.removeItem('pyq_papers_v2');
      localStorage.removeItem('pyq_papers');
      localStorage.removeItem('pyq_saved_paper_ids_v2');
      localStorage.removeItem('pyq_saved_paper_ids');
      localStorage.removeItem(PAPERS_STORAGE_KEY);
      localStorage.removeItem(SAVED_PAPERS_STORAGE_KEY);
      localStorage.setItem(LEGACY_PAPERS_PURGED, 'true');
    }
  } catch (e) {
    // ignore
  }
}

purgeLegacyTestPapers();

export const storageService = {
  // Sync papers from Supabase
  async fetchPapersFromSupabase(): Promise<Paper[]> {
    try {
      const remote = await supabaseDb.loadPapers();
      if (remote && remote.length > 0) {
        this.savePapers(remote);
        return remote;
      }
      return this.getPapers();
    } catch (e) {
      console.warn('Could not fetch papers from Supabase:', e);
      return this.getPapers();
    }
  },

  // Initialize storage cleanly - blank if empty
  getPapers(): Paper[] {
    try {
      const stored = localStorage.getItem(PAPERS_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  savePapers(papers: Paper[]): void {
    try {
      localStorage.setItem(PAPERS_STORAGE_KEY, JSON.stringify(papers));
    } catch (e) {
      console.error('Failed to save papers to localStorage', e);
    }
  },

  getApprovedPapers(): Paper[] {
    const all = this.getPapers();
    return all.filter((p) => p.status === 'approved');
  },

  getAllPapersForOwner(): Paper[] {
    return this.getPapers();
  },

  getUserSubmissions(userId: string): Paper[] {
    const all = this.getPapers();
    return all.filter((p) => p.submittedBy.id === userId);
  },

  getPaperById(id: string): Paper | undefined {
    const all = this.getPapers();
    return all.find((p) => p.id === id);
  },

  submitPaper(
    data: Omit<Paper, 'id' | 'status' | 'submittedAt' | 'viewsCount' | 'downloadsCount'> & { id?: string },
  ): Paper {
    const papers = this.getPapers();
    const newPaper: Paper = {
      ...data,
      id: data.id || `pyq-user-${Date.now()}`,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      viewsCount: 0,
      downloadsCount: 0,
      rating: 5.0,
      ratingCount: 1,
      reviews: [],
      comments: [],
    };
    papers.unshift(newPaper);
    this.savePapers(papers);

    // Real Supabase insert query
    supabaseDb.createPaper(newPaper).catch((e) => console.warn('Supabase createPaper failed', e));

    return newPaper;
  },

  updatePaperStatus(id: string, status: PaperStatus, rejectionReason?: string): Paper | null {
    const papers = this.getPapers();
    const index = papers.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updated: Paper = {
      ...papers[index],
      status,
      ...(status === 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      ...(status === 'rejected' ? { rejectionReason: rejectionReason || 'Does not meet submission guidelines' } : {}),
    };

    papers[index] = updated;
    this.savePapers(papers);

    // Real Supabase update query
    supabaseDb.updatePaper(id, { status }).catch((e) => console.warn('Supabase updatePaper failed', e));

    return updated;
  },

  deletePaper(id: string): boolean {
    const papers = this.getPapers();
    const paperToDelete = papers.find((p) => p.id === id);
    const filtered = papers.filter((p) => p.id !== id);
    if (filtered.length === papers.length) return false;
    this.savePapers(filtered);

    // Remove file from Supabase Storage bucket 'app-files'
    if (paperToDelete?.fileUrl) {
      supabaseStorage.deleteAppFile(paperToDelete.fileUrl).catch((e) => console.warn('Supabase deleteAppFile failed', e));
    }

    // Real Supabase delete query
    supabaseDb.deletePaper(id).catch((e) => console.warn('Supabase deletePaper failed', e));

    return true;
  },

  recordView(id: string): void {
    const papers = this.getPapers();
    const p = papers.find((item) => item.id === id);
    if (p) {
      p.viewsCount = (p.viewsCount || 0) + 1;
      this.savePapers(papers);
      supabaseDb.updatePaper(id, { viewsCount: p.viewsCount }).catch(() => {});
    }
  },

  recordDownload(id: string): void {
    const papers = this.getPapers();
    const p = papers.find((item) => item.id === id);
    if (p) {
      p.downloadsCount = (p.downloadsCount || 0) + 1;
      this.savePapers(papers);
      supabaseDb.updatePaper(id, { downloadsCount: p.downloadsCount }).catch(() => {});
    }
  },

  // Saved bookmarks
  async fetchSavedPaperIdsFromSupabase(): Promise<string[]> {
    try {
      const ids = await supabaseDb.loadSavedPaperIds();
      if (ids && ids.length > 0) {
        localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(ids));
        return ids;
      }
      return this.getSavedPaperIds();
    } catch {
      return this.getSavedPaperIds();
    }
  },

  getSavedPaperIds(): string[] {
    try {
      const stored = localStorage.getItem(SAVED_PAPERS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : ['pyq-cbse-12-phy-2024', 'pyq-jee-main-2024-session1'];
    } catch {
      return [];
    }
  },

  isPaperSaved(id: string): boolean {
    return this.getSavedPaperIds().includes(id);
  },

  toggleSavePaper(id: string): boolean {
    try {
      const saved = this.getSavedPaperIds();
      const exists = saved.includes(id);
      const next = exists ? saved.filter((i) => i !== id) : [...saved, id];
      localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(next));

      // Real Supabase insert/delete queries
      if (exists) {
        supabaseDb.removeSavedPaper(id).catch((e) => console.warn('Supabase removeSavedPaper failed', e));
      } else {
        supabaseDb.savePaper(id).catch((e) => console.warn('Supabase savePaper failed', e));
      }

      return !exists;
    } catch {
      return false;
    }
  },

  getBookmarkedPapers(): Paper[] {
    const savedIds = this.getSavedPaperIds();
    const all = this.getPapers();
    return all.filter((p) => savedIds.includes(p.id));
  },

  // Ratings & reviews (No login required)
  addReview(paperId: string, stars: number, text?: string, authorName: string = 'Student'): Paper | null {
    const papers = this.getPapers();
    const paper = papers.find((p) => p.id === paperId);
    if (!paper) return null;

    const newReview: PaperReview = {
      id: `rev-${Date.now()}`,
      stars,
      text: text?.trim(),
      authorName: authorName.trim() || 'Student',
      createdAt: new Date().toISOString(),
    };

    const currentReviews = paper.reviews || [];
    currentReviews.unshift(newReview);
    paper.reviews = currentReviews;

    const totalStars = currentReviews.reduce((acc, r) => acc + r.stars, 0);
    paper.rating = Number((totalStars / currentReviews.length).toFixed(1));
    paper.ratingCount = currentReviews.length;

    this.savePapers(papers);
    return paper;
  },

  // Comments (Login required)
  addComment(paperId: string, text: string, authorName: string, authorEmail?: string): Paper | null {
    const papers = this.getPapers();
    const paper = papers.find((p) => p.id === paperId);
    if (!paper) return null;

    const newComment: PaperComment = {
      id: `com-${Date.now()}`,
      authorName: authorName.trim(),
      authorEmail,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const currentComments = paper.comments || [];
    currentComments.unshift(newComment);
    paper.comments = currentComments;

    this.savePapers(papers);
    return paper;
  },
};
