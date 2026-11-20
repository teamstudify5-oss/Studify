import { supabase } from '../supabaseClient.js';

export const BUCKET_NAME = 'app-files';
export const APP_BUCKET = 'app-files';
export const COMMUNITY_BUCKET = 'community-pyqs';

export interface UploadOptions {
  userId: string;
  featureName: string; // e.g. 'papers', 'attachments', 'avatars'
  itemId: string;      // e.g. paperId, projectId, noteId
  file: File | Blob;
  fileName?: string;
  contentType?: string;
}

export interface UploadResult {
  path: string | null;
  error: Error | null;
}

export interface ParsedStorageLocation {
  bucket: string;
  path: string;
  isSupabaseStorage: boolean;
}

function normalizeMimeType(ext: string, explicit?: string): string {
  if (explicit && explicit !== 'application/octet-stream') {
    return explicit;
  }
  switch (ext.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'zip':
      return 'application/zip';
    default:
      return explicit || 'application/octet-stream';
  }
}

/**
 * Resolves a raw storage path, `bucket/path`, or full Supabase Storage public/sign/authenticated URL
 * into its `{ bucket, path }` pair so private-bucket operations work cleanly even for legacy `file_url` rows.
 */
function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseStorageBucketAndPath(
  rawPathOrUrl: string | undefined | null,
  defaultBucket: string = COMMUNITY_BUCKET
): ParsedStorageLocation | null {
  if (!rawPathOrUrl || typeof rawPathOrUrl !== 'string') return null;
  const trimmed = rawPathOrUrl.trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const markerMatch = trimmed.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/i
    );
    if (markerMatch && markerMatch[1] && markerMatch[2]) {
      return {
        bucket: safeDecodeURIComponent(markerMatch[1]),
        path: safeDecodeURIComponent(markerMatch[2]).replace(/^\/+/, ''),
        isSupabaseStorage: true,
      };
    }
    return {
      bucket: defaultBucket,
      path: trimmed,
      isSupabaseStorage: false,
    };
  }

  const normalized = trimmed.replace(/^\/+/, '');
  if (normalized.startsWith(`${COMMUNITY_BUCKET}/`)) {
    return {
      bucket: COMMUNITY_BUCKET,
      path: normalized.slice(COMMUNITY_BUCKET.length + 1),
      isSupabaseStorage: true,
    };
  }
  if (normalized.startsWith(`${APP_BUCKET}/`)) {
    return {
      bucket: APP_BUCKET,
      path: normalized.slice(APP_BUCKET.length + 1),
      isSupabaseStorage: true,
    };
  }

  return {
    bucket: defaultBucket,
    path: normalized,
    isSupabaseStorage: true,
  };
}

/**
 * Supabase Storage Service
 * Handles uploads, authenticated downloads, short-lived signed URLs, existence checks, and deletions
 * across both `app-files` and `community-pyqs` buckets.
 */
