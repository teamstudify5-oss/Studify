import { supabase } from '../supabaseClient.js';

export type StarTier = 1 | 2 | 3 | 4 | 5;

export interface AppFeedback {
  id: string;
  visitorId: string;
  authorName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackSummary {
  averageRating: number | null;
  totalRatings: number;
  totalReviews: number;
  ratingBreakdown: Record<StarTier, number>;
  userRating: number | null;
  userComment: string;
  userAuthorName: string;
  items: AppFeedback[];
  loadError?: string | null;
}

const STORAGE_KEY = 'studify_app_feedback_v2';
const VISITOR_ID_KEY = 'studify_visitor_id_v2';

export function emptyBreakdown(): Record<StarTier, number> {
  return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
}

/**
 * Retrieve or generate a persistent anonymous visitor ID
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return 'anon-visitor';
  try {
    let vid = typeof localStorage !== 'undefined' ? localStorage.getItem(VISITOR_ID_KEY) : null;
    if (!vid && typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )' + VISITOR_ID_KEY + '=([^;]+)'));
      if (match) {
        vid = decodeURIComponent(match[2]);
      }
    }
    if (!vid) {
      vid = 'vid_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(VISITOR_ID_KEY, vid);
      }
      if (typeof document !== 'undefined') {
        document.cookie = `${VISITOR_ID_KEY}=${encodeURIComponent(vid)};path=/;max-age=31536000;SameSite=Lax`;
      }
    }
    return vid;
  } catch {
    return 'vid_' + Date.now().toString(36);
  }
}

export function sanitizeComment(text: string): string {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 500);
}

export function sanitizeAuthorName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 60);
}

function isMissingRpcError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

function mapRawItem(row: any): AppFeedback {
  return {
    id: String(row.id),
    visitorId: String(row.visitor_id || ''),
    authorName: (typeof row.author_name === 'string' && row.author_name.trim()) || 'Student',
    rating: Math.min(5, Math.max(1, Math.round(Number(row.rating) || 5))),
    comment: typeof row.comment === 'string' ? row.comment : '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export function computeFeedbackBreakdown(rows: AppFeedback[], visitorId: string): FeedbackSummary {
  const breakdown = emptyBreakdown();
  let sum = 0;
  let totalReviews = 0;

  for (const item of rows) {
    const r = Math.min(5, Math.max(1, Math.round(item.rating))) as StarTier;
    breakdown[r] = (breakdown[r] || 0) + 1;
    sum += r;
    if (item.comment && item.comment.trim().length > 0) {
      totalReviews += 1;
    }
  }

  const totalRatings = rows.length;
  const averageRating = totalRatings > 0 ? Number((sum / totalRatings).toFixed(1)) : null;
  const userFeedback = rows.find((item) => item.visitorId === visitorId);

  return {
    averageRating,
    totalRatings,
    totalReviews,
    ratingBreakdown: breakdown,
    userRating: userFeedback ? userFeedback.rating : null,
    userComment: userFeedback ? userFeedback.comment : '',
    userAuthorName: userFeedback ? userFeedback.authorName : '',
    items: rows.filter((item) => item.comment && item.comment.trim().length > 0),
    loadError: null,
  };
}

export function createAppFeedbackService(client: any = supabase) {
  return {
    /**
     * Fetch live Play Store-style rating summary, 5-to-1 star distribution, and public reviews from Supabase.
     */
    async getFeedbackSummary(visitorIdOverride?: string): Promise<FeedbackSummary> {
      const visitorId = visitorIdOverride || getVisitorId();

      try {
        const rpcRes = await client.rpc('get_app_feedback_summary', {
          p_visitor_id: visitorId,
          p_limit: 50,
        });

        if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object') {
          const d: any = rpcRes.data;
          const b = d.rating_breakdown || {};
          const ratingBreakdown: Record<StarTier, number> = {
            5: Number(b['5'] || 0),
            4: Number(b['4'] || 0),
            3: Number(b['3'] || 0),
            2: Number(b['2'] || 0),
            1: Number(b['1'] || 0),
          };
          const items: AppFeedback[] = Array.isArray(d.items) ? d.items.map(mapRawItem) : [];
          const userRow = d.user_feedback ? mapRawItem(d.user_feedback) : null;

          if (typeof localStorage !== 'undefined') {
            try {
              if (items.length === 0) localStorage.removeItem(STORAGE_KEY);
              else localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            } catch {
              // ignore
            }
          }

          return {
            averageRating:
              d.average_rating !== null && d.average_rating !== undefined
                ? Number(d.average_rating)
                : null,
            totalRatings: Number(d.total_ratings || 0),
            totalReviews: Number(d.total_reviews || 0),
            ratingBreakdown,
            userRating: userRow ? userRow.rating : null,
            userComment: userRow ? userRow.comment : '',
            userAuthorName: userRow ? userRow.authorName : '',
            items,
            loadError: null,
          };
        }

        if (rpcRes.error && !isMissingRpcError(rpcRes.error)) {
          return {
            averageRating: null,
            totalRatings: 0,
            totalReviews: 0,
            ratingBreakdown: emptyBreakdown(),
            userRating: null,
            userComment: '',
            userAuthorName: '',
            items: [],
            loadError: rpcRes.error.message || 'Could not load app ratings.',
          };
        }

        // Fallback when RPC is not yet deployed: query table directly
        const { data, error } = await client
          .from('app_feedback')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) {
          return {
            averageRating: null,
            totalRatings: 0,
            totalReviews: 0,
            ratingBreakdown: emptyBreakdown(),
            userRating: null,
            userComment: '',
            userAuthorName: '',
            items: [],
            loadError: error.message || 'Could not load app ratings.',
          };
        }

