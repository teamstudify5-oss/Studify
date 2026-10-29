import { supabase } from '../supabaseClient.js';

export const BUCKET_NAME = 'app-files';

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

/**
 * Supabase Storage Service
 * Handles uploading files to the private "app-files" bucket following the mandatory structure:
 * ${auth.uid()}/${featureName}/${itemId}/${uuid}.${extension}
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
      // 1. Determine clean extension
      const rawName = options.fileName || (file as File).name || 'file.pdf';
      const parts = rawName.split('.');
      const ext = (parts.length > 1 ? parts.pop()?.toLowerCase() : 'pdf') || 'pdf';
      const cleanExt = ext.replace(/[^a-z0-9]/g, '') || 'bin';

      // 2. Generate UUID
      const uuid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 3. Construct exact folder path: ${userId}/${featureName}/${itemId}/${uuid}.${cleanExt}
      const safeFeature = (featureName || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeItemId = (itemId || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = `${userId}/${safeFeature}/${safeItemId}/${uuid}.${cleanExt}`;

      // 4. Determine content type
      const detectedContentType =
        options.contentType ||
        file.type ||
        (cleanExt === 'pdf'
          ? 'application/pdf'
          : cleanExt === 'png'
          ? 'image/png'
          : cleanExt === 'jpg' || cleanExt === 'jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream');

      // 5. Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          contentType: detectedContentType,
          upsert: true,
        });

      if (error) {
        console.warn('Supabase storage upload error:', error.message);
        return { path: null, error };
      }

      return { path: data?.path || filePath, error: null };
    } catch (err: any) {
      console.warn('Unexpected error uploading file:', err);
      return { path: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Generates a signed URL for a private storage path.
   * Cached or fresh signed URL valid for given duration (default 1 hour = 3600s).
   */
  async getSignedFileUrl(filePath: string | undefined | null, expiresIn: number = 3600): Promise<string | null> {
    if (!filePath) return null;

    // If it's already an absolute web URL or data URL, return directly
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:') || filePath.startsWith('data:')) {
      return filePath;
    }

    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        console.warn('Supabase createSignedUrl error for path', filePath, error.message);
        return null;
      }

      return data?.signedUrl || null;
    } catch (err) {
      console.warn('Exception generating signed URL for', filePath, err);
      return null;
    }
  },

  /**
   * Deletes a file from the private "app-files" Supabase Storage bucket.
   */
  async deleteAppFile(filePath: string | undefined | null): Promise<boolean> {
    if (!filePath) return true;

    // If it's not a storage path (e.g., sample data or external link), skip
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:') || filePath.startsWith('data:')) {
      return true;
    }

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.warn('Supabase storage remove error for path', filePath, error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.warn('Exception deleting file from storage:', filePath, err);
      return false;
    }
  },
};