export const supabaseStorage = {
  /**
   * Uploads a file to the private "app-files" Supabase Storage bucket.
   * Path: ${userId}/${featureName}/${itemId}/${uuid}.${extension}
   */
  async uploadAppFile(options: UploadOptions): Promise<UploadResult> {
    const { userId, featureName, itemId, file } = options;

    if (!userId) {
      return { path: null, error: new Error('User ID is required to upload files.') };
    }

    try {
      const rawName = options.fileName || (file as File).name || 'file.pdf';
      const parts = rawName.split('.');
      const ext = (parts.length > 1 ? parts.pop()?.toLowerCase() : 'pdf') || 'pdf';
      const cleanExt = ext.replace(/[^a-z0-9]/g, '') || 'bin';

      const uuid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const safeFeature = (featureName || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeItemId = (itemId || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = `${userId}/${safeFeature}/${safeItemId}/${uuid}.${cleanExt}`;

      const detectedContentType = normalizeMimeType(
        cleanExt,
        options.contentType || file.type
      );

      const { data, error } = await supabase.storage
        .from(APP_BUCKET)
        .upload(filePath, file, {
          contentType: detectedContentType,
          upsert: true,
        });

      if (error) {
        console.warn('Supabase storage upload error:', error.message);
        return { path: null, error };
      }

      return { path: data?.path || filePath, error: null };
    } catch (err: unknown) {
      console.warn('Unexpected error uploading file:', err);
      return { path: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Downloads a file directly through Supabase authenticated storage APIs (`cache: 'no-store'`).
   * Works reliably for both private and public buckets without relying on /object/public/ URLs.
   */
  async downloadStorageBlob(
    filePathOrUrl: string | undefined | null,
    defaultBucket: string = COMMUNITY_BUCKET
  ): Promise<{ blob: Blob | null; contentType: string | null; error: Error | null; status?: number }> {
    const parsed = parseStorageBucketAndPath(filePathOrUrl, defaultBucket);
    if (!parsed || !parsed.isSupabaseStorage) {
      return {
        blob: null,
        contentType: null,
        error: new Error('Target is not a managed Supabase Storage path.'),
      };
    }

    try {
      const storageFrom = supabase.storage.from(parsed.bucket) as unknown as {
        download: (path: string, transform?: unknown, options?: { cache?: RequestCache }) => Promise<{ data: Blob | null; error: any }>;
      };
      const { data, error } = await storageFrom.download(parsed.path, undefined, {
        cache: 'no-store',
      });

      if (error || !data) {
        const status =
          typeof error?.statusCode === 'number'
            ? error.statusCode
            : typeof error?.status === 'number'
            ? error.status
            : undefined;
        return {
          blob: null,
          contentType: null,
          error: error instanceof Error ? error : new Error(error?.message || 'Storage download failed'),
          status,
        };
      }

      return {
        blob: data,
        contentType: data.type || null,
        error: null,
      };
    } catch (err: unknown) {
      return {
        blob: null,
        contentType: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  /**
   * Checks whether an object exists in a private or public Supabase Storage bucket
   * using authenticated Storage APIs rather than public HEAD URLs.
   */
  async storageObjectExists(
    filePathOrUrl: string | undefined | null,
    defaultBucket: string = COMMUNITY_BUCKET
  ): Promise<boolean | null> {
    const parsed = parseStorageBucketAndPath(filePathOrUrl, defaultBucket);
    if (!parsed || !parsed.isSupabaseStorage) return null;

    try {
      const bucketRef = supabase.storage.from(parsed.bucket) as unknown as {
        exists?: (path: string) => Promise<{ data: boolean; error: any }>;
        info?: (path: string) => Promise<{ data: unknown; error: any }>;
      };

      if (typeof bucketRef.exists === 'function') {
        const { data, error } = await bucketRef.exists(parsed.path);
        const status = Number(error?.statusCode ?? error?.status ?? 0);
        const msg = String(error?.message || '').toLowerCase();
        if (!error) return Boolean(data);
        if (data === false && (status === 404 || msg.includes('not found'))) {
          return false;
        }
        if (status === 401 || status === 403 || msg.includes('policy') || msg.includes('permission')) {
          return null;
        }
      }

      if (typeof bucketRef.info === 'function') {
        const { data, error } = await bucketRef.info(parsed.path);
        if (!error && data) return true;
        const status = Number(error?.statusCode ?? error?.status ?? 0);
        const msg = String(error?.message || '').toLowerCase();
        if (status === 404 || msg.includes('not found')) return false;
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Generates a short-lived signed URL (default 300s) for either `app-files` or `community-pyqs`.
   */
  async getSignedFileUrl(
    filePath: string | undefined | null,
    expiresIn: number = 300,
    options?: { download?: string | boolean; defaultBucket?: string }
  ): Promise<string | null> {
    if (!filePath) return null;

    if (filePath.startsWith('blob:') || filePath.startsWith('data:')) {
      return filePath;
    }

    const defaultBucket = options?.defaultBucket || APP_BUCKET;
    const parsed = parseStorageBucketAndPath(filePath, defaultBucket);

    if (!parsed) return null;
    if (!parsed.isSupabaseStorage) {
      return filePath;
    }

    try {
      const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(
          parsed.path,
          expiresIn,
          options?.download !== undefined ? { download: options.download } : undefined
        );

      if (error) {
        console.warn('Supabase createSignedUrl error for path', parsed.bucket, parsed.path, error.message);
        return null;
      }

      return data?.signedUrl || null;
    } catch (err) {
      console.warn('Exception generating signed URL for', parsed.path, err);
      return null;
    }
  },

  /**
   * Generates a short-lived signed URL that forces Content-Disposition: attachment.
   */
  async getSignedDownloadUrl(
    filePath: string | undefined | null,
    fileName?: string,
    expiresIn: number = 300,
    defaultBucket: string = APP_BUCKET
  ): Promise<string | null> {
    return this.getSignedFileUrl(filePath, expiresIn, {
      download: fileName && fileName.trim() ? fileName.trim() : true,
      defaultBucket,
    });
  },

  /**
   * Deletes an object from a managed Supabase Storage bucket (`app-files` by default).
   */
  async deleteAppFile(
    filePath: string | undefined | null,
    defaultBucket: string = APP_BUCKET
  ): Promise<boolean> {
    if (!filePath) return true;

    if (filePath.startsWith('blob:') || filePath.startsWith('data:')) {
      return true;
    }

    const parsed = parseStorageBucketAndPath(filePath, defaultBucket);
    if (!parsed || !parsed.isSupabaseStorage) {
      return true;
    }

    try {
      const { error } = await supabase.storage
        .from(parsed.bucket)
        .remove([parsed.path]);

      if (error) {
        console.warn('Supabase storage remove error for path', parsed.bucket, parsed.path, error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.warn('Exception deleting file from storage:', parsed.path, err);
      return false;
    }
  },
};
