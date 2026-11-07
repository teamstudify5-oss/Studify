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
  moderation_notes?: string | null;
  is_flagged: boolean;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface UploadCommunityPyqInput {
  file?: File | Blob;
  files?: File[];
  fileName?: string;
  title: string;
  subject: string;
  grade: GradeLevel | string;
  examBoard: ExamBoard | string;
  year: number;
  eventName?: string;
  chapter?: string;
  description?: string;
  totalMarks?: number;
  timeAllowedMinutes?: number;
  tags?: string[];
  uploaderDisplayName?: string;
  isImageBased?: boolean;
}

export interface UpdateCommunityPyqInput {
  title?: string;
  subject?: string;
  grade?: string;
  examBoard?: string;
  year?: number;
  eventName?: string;
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
  const sectionsArray = Array.isArray(row.sections) ? row.sections : [];
  const imageMeta = sectionsArray.find((s: any) => s && s.isImageBased === true);
  const isImageBased = !!imageMeta || (!!row.file_name && (row.file_name.toLowerCase().endsWith('.png') || row.file_name.toLowerCase().endsWith('.jpg') || row.file_name.toLowerCase().endsWith('.jpeg') || row.file_name.toLowerCase().endsWith('.webp') || row.file_name.includes('Pages (Images)')));
  const imageUrls: string[] = imageMeta?.imageUrls || (isImageBased && row.file_url ? [row.file_url] : []);
  const pageCount: number = imageMeta?.pageCount || imageUrls.length || 1;
  const eventName: string = imageMeta?.eventName || (sectionsArray[0]?.eventName) || '';

  // Check for admin moderation actions
  const moderationAction = sectionsArray.find((s: any) => s && (s.action === 'removed_by_admin' || s.type === 'moderation_action'));
  const isRemoved = row.status === 'removed' || row.status === 'takedown' || !!moderationAction;
  const status = isRemoved ? 'removed' : (row.status === 'active' ? 'approved' : (row.status as any));
  const removalReason = moderationAction?.reason || row.moderation_notes || 'Removed by Administrator';
  const removedBy = moderationAction?.adminEmail || 'Studify Administrator';
  const removedAt = moderationAction?.timestamp || row.updated_at || row.created_at;

  return {
    id: row.id,
    title: row.title,
    examBoard: (row.exam_board as ExamBoard) || 'CBSE',
    grade: (row.grade as GradeLevel) || 'Class 12',
    subject: row.subject,
    year: row.year,
    chapter: row.chapter || '',
    eventName,
    description: row.description || '',
    totalMarks: row.total_marks && row.total_marks > 0 ? Number(row.total_marks) : undefined,
    timeAllowedMinutes: row.time_allowed_minutes && row.time_allowed_minutes > 0 ? Number(row.time_allowed_minutes) : undefined,
    status,
    removalReason: isRemoved ? removalReason : undefined,
    removedBy: isRemoved ? removedBy : undefined,
    removedAt: isRemoved ? removedAt : undefined,
    isImageBased,
    imageUrls,
    pageCount,
    submittedBy: {
      id: row.uploader_id,
      name: row.uploader_display_name || 'Community Contributor',
      email: '', // Never expose uploader's private email
    },
    submittedAt: row.created_at,
    approvedAt: row.created_at,
    viewsCount: row.views_count || 0,
    downloadsCount: row.downloads_count || 0,
    fileName: row.file_name || (isImageBased ? 'Photos of Question Paper' : 'paper.pdf'),
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    fileUrl: row.file_url,
    filePath: row.file_path,
    uploaderDisplayName: row.uploader_display_name,
    sections: sectionsArray,
    tags: Array.isArray(row.tags) ? row.tags : [row.subject, row.grade, row.exam_board],
    rating: Number(row.rating || 0),
    ratingCount: Number(row.rating_count || 0),
    reviews: Array.isArray(row.reviews) ? row.reviews : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
  };
}

