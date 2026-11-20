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

export interface GuestQuotaRpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: any; error: any }>;
}

const STORAGE_QUOTA_KEY = 'studify_download_quota_v1';
const GUEST_TOKEN_STORAGE_KEY = 'studify_guest_quota_token_v1';
let lastDownloadClick: { paperId: string; time: number } | null = null;

function isRpcMissingError(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

function isInvalidSignatureError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('invalid guest token') ||
    msg.includes('invalid signature') ||
    msg.includes('forged') ||
    msg.includes('tampered')
  );
}

function buildDefaultQuota(identifier: string, userId: string | null, visitorId: string): DownloadQuota {
  return {
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
}

function mapRowToQuota(
  data: any,
  fallbackIdentifier: string,
  userId: string | null,
  fallbackVisitorId: string
): DownloadQuota {
  const downloadsUsed = Number(data?.downloads_used) || 0;
  const downloadsAllowed = Number(data?.downloads_allowed) || 10;
  return {
    identifier: data?.identifier || fallbackIdentifier,
    userId: data?.user_id ?? userId,
    visitorId: data?.visitor_id || fallbackVisitorId,
    downloadsUsed,
    downloadsAllowed,
    remainingDownloads: Math.max(0, downloadsAllowed - downloadsUsed),
    uploadsCompleted: Number(data?.uploads_completed) || 0,
    currentCycleUploads: Number(data?.current_cycle_uploads) || 0,
    uploadHashes: Array.isArray(data?.upload_hashes) ? data.upload_hashes : [],
    downloadHistory: Array.isArray(data?.download_history) ? data.download_history : [],
    isLocked: downloadsUsed >= downloadsAllowed,
  };
}

function readStoredGuestToken(): string | null {
  try {
    const token = localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
    return token && token.includes('.') ? token : null;
  } catch {
    return null;
  }
}

function writeStoredGuestToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

function extractVisitorIdFromToken(token: string | null, fallback: string): string {
  if (!token || !token.includes('.')) return fallback;
  return token.split('.')[0] || fallback;
}

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
   * Obtains (or re-issues if absent) a server-signed guest quota token (`visitor_id.signature`).
   * Rejects tampered tokens explicitly rather than treating a client-generated visitor_id as truth.
   */
  async ensureSignedGuestToken(
    rpcClient: GuestQuotaRpcClient = supabase
  ): Promise<{ token: string | null; visitorId: string; mode: 'rpc' | 'legacy_fallback' }> {
    const existingToken = readStoredGuestToken();
    if (existingToken) {
      return {
        token: existingToken,
        visitorId: extractVisitorIdFromToken(existingToken, getVisitorId()),
        mode: 'rpc',
      };
    }

    try {
      const { data, error } = await rpcClient.rpc('issue_guest_quota_token');
      if (!error && typeof data === 'string' && data.includes('.')) {
        writeStoredGuestToken(data);
        return {
          token: data,
          visitorId: extractVisitorIdFromToken(data, getVisitorId()),
          mode: 'rpc',
        };
      }

      if (error && !isRpcMissingError(error)) {
        throw new Error(error.message || 'Failed to issue guest quota token.');
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes('does not exist')) {
        console.warn('Guest quota token issuance warning:', err.message);
      }
    }

    return {
      token: null,
      visitorId: getVisitorId(),
      mode: 'legacy_fallback',
    };
  },

  /**
   * Verifies/fetches a signed guest quota directly via RPC (usable cleanly in unit tests as well).
   */
  async verifyAndGetGuestQuota(
    signedToken: string,
    rpcClient: GuestQuotaRpcClient = supabase
  ): Promise<{ ok: boolean; quota: DownloadQuota | null; error?: string }> {
    if (!signedToken || !signedToken.includes('.')) {
      return { ok: false, quota: null, error: 'Invalid guest token format.' };
    }

    const { data, error } = await rpcClient.rpc('get_guest_download_quota', {
      p_token: signedToken,
    });

    if (error) {
      return {
        ok: false,
        quota: null,
        error: isInvalidSignatureError(error)
          ? 'Guest quota token signature is invalid.'
          : error.message || 'Failed to verify guest quota token.',
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { ok: false, quota: null, error: 'Guest quota record was not returned.' };
    }

    const visitorId = extractVisitorIdFromToken(signedToken, getVisitorId());
    return {
      ok: true,
      quota: mapRowToQuota(row, `anon:${visitorId}`, null, visitorId),
    };
  },

  /**
   * Get quota identifier: 'user:<uid>' if authenticated, otherwise 'anon:<server_visitor_id>'
   */
  async getIdentifier(): Promise<{ identifier: string; userId: string | null; visitorId: string; guestToken: string | null }> {
    const user = await this.getActiveUser();
    const guestToken = readStoredGuestToken();
    const visitorId = extractVisitorIdFromToken(guestToken, getVisitorId());
    if (user.id) {
      return { identifier: `user:${user.id}`, userId: user.id, visitorId, guestToken };
    }
    return { identifier: `anon:${visitorId}`, userId: null, visitorId, guestToken };
  },

  /**
   * Load or initialize the current quota record
   */
  async getQuota(): Promise<DownloadQuota> {
    const activeUser = await this.getActiveUser();

    // Authenticated user path: auth.uid()-scoped RPC first, direct owner-scoped table fallback
    if (activeUser.id) {
      const identifier = `user:${activeUser.id}`;
      const visitorId = extractVisitorIdFromToken(readStoredGuestToken(), getVisitorId());
      let quota = buildDefaultQuota(identifier, activeUser.id, visitorId);

      try {
        const localStr = localStorage.getItem(`${STORAGE_QUOTA_KEY}_${identifier}`);
        if (localStr) {
          quota = { ...quota, ...JSON.parse(localStr), identifier, userId: activeUser.id, visitorId };
        }
      } catch {
        // ignore local read error
      }

      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_auth_download_quota', {
          p_visitor_id: visitorId,
        });
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!rpcError && row) {
          quota = mapRowToQuota(row, identifier, activeUser.id, visitorId);
          try {
            localStorage.setItem(`${STORAGE_QUOTA_KEY}_${identifier}`, JSON.stringify(quota));
          } catch {
            // ignore
          }
          return quota;
        }

        // Legacy fallback when SQL migration hasn't been applied yet
        if (!rpcError || isRpcMissingError(rpcError)) {
          const { data, error } = await supabase
            .from('user_download_quotas')
            .select('*')
            .eq('identifier', identifier)
            .maybeSingle();

          if (!error && data) {
            quota = mapRowToQuota(data, identifier, activeUser.id, visitorId);
            try {
              localStorage.setItem(`${STORAGE_QUOTA_KEY}_${identifier}`, JSON.stringify(quota));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // offline fallback
      }

      quota.remainingDownloads = Math.max(0, quota.downloadsAllowed - quota.downloadsUsed);
      quota.isLocked = quota.downloadsUsed >= quota.downloadsAllowed;
      return quota;
    }

    // Anonymous guest path: server-issued signed token RPC (never trusts spoofed client visitor_id)
    const tokenResult = await this.ensureSignedGuestToken();
    const identifier = `anon:${tokenResult.visitorId}`;
    let quota = buildDefaultQuota(identifier, null, tokenResult.visitorId);

    if (tokenResult.token) {
      const verified = await this.verifyAndGetGuestQuota(tokenResult.token);
      if (verified.ok && verified.quota) {
        try {
          localStorage.setItem(`${STORAGE_QUOTA_KEY}_${verified.quota.identifier}`, JSON.stringify(verified.quota));
        } catch {
          // ignore
        }
        return verified.quota;
      }

      // If stored token became invalid/revoked, mint a fresh signed token once
      writeStoredGuestToken(null);
      const reissued = await this.ensureSignedGuestToken();
      if (reissued.token) {
        const reVerified = await this.verifyAndGetGuestQuota(reissued.token);
        if (reVerified.ok && reVerified.quota) {
          return reVerified.quota;
        }
      }
    }

    try {
      const localStr = localStorage.getItem(`${STORAGE_QUOTA_KEY}_${identifier}`);
      if (localStr) {
        quota = { ...quota, ...JSON.parse(localStr), identifier, userId: null, visitorId: tokenResult.visitorId };
      }
    } catch {
      // ignore
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
   * Record a successfully initiated download
   */
  async recordSuccessfulDownload(
    paperId: string,
    paperTitle: string
  ): Promise<{ success: boolean; quota: DownloadQuota }> {
    const now = Date.now();
    if (lastDownloadClick && lastDownloadClick.paperId === paperId && now - lastDownloadClick.time < 3000) {
      const currentQuota = await this.getQuota();
      return { success: true, quota: currentQuota };
    }
    lastDownloadClick = { paperId, time: now };

    const activeUser = await this.getActiveUser();

    if (activeUser.id) {
      const quota = await this.getQuota();
      if (quota.downloadsUsed >= quota.downloadsAllowed) {
        return { success: false, quota };
      }

      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('record_auth_download_quota', {
          p_paper_id: paperId,
          p_paper_title: paperTitle || 'Question Paper',
          p_visitor_id: quota.visitorId,
        });
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!rpcError && row) {
          const updated = mapRowToQuota(row, quota.identifier, activeUser.id, quota.visitorId);
          try {
            localStorage.setItem(`${STORAGE_QUOTA_KEY}_${updated.identifier}`, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return {
            success: updated.downloadsUsed <= updated.downloadsAllowed && updated.downloadsUsed > quota.downloadsUsed,
            quota: updated,
          };
        }
      } catch {
        // fallback below if RPC not yet deployed
      }

      const newDownloadsUsed = quota.downloadsUsed + 1;
      const historyItem: DownloadHistoryItem = {
        paperId,
        paperTitle: paperTitle || 'Question Paper',
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
      try {
        localStorage.setItem(`${STORAGE_QUOTA_KEY}_${quota.identifier}`, JSON.stringify(updatedQuota));
      } catch {
        // ignore
      }
      Promise.resolve(
        supabase
          .from('user_download_quotas')
          .upsert(
            {
              identifier: quota.identifier,
              user_id: activeUser.id,
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
    }

    // Guest path via server-signed token RPC
    const tokenResult = await this.ensureSignedGuestToken();
    const quota = await this.getQuota();
    if (quota.downloadsUsed >= quota.downloadsAllowed) {
      return { success: false, quota };
    }

    if (tokenResult.token) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('record_guest_download_quota', {
          p_token: tokenResult.token,
          p_paper_id: paperId,
          p_paper_title: paperTitle || 'Question Paper',
        });
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!rpcError && row) {
          const updated = mapRowToQuota(row, quota.identifier, null, quota.visitorId);
          try {
            localStorage.setItem(`${STORAGE_QUOTA_KEY}_${updated.identifier}`, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return { success: true, quota: updated };
        }
        if (rpcError && !isRpcMissingError(rpcError)) {
          return { success: false, quota };
        }
      } catch {
        // ignore
      }
    }

    // Local-only guest cache fallback when guest RPC isn't yet deployed (never mutates DB directly as anon)
    const newDownloadsUsed = quota.downloadsUsed + 1;
    const historyItem: DownloadHistoryItem = {
      paperId,
      paperTitle: paperTitle || 'Question Paper',
      timestamp: new Date().toISOString(),
    };
    const updatedQuota: DownloadQuota = {
      ...quota,
      downloadsUsed: newDownloadsUsed,
      remainingDownloads: Math.max(0, quota.downloadsAllowed - newDownloadsUsed),
      isLocked: newDownloadsUsed >= quota.downloadsAllowed,
      downloadHistory: [historyItem, ...quota.downloadHistory].slice(0, 50),
    };
    try {
      localStorage.setItem(`${STORAGE_QUOTA_KEY}_${quota.identifier}`, JSON.stringify(updatedQuota));
    } catch {
      // ignore
    }
    return { success: true, quota: updatedQuota };
  },

  /**
   * Validate that the file is a genuine PDF by inspecting the first 4 magic bytes ('%PDF')
   */
  async validatePdfMagicBytes(file: File): Promise<{ isValid: boolean; error?: string }> {
    try {
      if (!file || file.size < 5) {
        return { isValid: false, error: 'File is empty or too small to be a valid PDF.' };
      }

      const slice = file.slice(0, 8);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

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
      return `hash_${file.size}_${file.name.replace(/\s+/g, '_')}`;
    }
  },

  /**
   * Record a successful unique PDF upload contribution (authenticated users).
   * When 2 uploads are completed, unlocks 10 more downloads!
   */
  async recordPdfContribution(
    fileHash: string,
    _paperId: string
  ): Promise<{
    success: boolean;
    unlocked: boolean;
    currentCycleUploads: number;
    quota: DownloadQuota;
    error?: string;
  }> {
    const activeUser = await this.getActiveUser();
    const quota = await this.getQuota();

    if (quota.uploadHashes.includes(fileHash)) {
      return {
        success: false,
        unlocked: false,
        currentCycleUploads: quota.currentCycleUploads,
        quota,
        error: 'Duplicate upload: You have already contributed this exact PDF document previously. Please contribute a unique past paper.',
      };
    }

    if (activeUser.id) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('record_auth_upload_quota', {
          p_file_hash: fileHash,
          p_visitor_id: quota.visitorId,
        });
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!rpcError && row) {
          const updated = mapRowToQuota(row, quota.identifier, activeUser.id, quota.visitorId);
          const unlocked = updated.downloadsAllowed > quota.downloadsAllowed;
          try {
            localStorage.setItem(`${STORAGE_QUOTA_KEY}_${updated.identifier}`, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return {
            success: true,
            unlocked,
            currentCycleUploads: updated.currentCycleUploads,
            quota: updated,
          };
        }
        if (rpcError && String(rpcError.message || '').toLowerCase().includes('duplicate')) {
          return {
            success: false,
            unlocked: false,
            currentCycleUploads: quota.currentCycleUploads,
            quota,
            error: 'Duplicate upload: You have already contributed this exact PDF document previously.',
          };
        }
      } catch {
        // fallback below if RPC not deployed yet
      }
    }

    const newHashes = [...quota.uploadHashes, fileHash];
    const newUploadsCompleted = quota.uploadsCompleted + 1;
    let newCycleUploads = quota.currentCycleUploads + 1;
    let newDownloadsAllowed = quota.downloadsAllowed;
    let unlocked = false;

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

    try {
      localStorage.setItem(`${STORAGE_QUOTA_KEY}_${quota.identifier}`, JSON.stringify(updatedQuota));
    } catch {
      // ignore
    }

    if (activeUser.id) {
      Promise.resolve(
        supabase
          .from('user_download_quotas')
          .upsert(
            {
              identifier: quota.identifier,
              user_id: activeUser.id,
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
    }

    return {
      success: true,
      unlocked,
      currentCycleUploads: newCycleUploads,
      quota: updatedQuota,
    };
  },

  /**
   * When an anonymous visitor signs in, merge their server-verified guest quota into their authenticated quota
   * via `merge_guest_quota_into_user` RPC so quota limits cannot be reset by creating an account.
   */
  async mergeAnonymousQuotaIntoUser(userId: string): Promise<DownloadQuota> {
    const guestToken = readStoredGuestToken();
    const visitorId = extractVisitorIdFromToken(guestToken, getVisitorId());

    if (guestToken) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('merge_guest_quota_into_user', {
          p_guest_token: guestToken,
        });
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!rpcError && row) {
          const merged = mapRowToQuota(row, `user:${userId}`, userId, visitorId);
          try {
            localStorage.setItem(`${STORAGE_QUOTA_KEY}_user:${userId}`, JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        }
      } catch {
        // fallback below if RPC not yet deployed
      }
    }

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
