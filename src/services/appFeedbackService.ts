import { supabase } from '../supabaseClient.js';

export interface AppFeedback {
  id: string;
  visitorId: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackSummary {
  averageRating: number | null;
  totalRatings: number;
  userRating: number | null;
  userComment: string;
  items: AppFeedback[];
}

const STORAGE_KEY = 'studify_app_feedback_v2';
const VISITOR_ID_KEY = 'studify_visitor_id_v2';

/**
 * Retrieve or generate a persistent anonymous visitor ID
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'anon-visitor';
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid) {
      // Check cookies
      const match = document.cookie.match(new RegExp('(^| )' + VISITOR_ID_KEY + '=([^;]+)'));
      if (match) {
        vid = decodeURIComponent(match[2]);
      }
    }
    if (!vid) {
      vid = 'vid_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(VISITOR_ID_KEY, vid);
      document.cookie = `${VISITOR_ID_KEY}=${encodeURIComponent(vid)};path=/;max-age=31536000;SameSite=Lax`;
    }
    return vid;
  } catch {
    return 'vid_' + Date.now().toString(36);
  }
}

/**
 * Sanitize user input comment
 */
function sanitizeComment(text: string): string {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '') // strip HTML brackets
    .trim()
    .slice(0, 350); // maximum 350 characters
}

export const appFeedbackService = {
  /**
   * Fetch real feedback summary from Supabase and local cache.
   * Absolutely NO fabricated, fake, or pre-populated sample reviews!
   */
  async getFeedbackSummary(): Promise<FeedbackSummary> {
    const visitorId = getVisitorId();
    let localItems: AppFeedback[] = [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localItems = parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read local feedback', e);
    }

    // Try fetching real submissions from Supabase table
    try {
      const { data, error } = await supabase
        .from('app_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        localItems = data.map((row: any) => ({
          id: row.id,
          visitorId: row.visitor_id,
          rating: Number(row.rating),
          comment: row.comment || '',
          createdAt: row.created_at,
          updatedAt: row.updated_at || row.created_at,
        }));
        // Update local cache with real data
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localItems));
        } catch {
          // ignore
        }
      }
    } catch {
      // Supabase table or network fallback: use localItems
    }

    // Identify current visitor's existing rating and comment
    const userFeedback = localItems.find((item) => item.visitorId === visitorId);

    const totalRatings = localItems.length;
    const averageRating =
      totalRatings > 0
        ? Number((localItems.reduce((acc, curr) => acc + curr.rating, 0) / totalRatings).toFixed(1))
        : null;

    return {
      averageRating,
      totalRatings,
      userRating: userFeedback ? userFeedback.rating : null,
      userComment: userFeedback ? userFeedback.comment : '',
      items: localItems,
    };
  },

  /**
   * Save star rating immediately upon selection without requiring an account.
   */
  async saveStarRating(rating: number): Promise<{ success: boolean; feedback: AppFeedback }> {
    const visitorId = getVisitorId();
    const cleanRating = Math.min(5, Math.max(1, Math.round(rating)));

    // Load current items
    const summary = await this.getFeedbackSummary();
    const existingIndex = summary.items.findIndex((item) => item.visitorId === visitorId);

    const now = new Date().toISOString();
    let updatedFeedback: AppFeedback;

    if (existingIndex >= 0) {
      updatedFeedback = {
        ...summary.items[existingIndex],
        rating: cleanRating,
        updatedAt: now,
      };
      summary.items[existingIndex] = updatedFeedback;
    } else {
      updatedFeedback = {
        id: 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
        visitorId,
        rating: cleanRating,
        comment: '',
        createdAt: now,
        updatedAt: now,
      };
      summary.items.unshift(updatedFeedback);
    }

    // Save to local cache immediately
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summary.items));
    } catch {
      // ignore
    }

    // Persist to Supabase app_feedback table
    Promise.resolve(
      supabase
        .from('app_feedback')
        .upsert(
          {
            visitor_id: visitorId,
            rating: cleanRating,
            comment: updatedFeedback.comment,
            updated_at: now,
          },
          { onConflict: 'visitor_id' }
        )
    )
      .then((res: any) => {
        if (res?.error) {
          console.info('app_feedback remote sync notice:', res.error.message);
        }
      })
      .catch(() => {});

    return { success: true, feedback: updatedFeedback };
  },

  /**
   * Save or update the optional comment on the visitor's rating.
   */
  async saveComment(commentText: string): Promise<{ success: boolean; feedback: AppFeedback | null }> {
    const visitorId = getVisitorId();
    const sanitized = sanitizeComment(commentText);

    const summary = await this.getFeedbackSummary();
    const existingIndex = summary.items.findIndex((item) => item.visitorId === visitorId);

    const now = new Date().toISOString();
    let updatedFeedback: AppFeedback;

    if (existingIndex >= 0) {
      updatedFeedback = {
        ...summary.items[existingIndex],
        comment: sanitized,
        updatedAt: now,
      };
      summary.items[existingIndex] = updatedFeedback;
    } else {
      // If user types comment before picking a star, default to 5 stars
      updatedFeedback = {
        id: 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
        visitorId,
        rating: 5,
        comment: sanitized,
        createdAt: now,
        updatedAt: now,
      };
      summary.items.unshift(updatedFeedback);
    }

    // Save locally
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summary.items));
    } catch {
      // ignore
    }

    // Persist to Supabase
    Promise.resolve(
      supabase
        .from('app_feedback')
        .upsert(
          {
            visitor_id: visitorId,
            rating: updatedFeedback.rating,
            comment: sanitized,
            updated_at: now,
          },
          { onConflict: 'visitor_id' }
        )
    )
      .then((res: any) => {
        if (res?.error) {
          console.info('app_feedback remote comment sync notice:', res.error.message);
        }
      })
      .catch(() => {});

    return { success: true, feedback: updatedFeedback };
  },
};
