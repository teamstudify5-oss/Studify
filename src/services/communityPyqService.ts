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
   * Upload a new community PYQ (Priority 1: Hardened Validation & Security):
   * 1. Requires authenticated Supabase user.
   * 2. Strict file size (max 20MB), extension, MIME type, and magic-byte header validation.
   * 3. Storage path: "<logged-in-user-id>/<unique-file-name>".
   * 4. Uploads to "community-pyqs" bucket.
   * 5. Atomically cleans up Storage if database insert fails.
   */
  async uploadCommunityPyq(input: UploadCommunityPyqInput): Promise<{ paper: Paper | null; error: Error | null }> {
    try {
      // 1. Authenticate user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { paper: null, error: new Error('You must be signed in to upload community papers.') };
      }

      // 2. Validate file existence and size
      if (!input.file) {
        return { paper: null, error: new Error('No file provided for upload.') };
      }

      const fileSize = input.file.size;
      if (fileSize <= 0) {
        return { paper: null, error: new Error('Cannot upload an empty file.') };
      }

      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
      if (fileSize > MAX_FILE_SIZE) {
        return { paper: null, error: new Error('File size exceeds 20MB limit.') };
      }

      // 3. Validate file extension
      const rawName = input.fileName || (input.file as File).name || 'paper.pdf';
      const fileExtMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : '';
      const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { paper: null, error: new Error(`Unsupported file extension (.${ext}). Only PDF, PNG, and JPG files are permitted.`) };
      }

      // 4. Validate MIME type
      const declaredMime = (input.file as File).type || '';
      const ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
      if (declaredMime && !ALLOWED_MIMES.includes(declaredMime.toLowerCase())) {
        return { paper: null, error: new Error(`Invalid file MIME type (${declaredMime}). Permitted formats: PDF, PNG, JPG.`) };
      }

      // 5. Inspect file magic bytes
      try {
        const headerSlice = input.file.slice(0, 16);
        const headerBuffer = await headerSlice.arrayBuffer();
        const bytes = new Uint8Array(headerBuffer);

        let isValidFormat = false;
        if (ext === 'pdf') {
          // %PDF- (0x25, 0x50, 0x44, 0x46)
          isValidFormat = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        } else if (ext === 'png') {
          // \x89PNG (0x89, 0x50, 0x4E, 0x47)
          isValidFormat = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        } else if (ext === 'jpg' || ext === 'jpeg') {
          // 0xFF 0xD8 0xFF
          isValidFormat = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        } else if (ext === 'webp') {
          // RIFF....WEBP
          const headerStr = String.fromCharCode.apply(null, Array.from(bytes.slice(0, 12)));
          isValidFormat = headerStr.startsWith('RIFF') && headerStr.includes('WEBP');
        }

        if (!isValidFormat) {
          return { paper: null, error: new Error('File content header does not match declared file format. Please upload a genuine PDF or image.') };
        }
      } catch (checkErr) {
        console.warn('Magic byte inspection skipped:', checkErr);
      }

      // 6. Generate sanitized, unique filename
      const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueFileName = `${Date.now()}_${cleanName}`;
      const storagePath = `${user.id}/${uniqueFileName}`;

      const contentType =
        ext === 'pdf'
          ? 'application/pdf'
          : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

      // 7. Upload to community-pyqs bucket
      const { error: uploadError } = await supabase.storage
        .from(COMMUNITY_BUCKET)
        .upload(storagePath, input.file, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Community storage upload failed:', uploadError.message);
        return { paper: null, error: new Error(`Failed to upload file to storage: ${uploadError.message}`) };
      }

      // 8. Generate public URL
      const { data: urlData } = supabase.storage
        .from(COMMUNITY_BUCKET)
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      const uploaderDisplayName =
        input.uploaderDisplayName?.trim() ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        'Community Contributor';

      // 9. Insert row into community_pyqs table
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
        file_size_bytes: fileSize,
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
        // Clean up orphaned storage file
        await supabase.storage.from(COMMUNITY_BUCKET).remove([storagePath]).catch(() => {});
        return { paper: null, error: new Error(`Database record failed: ${insertError.message}`) };
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
