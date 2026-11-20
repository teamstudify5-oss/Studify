const CLEAN_RESET_EPOCH_KEY = 'studify_clean_reset_epoch_v5';
const CLEAN_RESET_EPOCH_VALUE = '2026-11-17-reset-v5';

const EXACT_LOCAL_KEYS = [
  'pyq_papers_clean_v3',
  'pyq_saved_paper_ids_clean_v3',
  'studify_workspace_projects_clean_v3',
  'studify_quick_captures_clean_v3',
  'studify_workspace_session_clean_v3',
  'studify_workspace_test_purged_v3',
  'studify_test_papers_purged_v3',
  'studify_reports_cache_v3',
  'studify_app_feedback_v2',
  'studify_visitor_id_v2',
  // Legacy v1/v2 keys
  'pyq_auth_user_v1',
  'pyq_papers',
  'pyq_papers_v2',
  'pyq_saved_paper_ids',
  'pyq_saved_paper_ids_v2',
  'studify_workspace_projects_v2',
  'studify_quick_captures_v2',
  'studify_workspace_session_v2',
] as const;

const LOCAL_PREFIXES = [
  'studify_download_quota_',
  'studify_workspace_',
  'studify_quick_captures',
  'studify_reports_',
  'studify_app_feedback',
  'studify_test_',
  'studify_upload_',
  'studify_draft_',
  'pyq_papers',
  'pyq_saved_',
  'pyq_registered_',
  'tus::',
] as const;

const SESSION_PREFIXES = ['studify_', 'pyq_', 'tus::'] as const;

const PRESERVED_EXACT_KEYS = new Set<string>([
  'studify_theme',
  CLEAN_RESET_EPOCH_KEY,
]);

function isPreservedAuthOrConfigKey(key: string): boolean {
  return key.startsWith('sb-') || PRESERVED_EXACT_KEYS.has(key);
}

/**
 * Clears IndexedDB databases and Cache API entries created by Studify or TUS
 * without touching Supabase Auth storage in localStorage (sb-*).
 */
export async function clearStudifyIndexedDbAndCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      await Promise.all(
        (dbs || []).map((dbInfo) => {
          const name = dbInfo?.name;
          if (!name) return Promise.resolve();
          const lower = name.toLowerCase();
          if (lower.includes('supabase') || lower.includes('gotrue')) {
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            try {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            } catch {
              resolve();
            }
          });
        })
      );
    }
  } catch (err) {
    console.warn('clearStudifyIndexedDbAndCaches indexedDB notice:', err);
  }

  try {
    if ('caches' in window && typeof caches.keys === 'function') {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName).catch(() => false))
      );
    }
  } catch (err) {
    console.warn('clearStudifyIndexedDbAndCaches CacheStorage notice:', err);
  }
}

/**
 * Clears all Studify content caches (papers, bookmarks, workspace, quotas,
 * feedback, reports, comments, and upload/draft entries) from browser storage
 * while strictly preserving the active Supabase authentication session (sb-*)
 * and UI theme preference (studify_theme).
 */
export function clearStudifyContentCaches(): { removedKeys: string[] } {
  const removedKeys: string[] = [];

  if (typeof window === 'undefined') {
    return { removedKeys };
  }

  try {
    for (const key of EXACT_LOCAL_KEYS) {
      if (isPreservedAuthOrConfigKey(key)) continue;
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        removedKeys.push(key);
      }
    }

    const dynamicLocalKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || isPreservedAuthOrConfigKey(k)) continue;
      if (LOCAL_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        dynamicLocalKeys.push(k);
      }
    }
    for (const k of dynamicLocalKeys) {
      localStorage.removeItem(k);
      removedKeys.push(k);
    }
  } catch (err) {
    console.warn('clearStudifyContentCaches localStorage notice:', err);
  }

  try {
    const dynamicSessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || k.startsWith('sb-')) continue;
      if (SESSION_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        dynamicSessionKeys.push(k);
      }
    }
    for (const k of dynamicSessionKeys) {
      sessionStorage.removeItem(k);
      removedKeys.push(k);
    }
  } catch (err) {
    console.warn('clearStudifyContentCaches sessionStorage notice:', err);
  }

  void clearStudifyIndexedDbAndCaches();

  try {
    window.dispatchEvent(new CustomEvent('studify:caches-cleared'));
  } catch {
    // ignore
  }

  return { removedKeys };
}

/**
 * Performs an automatic one-time clean client reset on first load after the
 * factory data wipe update, removing all stale test caches from localStorage,
 * sessionStorage, IndexedDB, and CacheStorage while preserving active Supabase
 * auth sessions (sb-*) and theme preference.
 */
export function ensureOneTimeCleanReset(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(CLEAN_RESET_EPOCH_KEY) === CLEAN_RESET_EPOCH_VALUE) {
      return false;
    }
    clearStudifyContentCaches();
    localStorage.setItem(CLEAN_RESET_EPOCH_KEY, CLEAN_RESET_EPOCH_VALUE);
    return true;
  } catch {
    return false;
  }
}
