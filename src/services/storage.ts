import { Paper, PaperStatus, PaperComment } from '../types';
import { supabaseDb } from './supabaseDb';
import { communityPyqService } from './communityPyqService';

const LEGACY_PAPER_CACHE_KEYS = [
  'pyq_papers_clean_v3',
  'pyq_papers_v2',
  'pyq_papers',
  'studify_test_papers_purged_v3',
] as const;

const LEGACY_BOOKMARK_CACHE_KEYS = [
  'pyq_saved_paper_ids_v2',
  'pyq_saved_paper_ids',
] as const;

const SAVED_PAPERS_STORAGE_KEY = 'pyq_saved_paper_ids_clean_v3';

// In-memory store only for the active runtime session — never resurrected from stale localStorage
let inMemoryPapers: Paper[] = [];
let inMemorySavedPaperIds: string[] = [];

function purgeStalePaperCacheKeys() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of LEGACY_PAPER_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
    for (const key of LEGACY_BOOKMARK_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

purgeStalePaperCacheKeys();

export const storageService = {
  /**
   * Authoritative sync from Supabase (`community_pyqs`).
   * - Never preloads or falls back to stale localStorage papers.
   * - Empty DB (`[]`) always overwrites in-memory state cleanly.
   */
  async fetchPapersFromSupabaseWithStatus(): Promise<{ papers: Paper[]; synced: boolean; error: Error | null }> {
    purgeStalePaperCacheKeys();
    const res = await communityPyqService.fetchCommunityPyqsWithStatus();
    if (!res.error) {
      inMemoryPapers = res.papers;
      return { papers: inMemoryPapers, synced: true, error: null };
    }
    inMemoryPapers = [];
    return { papers: [], synced: false, error: res.error };
  },

  async fetchPapersFromSupabase(): Promise<Paper[]> {
    const res = await this.fetchPapersFromSupabaseWithStatus();
    return res.papers;
  },

  getPapers(): Paper[] {
    return [...inMemoryPapers];
  },

  savePapers(papers: Paper[]): void {
    inMemoryPapers = Array.isArray(papers) ? [...papers] : [];
    purgeStalePaperCacheKeys();
  },

  savePaper(paper: Paper): void {
    const papers = this.getPapers();
    const index = papers.findIndex((p) => p.id === paper.id);
    if (index >= 0) {
      papers[index] = paper;
    } else {
      papers.unshift(paper);
    }
    this.savePapers(papers);
  },

  getApprovedPapers(): Paper[] {
    return inMemoryPapers.filter((p) => p.status === 'approved' || p.status === 'active');
  },

  getAllPapersForOwner(): Paper[] {
    return this.getPapers();
  },

  getUserSubmissions(userId: string): Paper[] {
    return inMemoryPapers.filter((p) => p.submittedBy.id === userId);
  },

  getPaperById(id: string): Paper | undefined {
    return inMemoryPapers.find((p) => p.id === id);
  },

  submitPaper(
    data: Omit<Paper, 'id' | 'status' | 'submittedAt' | 'viewsCount' | 'downloadsCount'> & { id?: string },
  ): Paper {
    const newPaper: Paper = {
      ...data,
      id: data.id || `pyq-user-${Date.now()}`,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      viewsCount: 0,
      downloadsCount: 0,
      rating: undefined,
      ratingCount: 0,
      reviews: [],
      comments: [],
    };
    inMemoryPapers = [newPaper, ...inMemoryPapers];

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

    supabaseDb.updatePaper(id, { status }).catch((e) => console.warn('Supabase updatePaper failed', e));

    return updated;
  },

  removePaperFromLocalCache(id: string): boolean {
    const prevLength = inMemoryPapers.length;
    inMemoryPapers = inMemoryPapers.filter((p) => p.id !== id);
    inMemorySavedPaperIds = inMemorySavedPaperIds.filter((savedId) => savedId !== id);
    if (typeof localStorage !== 'undefined') {
      try {
        if (inMemorySavedPaperIds.length === 0) {
          localStorage.removeItem(SAVED_PAPERS_STORAGE_KEY);
        } else {
          localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(inMemorySavedPaperIds));
        }
      } catch {
        // ignore
      }
    }
    purgeStalePaperCacheKeys();
    return inMemoryPapers.length !== prevLength;
  },

  async deletePaper(id: string): Promise<boolean> {
    const target = inMemoryPapers.find((p) => p.id === id);
    const res = await communityPyqService.deleteCommunityPyq(id, target?.filePath || target?.fileUrl);
    if (res.success) {
      this.removePaperFromLocalCache(id);
      return true;
    }
    return false;
  },

  recordView(id: string): void {
    const p = inMemoryPapers.find((item) => item.id === id);
    if (p) {
      p.viewsCount = (p.viewsCount || 0) + 1;
    }
    communityPyqService.incrementView(id);
  },

  recordDownload(id: string): void {
    const p = inMemoryPapers.find((item) => item.id === id);
    if (p) {
      p.downloadsCount = (p.downloadsCount || 0) + 1;
    }
    communityPyqService.incrementDownload(id);
  },

  /**
   * Authoritative bookmark sync from Supabase `saved_papers`.
   * Signed-out users always receive `[]`; stale localStorage bookmarks are cleared.
   */
  async fetchSavedPaperIdsFromSupabaseWithStatus(): Promise<{ ids: string[]; synced: boolean; error: Error | null }> {
    const res = await supabaseDb.loadSavedPaperIdsWithStatus();
    if (res.synced) {
      inMemorySavedPaperIds = res.ids;
      if (typeof localStorage !== 'undefined') {
        try {
          if (res.ids.length === 0) {
            localStorage.removeItem(SAVED_PAPERS_STORAGE_KEY);
          } else {
            localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(res.ids));
          }
        } catch {
          // ignore
        }
      }
      return { ids: [...inMemorySavedPaperIds], synced: true, error: null };
    }
    inMemorySavedPaperIds = [];
    return { ids: [], synced: false, error: res.error };
  },

  async fetchSavedPaperIdsFromSupabase(): Promise<string[]> {
    const res = await this.fetchSavedPaperIdsFromSupabaseWithStatus();
    return res.ids;
  },

  /**
   * Prunes savedPaperIds that point to papers no longer present in the authoritative library.
   * Only runs when `papers` has been authoritatively synced (`synced: true`).
   */
  async pruneInvalidSavedPaperIds(validPaperIds: Set<string>): Promise<string[]> {
    const current = [...inMemorySavedPaperIds];
    const invalidIds = current.filter((id) => !validPaperIds.has(id));
    if (invalidIds.length === 0) {
      return current;
    }

    const validOnly = current.filter((id) => validPaperIds.has(id));
    inMemorySavedPaperIds = validOnly;
    if (typeof localStorage !== 'undefined') {
      try {
        if (validOnly.length === 0) {
          localStorage.removeItem(SAVED_PAPERS_STORAGE_KEY);
        } else {
          localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(validOnly));
        }
      } catch {
        // ignore
      }
    }

    await supabaseDb.pruneInvalidSavedPapers(invalidIds);
    return validOnly;
  },

  clearInMemoryState(): void {
    inMemoryPapers = [];
    inMemorySavedPaperIds = [];
    purgeStalePaperCacheKeys();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(SAVED_PAPERS_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },

  getSavedPaperIds(): string[] {
    return [...inMemorySavedPaperIds];
  },

  isPaperSaved(id: string): boolean {
    return inMemorySavedPaperIds.includes(id);
  },

  async toggleSavePaperAsync(id: string): Promise<{ isSaved: boolean; error: Error | null }> {
    try {
      const saved = this.getSavedPaperIds();
      const exists = saved.includes(id);
      const next = exists ? saved.filter((i) => i !== id) : [...saved, id];

      let opSuccess = false;
      if (exists) {
        opSuccess = await supabaseDb.removeSavedPaper(id);
      } else {
        opSuccess = await supabaseDb.savePaper(id);
      }

      if (!opSuccess) {
        return { isSaved: exists, error: new Error('Failed to update bookmark in database') };
      }

      inMemorySavedPaperIds = next;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return { isSaved: !exists, error: null };
    } catch (err: any) {
      return { isSaved: this.isPaperSaved(id), error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  toggleSavePaper(id: string): boolean {
    try {
      const saved = this.getSavedPaperIds();
      const exists = saved.includes(id);
      const next = exists ? saved.filter((i) => i !== id) : [...saved, id];
      inMemorySavedPaperIds = next;
      try {
        localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }

      if (exists) {
        supabaseDb.removeSavedPaper(id).then((ok) => {
          if (!ok) {
            inMemorySavedPaperIds = saved;
            try {
              localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(saved));
            } catch {
              // ignore
            }
          }
        });
      } else {
        supabaseDb.savePaper(id).then((ok) => {
          if (!ok) {
            inMemorySavedPaperIds = saved;
            try {
              localStorage.setItem(SAVED_PAPERS_STORAGE_KEY, JSON.stringify(saved));
            } catch {
              // ignore
            }
          }
        });
      }

      return !exists;
    } catch {
      return false;
    }
  },

  getBookmarkedPapers(): Paper[] {
    const savedIds = this.getSavedPaperIds();
    return inMemoryPapers.filter((p) => savedIds.includes(p.id));
  },

  addComment(paperId: string, text: string, authorName: string, authorEmail?: string): Paper | null {
    const paper = inMemoryPapers.find((p) => p.id === paperId);
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

    return paper;
  },
};