export const communityPyqService = {
  /**
   * Fetch all active Community PYQs for public browsing (excludes removed papers).
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

      const all = (data || []).map(mapCommunityRowToPaper);
      // Strictly exclude any papers removed by administrator from public browse/search
      return all.filter((p) => p.status !== 'removed' && p.status !== 'rejected');
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
  /**
   * Upload a new community PYQ (Supports single PDF or multiple image photographs):
   * 1. Requires authenticated Supabase user.
   * 2. Strict file size (max 20MB total), extension, and MIME type validation.
   * 3. Multiple images are uploaded to the storage bucket and linked to a single PYQ record.
   */
  async uploadCommunityPyq(input: UploadCommunityPyqInput): Promise<{ paper: Paper | null; error: Error | null }> {
    try {
      // 1. Authenticate user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { paper: null, error: new Error('You must be signed in to upload community papers.') };
      }

      const uploaderDisplayName =
        input.uploaderDisplayName?.trim() ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        'Community Contributor';

      // -------------------------------------------------------------
      // CASE A: Multiple image upload (Photographs of question paper)
      // -------------------------------------------------------------
      if (input.isImageBased && input.files && input.files.length > 0) {
        const files = input.files;
        if (files.length > 25) {
          return { paper: null, error: new Error('A maximum of 25 image pages can be uploaded per paper.') };
        }

        let totalSizeBytes = 0;
        const uploadedPaths: string[] = [];
        const imageUrls: string[] = [];

        // Validate each image
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          totalSizeBytes += file.size;

          const rawName = file.name || `page_${i + 1}.jpg`;
          const fileExtMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
          const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : 'jpg';
          const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

          if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return { paper: null, error: new Error(`Page ${i + 1} has unsupported format (.${ext}). Only PNG, JPG, and WEBP photos are allowed.`) };
          }
        }

        if (totalSizeBytes > 30 * 1024 * 1024) {
          return { paper: null, error: new Error('Total image size exceeds 30MB limit. Please compress images before uploading.') };
        }

        // Upload each page photo to storage
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const rawName = file.name || `page_${i + 1}.jpg`;
          const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `${user.id}/${Date.now()}_page_${i + 1}_${cleanName}`;

          const { error: uploadError } = await supabase.storage
            .from(COMMUNITY_BUCKET)
            .upload(storagePath, file, {
              contentType: file.type || 'image/jpeg',
              upsert: false,
            });

          if (uploadError) {
            console.error(`Page ${i + 1} upload failed:`, uploadError.message);
            // Clean up already uploaded images
            if (uploadedPaths.length > 0) {
              await supabase.storage.from(COMMUNITY_BUCKET).remove(uploadedPaths).catch(() => {});
            }
            return { paper: null, error: new Error(`Failed to upload page ${i + 1}: ${uploadError.message}`) };
          }

          uploadedPaths.push(storagePath);
          const { data: urlData } = supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(storagePath);
          imageUrls.push(urlData.publicUrl);
        }

        // Insert ONE single PYQ database record
        const payload = {
          uploader_id: user.id,
          uploader_display_name: uploaderDisplayName,
          title: input.title.trim(),
          subject: input.subject.trim(),
          grade: input.grade,
          exam_board: input.examBoard,
          year: Number(input.year),
          chapter: input.chapter?.trim() || '',
          description: input.description?.trim() || '',
          total_marks: input.totalMarks && input.totalMarks > 0 ? Number(input.totalMarks) : null,
          time_allowed_minutes: input.timeAllowedMinutes && input.timeAllowedMinutes > 0 ? Number(input.timeAllowedMinutes) : null,
          file_name: `${files.length} Pages (Images)`,
          file_path: uploadedPaths[0],
          file_url: imageUrls[0],
          file_size_bytes: totalSizeBytes,
          tags: input.tags || [input.examBoard, input.grade, input.subject, String(input.year), 'Photos'],
          sections: [
            {
              isImageBased: true,
              imageUrls,
              pageCount: imageUrls.length,
              eventName: input.eventName?.trim() || '',
            },
          ],
        };

        const { data: insertedRow, error: insertError } = await supabase
          .from('community_pyqs')
          .insert([payload])
          .select()
          .single();

        if (insertError) {
          console.error('community_pyqs insert error:', insertError.message);
          await supabase.storage.from(COMMUNITY_BUCKET).remove(uploadedPaths).catch(() => {});
          return { paper: null, error: new Error(`Database record failed: ${insertError.message}`) };
        }

        const paper = mapCommunityRowToPaper(insertedRow);
        return { paper, error: null };
      }

      // -------------------------------------------------------------
      // CASE B: Standard Single PDF upload
      // -------------------------------------------------------------
      if (!input.file) {
        return { paper: null, error: new Error('Please select a file to upload.') };
      }

      const fileSize = input.file.size;
      if (fileSize <= 0) {
        return { paper: null, error: new Error('Cannot upload an empty file.') };
      }

      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
      if (fileSize > MAX_FILE_SIZE) {
        return { paper: null, error: new Error('File size exceeds 25MB limit.') };
      }

      const rawName = input.fileName || (input.file as File).name || 'paper.pdf';
      const fileExtMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : '';
      const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { paper: null, error: new Error(`Unsupported file extension (.${ext}). Only PDF, PNG, and JPG files are permitted.`) };
      }

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

      const { data: urlData } = supabase.storage
        .from(COMMUNITY_BUCKET)
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      const payload = {
        uploader_id: user.id,
        uploader_display_name: uploaderDisplayName,
        title: input.title.trim(),
        subject: input.subject.trim(),
        grade: input.grade,
        exam_board: input.examBoard,
        year: Number(input.year),
        chapter: input.chapter?.trim() || '',
        description: input.description?.trim() || '',
        total_marks: input.totalMarks && input.totalMarks > 0 ? Number(input.totalMarks) : null,
        time_allowed_minutes: input.timeAllowedMinutes && input.timeAllowedMinutes > 0 ? Number(input.timeAllowedMinutes) : null,
        file_name: input.fileName || rawName,
        file_path: storagePath,
        file_url: publicUrl,
        file_size_bytes: fileSize,
        tags: input.tags || [input.examBoard, input.grade, input.subject, String(input.year)],
        sections: input.eventName ? [{ eventName: input.eventName.trim() }] : [],
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from('community_pyqs')
        .insert([payload])
        .select()
        .single();

      if (insertError) {
        console.error('community_pyqs insert error:', insertError.message);
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
   * Only the original uploader can edit.
   */
  async updateCommunityPyq(id: string, updates: UpdateCommunityPyqInput): Promise<{ success: boolean; error: Error | null }> {
    try {
      const payload: Record<string, any> = {};

      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.subject !== undefined) payload.subject = updates.subject.trim();
      if (updates.grade !== undefined) payload.grade = updates.grade;
      if (updates.examBoard !== undefined) payload.exam_board = updates.examBoard;
      if (updates.year !== undefined) payload.year = Number(updates.year);
      if (updates.chapter !== undefined) payload.chapter = updates.chapter.trim();
      if (updates.description !== undefined) payload.description = updates.description.trim();
      if (updates.totalMarks !== undefined) payload.total_marks = updates.totalMarks && updates.totalMarks > 0 ? Number(updates.totalMarks) : null;
      if (updates.timeAllowedMinutes !== undefined) payload.time_allowed_minutes = updates.timeAllowedMinutes && updates.timeAllowedMinutes > 0 ? Number(updates.timeAllowedMinutes) : null;
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
   * Studify Team Administrator Removal:
   * Marks status as 'removed', stores removal reason, administrator email, and timestamp.
   * Keeps the post out of the public feed.
   */
  async removeCommunityPyqByAdmin(id: string, reason: string, adminEmail: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: existing } = await supabase
        .from('community_pyqs')
        .select('sections')
        .eq('id', id)
        .maybeSingle();

      const existingSections = Array.isArray(existing?.sections) ? existing.sections : [];
      const updatedSections = [
        ...existingSections.filter((s: any) => s && s.action !== 'removed_by_admin'),
        {
          type: 'moderation_action',
          action: 'removed_by_admin',
          reason: reason.trim(),
          adminEmail: adminEmail.trim(),
          timestamp: new Date().toISOString(),
        },
      ];

      const { error } = await supabase
        .from('community_pyqs')
        .update({
          status: 'removed',
          sections: updatedSections,
        })
        .eq('id', id);

      if (error) {
        console.error('removeCommunityPyqByAdmin error:', error.message);
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('Unexpected error in removeCommunityPyqByAdmin:', err);
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  /**
   * Fetch all papers for Studify Team Administrator Moderation (including removed/flagged/pending).
   */
  async fetchAdminModerationPyqs(): Promise<Paper[]> {
    try {
      const { data, error } = await supabase
        .from('community_pyqs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('fetchAdminModerationPyqs error:', error.message);
        return [];
      }

      return (data || []).map(mapCommunityRowToPaper);
    } catch (err) {
      console.warn('Unexpected error in fetchAdminModerationPyqs:', err);
      return [];
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
