import { supabase } from '../supabaseClient.js';
import { Paper, ExamBoard, GradeLevel } from '../types';

export const COMMUNITY_BUCKET = 'community-pyqs';

export interface CommunityPyqRow {
  id: string;
  uploader_id: string;
  uploader_display_name: string;
  title: string;
  subject: string;
  grade: string;
  exam_board: string;
  year: number;
  chapter: string | null;
  description: string | null;
  total_marks: number;
  time_allowed_minutes: number;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size_bytes: number;
  tags: string[];
  sections: any[];
  views_count: number;
  downloads_count: number;
  rating: number;
  rating_count: number;
  reviews: any[];
  comments: any[];
  status: string;
  is_flagged: boolean;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface UploadCommunityPyqInput {
  file: File | Blob;
  fileName: string;
  title: string;
  subject: string;
  grade: GradeLevel | string;
  examBoard: ExamBoard | string;
  year: number;
  chapter?: string;
  description?: string;
  totalMarks?: number;
  timeAllowedMinutes?: number;
  tags?: string[];
  uploaderDisplayName?: string;
}

export interface UpdateCommunityPyqInput {
  title?: string;
  subject?: string;
  grade?: string;
  examBoard?: string;
  year?: number;
  chapter?: string;
  description?: string;
  totalMarks?: number;
  timeAllowedMinutes?: number;
  tags?: string[];
  uploaderDisplayName?: string;
}

/**
 * Transform Supabase community_pyqs table row into the application's standard Paper structure.
 */
export function mapCommunityRowToPaper(row: CommunityPyqRow): Paper {
  return {
    id: row.id,
    title: row.title,
    examBoard: (row.exam_board as ExamBoard) || 'CBSE',
    grade: (row.grade as GradeLevel) || 'Class 12',
    subject: row.subject,
    year: row.year,
    chapter: row.chapter || '',
    description: row.description || '',
    totalMarks: row.total_marks || 100,
    timeAllowedMinutes: row.time_allowed_minutes || 180,
    status: row.status === 'active' ? 'approved' : (row.status as any),
    submittedBy: {
      id: row.uploader_id,
      name: row.uploader_display_name || 'Community Contributor',
      email: '', // Never expose uploader's private email
    },
    submittedAt: row.created_at,
    approvedAt: row.created_at,
    viewsCount: row.views_count || 0,
    downloadsCount: row.downloads_count || 0,
    fileName: row.file_name || 'paper.pdf',
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    fileUrl: row.file_url,
    filePath: row.file_path,
    uploaderDisplayName: row.uploader_display_name,
    sections: Array.isArray(row.sections) ? row.sections : [],
    tags: Array.isArray(row.tags) ? row.tags : [row.subject, row.grade, row.exam_board],
    rating: Number(row.rating || 0),
    ratingCount: Number(row.rating_count || 0),
    reviews: Array.isArray(row.reviews) ? row.reviews : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
  };
}

export const communityPyqService = {
  /**
   * Fetch all active Community PYQs for public browsing.
   * RLS automatically filters active papers for visitors or authenticated users.
   */
  async fetchCommunityPyqs(): Promise<Paper[]> {
    try {
      const { data, error } = await supabase
        .from('community_pyqs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('communityPyqService.fetchCommunityPyqs error:', error.message);
        return [];
      }

      return (data || []).map(mapCommunityRowToPaper);
    } catch (err) {
      console.warn('Unexpected error in fetchCommunityPyqs:', err);
      return [];
    }
  },

  /**
   * Fetch a single community PYQ by UUID.
   */
  async getCommunityPyqById(id: string): Promise<Paper | null> {
    try {
      const { data, error } = await supabase
        .from('community_pyqs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        if (error) console.warn('getCommunityPyqById error:', error.message);
        return null;
      }

      return mapCommunityRowToPaper(data);
    } catch (err) {
      console.warn('Unexpected error in getCommunityPyqById:', err);
      return null;
    }
  },

  /**
   * Fetch submissions made by a specific user.
   */
  async fetchUserCommunitySubmissions(userId: string): Promise<Paper[]> {
    try {
      const { data, error } = await supabase
        .from('community_pyqs')
        .select('*')
        .eq('uploader_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('fetchUserCommunitySubmissions error:', error.message);
        return [];
      }

      return (data || []).map(mapCommunityRowToPaper);
    } catch (err) {
      console.warn('Unexpected error in fetchUserCommunitySubmissions:', err);
      return [];
    }
  },

  /**
   * Upload a new community PYQ:
   * 1. Requires authenticated user.
   * 2. Storage path format: "<logged-in-user-id>/<unique-file-name>".
   * 3. Uploads to "community-pyqs" bucket.
   * 4. Generates public URL via Supabase Storage.
   * 5. Inserts into "public.community_pyqs" (no system-controlled fields).
   */
  async uploadCommunityPyq(input: UploadCommunityPyqInput): Promise<{ paper: Paper | null; error: Error | null }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { paper: null, error: new Error('You must be signed in to upload community papers.') };
      }

      // Generate sanitized, unique filename
      const rawName = input.fileName || (input.file as File).name || 'paper.pdf';
      const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueFileName = `${Date.now()}_${cleanName}`;

      // Storage path format: <logged-in-user-id>/<unique-file-name>
      const storagePath = `${user.id}/${uniqueFileName}`;

      // Determine content type
      const contentType =
        (input.file as File).type ||
        (cleanName.endsWith('.pdf')
          ? 'application/pdf'
          : cleanName.match(/\.(png|jpe?g|webp)$/i)
          ? `image/${cleanName.split('.').pop()?.toLowerCase()}`
          : 'application/pdf');

