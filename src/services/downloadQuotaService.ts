import { supabase } from '../supabaseClient.js';
import { getVisitorId } from './appFeedbackService';

export interface DownloadHistoryItem {
  paperId: string;
  paperTitle: string;
  timestamp: string;
}

export interface DownloadQuota {
  identifier: string;
  userId: string | null;
  visitorId: string;
  downloadsUsed: number;
  downloadsAllowed: number;
  remainingDownloads: number;
  uploadsCompleted: number;
  currentCycleUploads: number; // 0, 1, or 2 (when 2, unlocks 10 and resets to 0)
  uploadHashes: string[];
  downloadHistory: DownloadHistoryItem[];
  isLocked: boolean;
}

const STORAGE_QUOTA_KEY = 'studify_download_quota_v1';
let lastDownloadClick: { paperId: string; time: number } | null = null;

export const downloadQuotaService = {
  /**
   * Helper to get active user ID if signed in
   */
  async getActiveUser(): Promise<{ id: string | null; email: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return { id: user.id, email: user.email || null };
      }
    } catch {
      // ignore
    }
    return { id: null, email: null };
  },

  /**
   * Get quota identifier: 'user:<uid>' if authenticated, otherwise 'anon:<visitor_id>'
   */
  async getIdentifier(): Promise<{ identifier: string; userId: string | null; visitorId: string }> {
    const user = await this.getActiveUser();
    const visitorId = getVisitorId();
    if (user.id) {
      return { identifier: `user:${user.id}`, userId: user.id, visitorId };
    }
    return { identifier: `anon:${visitorId}`, userId: null, visitorId };
  },

  /**
   * Load or initialize the current quota record
   */
  async getQuota(): Promise<DownloadQuota> {
    const { identifier, userId, visitorId } = await this.getIdentifier();

    // Default pristine quota (10 free downloads, 0 used)
    let quota: DownloadQuota = {
      identifier,
      userId,
      visitorId,
      downloadsUsed: 0,
      downloadsAllowed: 10,
      remainingDownloads: 10,
      uploadsCompleted: 0,
      currentCycleUploads: 0,
      uploadHashes: [],
      downloadHistory: [],
      isLocked: false,
    };

    // 1. Check local cache
    try {
      const localStr = localStorage.getItem(`${STORAGE_QUOTA_KEY}_${identifier}`);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        quota = {
          ...quota,
          ...parsed,
          identifier,
          userId,
          visitorId,
        };
      }
    } catch (e) {
      console.warn('Local quota read notice', e);
    }

    // 2. Fetch from Supabase user_download_quotas table
    try {
      const { data, error } = await supabase
        .from('user_download_quotas')
        .select('*')
        .eq('identifier', identifier)
        .maybeSingle();

      if (!error && data) {
        quota = {
          identifier: data.identifier,
          userId: data.user_id,
          visitorId: data.visitor_id,
          downloadsUsed: Number(data.downloads_used) || 0,
          downloadsAllowed: Number(data.downloads_allowed) || 10,
          remainingDownloads: Math.max(0, (Number(data.downloads_allowed) || 10) - (Number(data.downloads_used) || 0)),
          uploadsCompleted: Number(data.uploads_completed) || 0,
          currentCycleUploads: Number(data.current_cycle_uploads) || 0,
          uploadHashes: Array.isArray(data.upload_hashes) ? data.upload_hashes : [],
          downloadHistory: Array.isArray(data.download_history) ? data.download_history : [],
          isLocked: (Number(data.downloads_used) || 0) >= (Number(data.downloads_allowed) || 10),
        };

        // Cache updated quota locally
        try {
          localStorage.setItem(`${STORAGE_QUOTA_KEY}_${identifier}`, JSON.stringify(quota));
        } catch {
          // ignore
        }
      } else if (!data) {
        // Create initial quota row in database
        Promise.resolve(
          supabase
            .from('user_download_quotas')
            .upsert(
              {
                identifier,
                user_id: userId,
                visitor_id: visitorId,
                downloads_used: quota.downloadsUsed,
                downloads_allowed: quota.downloadsAllowed,
                uploads_completed: quota.uploadsCompleted,
                current_cycle_uploads: quota.currentCycleUploads,
                upload_hashes: quota.uploadHashes,
                download_history: quota.downloadHistory,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'identifier' }
            )
        ).catch(() => {});
      }
    } catch {
      // Offline / table fallback
    }

    quota.remainingDownloads = Math.max(0, quota.downloadsAllowed - quota.downloadsUsed);
    quota.isLocked = quota.downloadsUsed >= quota.downloadsAllowed;

    return quota;
  },

  /**
   * Check if a download is currently allowed
   */
  async canDownload(): Promise<{ allowed: boolean; remaining: number; quota: DownloadQuota }> {
    const quota = await this.getQuota();
    const remaining = Math.max(0, quota.downloadsAllowed - quota.downloadsUsed);
    return {
      allowed: remaining > 0,
      remaining,
      quota,
    };
  },

  /**
   * Record a successfully initiated PDF download
   */
  async recordSuccessfulDownload(
    paperId: string,
    paperTitle: string
  ): Promise<{ success: boolean; quota: DownloadQuota }> {
    // Debounce protection: ignore accidental double-clicks within 3 seconds for the exact same paper
    const now = Date.now();
    if (lastDownloadClick && lastDownloadClick.paperId === paperId && now - lastDownloadClick.time < 3000) {
      const currentQuota = await this.getQuota();
      return { success: true, quota: currentQuota };
    }
    lastDownloadClick = { paperId, time: now };

    const quota = await this.getQuota();

    // Check limit
    if (quota.downloadsUsed >= quota.downloadsAllowed) {
      return { success: false, quota };
    }

    const newDownloadsUsed = quota.downloadsUsed + 1;
    const historyItem: DownloadHistoryItem = {
      paperId,
      paperTitle: paperTitle || 'Question Paper PDF',
      timestamp: new Date().toISOString(),
    };
    const newHistory = [historyItem, ...quota.downloadHistory].slice(0, 50);

    const updatedQuota: DownloadQuota = {
      ...quota,
      downloadsUsed: newDownloadsUsed,
      remainingDownloads: Math.max(0, quota.downloadsAllowed - newDownloadsUsed),
      isLocked: newDownloadsUsed >= quota.downloadsAllowed,
      downloadHistory: newHistory,
    };

    // Save locally
    try {
      localStorage.setItem(`${STORAGE_QUOTA_KEY}_${quota.identifier}`, JSON.stringify(updatedQuota));
    } catch {
      // ignore
    }

    // Persist to Supabase
    Promise.resolve(
      supabase
        .from('user_download_quotas')
        .upsert(
          {
            identifier: quota.identifier,
            user_id: quota.userId,
            visitor_id: quota.visitorId,
            downloads_used: newDownloadsUsed,
            downloads_allowed: quota.downloadsAllowed,
            download_history: newHistory,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'identifier' }
        )
    ).catch(() => {});

    return { success: true, quota: updatedQuota };
  },

  /**
   * Validate that the file is a genuine PDF by inspecting the first 5 magic bytes ('%PDF-')
   */
  async validatePdfMagicBytes(file: File): Promise<{ isValid: boolean; error?: string }> {
    try {
      if (!file || file.size < 5) {
        return { isValid: false, error: 'File is empty or too small to be a valid PDF.' };
      }

      // Read first 8 bytes
      const slice = file.slice(0, 8);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Check for "%PDF" signature: 0x25, 0x50, 0x44, 0x46
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return { isValid: true };
      }

      return {
        isValid: false,
        error: 'The uploaded file is not a valid PDF document (missing authentic %PDF file header). Please upload a legitimate PDF file.',
      };
    } catch (e: any) {
      return { isValid: false, error: 'Failed to inspect file format: ' + (e?.message || 'Unknown error') };
    }
  },

  /**
   * Compute SHA-256 hash of a file for duplicate rejection
   */
  async computeFileHash(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback hash based on size and name if crypto.subtle is unavailable
      return `hash_${file.size}_${file.name.replace(/\s+/g, '_')}`;
    }
  },

  /**
   * Record a successful unique PDF upload contribution
   * When 2 uploads are completed, unlocks 10 more downloads!
   */
  async recordPdfContribution(
    fileHash: string,
    paperId: string
  ): Promise<{
    success: boolean;
    unlocked: boolean;
    currentCycleUploads: number;
    quota: DownloadQuota;
    error?: string;
  }> {
    const quota = await this.getQuota();

    // Check if this user has already uploaded this exact file hash
    if (quota.uploadHashes.includes(fileHash)) {
      return {
        success: false,
        unlocked: false,
        currentCycleUploads: quota.currentCycleUploads,
        quota,
        error: 'Duplicate upload: You have already contributed this exact PDF document previously. Please contribute a unique past paper.',
      };
    }

    const newHashes = [...quota.uploadHashes, fileHash];
    const newUploadsCompleted = quota.uploadsCompleted + 1;
    let newCycleUploads = quota.currentCycleUploads + 1;
    let newDownloadsAllowed = quota.downloadsAllowed;
    let unlocked = false;

    // Rule: Every 2 successful PDF uploads unlock 10 more downloads!
    if (newCycleUploads >= 2) {
      newDownloadsAllowed += 10;
      newCycleUploads = 0;
      unlocked = true;
    }

    const updatedQuota: DownloadQuota = {
      ...quota,
      downloadsAllowed: newDownloadsAllowed,
      uploadsCompleted: newUploadsCompleted,
      currentCycleUploads: newCycleUploads,
      uploadHashes: newHashes,
      remainingDownloads: Math.max(0, newDownloadsAllowed - quota.downloadsUsed),
      isLocked: quota.downloadsUsed >= newDownloadsAllowed,
    };

    // Save locally
    try {
      localStorage.setItem(`${STORAGE_QUOTA_KEY}_${quota.identifier}`, JSON.stringify(updatedQuota));
    } catch {
      // ignore
    }

    // Persist to Supabase
    Promise.resolve(
      supabase
        .from('user_download_quotas')
        .upsert(
          {
            identifier: quota.identifier,
            user_id: quota.userId,
            visitor_id: quota.visitorId,
            downloads_allowed: newDownloadsAllowed,
            uploads_completed: newUploadsCompleted,
            current_cycle_uploads: newCycleUploads,
            upload_hashes: newHashes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'identifier' }
        )
    ).catch(() => {});

    return {
      success: true,
      unlocked,
      currentCycleUploads: newCycleUploads,
      quota: updatedQuota,
    };
  },

  /**
   * When an anonymous visitor registers or signs in, merge their download history into their user quota
   * so they cannot reset the counter simply by creating an account.
   */
  async mergeAnonymousQuotaIntoUser(userId: string): Promise<DownloadQuota> {
    const visitorId = getVisitorId();
    const anonIdentifier = `anon:${visitorId}`;
    const userIdentifier = `user:${userId}`;

    let anonQuota: DownloadQuota | null = null;
    try {
      const str = localStorage.getItem(`${STORAGE_QUOTA_KEY}_${anonIdentifier}`);
      if (str) anonQuota = JSON.parse(str);
    } catch {
      // ignore
    }

    const userQuota = await this.getQuota();

    if (anonQuota && anonQuota.downloadsUsed > 0) {
      // Merge: take the max downloads used so counter cannot be reset
      const mergedUsed = Math.max(userQuota.downloadsUsed, anonQuota.downloadsUsed);
      const mergedAllowed = Math.max(userQuota.downloadsAllowed, anonQuota.downloadsAllowed);
      const mergedHistory = [...userQuota.downloadHistory, ...anonQuota.downloadHistory].slice(0, 50);

      const merged: DownloadQuota = {
        ...userQuota,
        downloadsUsed: mergedUsed,
        downloadsAllowed: mergedAllowed,
        remainingDownloads: Math.max(0, mergedAllowed - mergedUsed),
        isLocked: mergedUsed >= mergedAllowed,
        downloadHistory: mergedHistory,
      };

      try {
        localStorage.setItem(`${STORAGE_QUOTA_KEY}_${userIdentifier}`, JSON.stringify(merged));
      } catch {
        // ignore
      }

      Promise.resolve(
        supabase
          .from('user_download_quotas')
          .upsert(
            {
              identifier: userIdentifier,
              user_id: userId,
              visitor_id: visitorId,
              downloads_used: mergedUsed,
              downloads_allowed: mergedAllowed,
              download_history: mergedHistory,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'identifier' }
          )
      ).catch(() => {});

      return merged;
    }

    return userQuota;
  },
};