        const mapped = Array.isArray(data) ? data.map(mapRawItem) : [];
        return computeFeedbackBreakdown(mapped, visitorId);
      } catch (err: any) {
        return {
          averageRating: null,
          totalRatings: 0,
          totalReviews: 0,
          ratingBreakdown: emptyBreakdown(),
          userRating: null,
          userComment: '',
          userAuthorName: '',
          items: [],
          loadError: err instanceof Error ? err.message : 'Could not load app ratings.',
        };
      }
    },

    /**
     * Save or update a visitor's public rating and/or review in Supabase.
     * Awaits real persistence and never fakes success if DB write fails.
     */
    async submitFeedback(params: {
      rating?: number;
      comment?: string;
      authorName?: string;
      visitorId?: string;
    }): Promise<{ success: boolean; feedback: AppFeedback | null; error: Error | null }> {
      const visitorId = params.visitorId || getVisitorId();
      const cleanRating =
        params.rating !== undefined && params.rating !== null
          ? Math.min(5, Math.max(1, Math.round(params.rating)))
          : null;
      const cleanComment =
        params.comment !== undefined ? sanitizeComment(params.comment) : null;
      const cleanAuthor =
        params.authorName !== undefined ? sanitizeAuthorName(params.authorName) : null;

      try {
        const rpcRes = await client.rpc('submit_app_feedback', {
          p_visitor_id: visitorId,
          p_rating: cleanRating,
          p_comment: cleanComment,
          p_author_name: cleanAuthor,
        });

        if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object') {
          const savedItem = rpcRes.data.item ? mapRawItem(rpcRes.data.item) : null;
          if (!savedItem) {
            return {
              success: false,
              feedback: null,
              error: new Error('Review could not be confirmed by server.'),
            };
          }
          return { success: true, feedback: savedItem, error: null };
        }

        if (rpcRes.error && !isMissingRpcError(rpcRes.error)) {
          return {
            success: false,
            feedback: null,
            error: new Error(rpcRes.error.message || 'Could not save rating.'),
          };
        }

        // Fallback if RPC isn't deployed yet: attempt direct upsert
        const now = new Date().toISOString();
        const fallbackPayload: Record<string, any> = {
          visitor_id: visitorId,
          rating: cleanRating ?? 5,
          comment: cleanComment ?? '',
          author_name: cleanAuthor || 'Student',
          updated_at: now,
        };

        const { data, error } = await client
          .from('app_feedback')
          .upsert(fallbackPayload, { onConflict: 'visitor_id' })
          .select()
          .single();

        if (error || !data) {
          return {
            success: false,
            feedback: null,
            error: new Error(
              error?.message ||
                'Ratings database setup is pending. Please run the latest Supabase migration.'
            ),
          };
        }

        return { success: true, feedback: mapRawItem(data), error: null };
      } catch (err: any) {
        return {
          success: false,
          feedback: null,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },

    async saveStarRating(
      rating: number,
      authorName?: string
    ): Promise<{ success: boolean; feedback: AppFeedback | null; error: Error | null }> {
      return this.submitFeedback({ rating, authorName });
    },

    async saveComment(
      commentText: string,
      rating?: number,
      authorName?: string
    ): Promise<{ success: boolean; feedback: AppFeedback | null; error: Error | null }> {
      return this.submitFeedback({
        rating,
        comment: commentText,
        authorName,
      });
    },
  };
}

export const appFeedbackService = createAppFeedbackService();