      // Upload file to community-pyqs bucket
      const { error: uploadError } = await supabase.storage
        .from(COMMUNITY_BUCKET)
        .upload(storagePath, input.file, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Community storage upload failed:', uploadError.message);
        return { paper: null, error: new Error(`Failed to upload file: ${uploadError.message}`) };
      }

      // Generate public URL using Supabase Storage
      const { data: urlData } = supabase.storage
        .from(COMMUNITY_BUCKET)
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // Safe uploader display name (never uses raw email)
      const uploaderDisplayName =
        input.uploaderDisplayName?.trim() ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        'Community Contributor';

      // Insert row into community_pyqs
      // NOTICE: Do NOT supply views_count, downloads_count, rating, rating_count, status, is_flagged, or timestamps.
      // Database triggers automatically sanitize and set these to safe defaults.
      const payload = {
        uploader_id: user.id,
        uploader_display_name: uploaderDisplayName,
        title: input.title.trim(),
        subject: input.subject,
        grade: input.grade,
        exam_board: input.examBoard,
        year: Number(input.year),
        chapter: input.chapter?.trim() || '',
        description: input.description?.trim() || '',
        total_marks: input.totalMarks || 100,
        time_allowed_minutes: input.timeAllowedMinutes || 180,
        file_name: input.fileName || rawName,
        file_path: storagePath,
        file_url: publicUrl,
        file_size_bytes: input.file.size || 0,
        tags: input.tags || [input.examBoard, input.grade, input.subject, String(input.year)],
        sections: [],
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from('community_pyqs')
        .insert([payload])
        .select()
        .single();

      if (insertError) {
        console.error('community_pyqs insert error:', insertError.message);
        // Attempt cleanup of orphaned storage file
        await supabase.storage.from(COMMUNITY_BUCKET).remove([storagePath]).catch(() => {});
        return { paper: null, error: new Error(`Database insert failed: ${insertError.message}`) };
      }

      const paper = mapCommunityRowToPaper(insertedRow);
      return { paper, error: null };
    } catch (err: any) {
      console.error('Unexpected error in uploadCommunityPyq:', err);
      return { paper: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Update an existing community PYQ submission.
   * Only the original uploader can edit, enforced by RLS and PostgreSQL triggers.
   */
  async updateCommunityPyq(id: string, updates: UpdateCommunityPyqInput): Promise<{ success: boolean; error: Error | null }> {
    try {
      const payload: Record<string, any> = {};

      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.subject !== undefined) payload.subject = updates.subject;
      if (updates.grade !== undefined) payload.grade = updates.grade;
      if (updates.examBoard !== undefined) payload.exam_board = updates.examBoard;
      if (updates.year !== undefined) payload.year = Number(updates.year);
      if (updates.chapter !== undefined) payload.chapter = updates.chapter.trim();
      if (updates.description !== undefined) payload.description = updates.description.trim();
      if (updates.totalMarks !== undefined) payload.total_marks = Number(updates.totalMarks);
      if (updates.timeAllowedMinutes !== undefined) payload.time_allowed_minutes = Number(updates.timeAllowedMinutes);
      if (updates.tags !== undefined) payload.tags = updates.tags;
      if (updates.uploaderDisplayName !== undefined) payload.uploader_display_name = updates.uploaderDisplayName.trim();

      const { error } = await supabase
        .from('community_pyqs')
        .update(payload)
        .eq('id', id);

      if (error) {
        console.error('updateCommunityPyq error:', error.message);
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('Unexpected error in updateCommunityPyq:', err);
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Delete a community PYQ submission.
   * Only the original uploader can delete, enforced by RLS.
   * Also deletes the associated file from the community-pyqs Storage bucket.
   */
  async deleteCommunityPyq(id: string, filePath?: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      // 1. Delete database row
      const { error: dbError } = await supabase
        .from('community_pyqs')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('deleteCommunityPyq database error:', dbError.message);
        return { success: false, error: new Error(dbError.message) };
      }

      // 2. Delete file from community-pyqs bucket if filePath is provided
      if (filePath) {
        // If filePath is a full URL, extract the relative path
        let relativePath = filePath;
        if (filePath.includes(`${COMMUNITY_BUCKET}/`)) {
          relativePath = filePath.split(`${COMMUNITY_BUCKET}/`)[1] || filePath;
        }

        const { error: storageError } = await supabase.storage
          .from(COMMUNITY_BUCKET)
          .remove([relativePath]);

        if (storageError) {
          console.warn('Notice: Storage file deletion failed (or already removed):', storageError.message);
        }
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('Unexpected error in deleteCommunityPyq:', err);
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Increment view counter using hardened RPC: increment_community_pyq_view(target_pyq_id).
   */
  async incrementView(targetPyqId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_community_pyq_view', {
        target_pyq_id: targetPyqId,
      });
      if (error) {
        console.warn('increment_community_pyq_view notice:', error.message);
      }
    } catch (err) {
      // Silent catch so UI does not fail on view count
    }
  },

  /**
   * Increment download counter using hardened RPC: increment_community_pyq_download(target_pyq_id).
   */
  async incrementDownload(targetPyqId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_community_pyq_download', {
        target_pyq_id: targetPyqId,
      });
      if (error) {
        console.warn('increment_community_pyq_download notice:', error.message);
      }
    } catch (err) {
      // Silent catch so download flow proceeds uninterrupted
    }
  },
};
