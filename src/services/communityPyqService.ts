import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient.js';
import * as tus from 'tus-js-client';
import {
  Paper,
  PaperRemovalNotice,
  ExamBoard,
  GradeLevel,
  DeleteCommunityPyqResult,
  DeletePaperErrorCode,
  DeletePaperOutcomeCode,
} from '../types';
import { supabaseDb } from './supabaseDb';
import { parseStorageBucketAndPath } from './supabaseStorage';

export const COMMUNITY_BUCKET = 'community-pyqs';

export const toOptionalPositiveInteger = (value?: number | null): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
};

/**
 * Extracts a clean relative object key within the `community-pyqs` bucket
 * from either a raw storage path or a full Supabase Storage URL.
 */
export function extractCommunityStoragePath(rawPathOrUrl?: string | null): string | null {
  if (!rawPathOrUrl) return null;
  let path = String(rawPathOrUrl).trim();
  if (!path) return null;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    const marker = `/${COMMUNITY_BUCKET}/`;
    const idx = path.indexOf(marker);
    if (idx === -1) return null;
    path = path.slice(idx + marker.length);
  } else if (path.startsWith(`${COMMUNITY_BUCKET}/`)) {
    path = path.slice(`${COMMUNITY_BUCKET}/`.length);
  }

  path = path.split('?')[0].split('#')[0].replace(/^\/+/, '');
  if (!path || path.includes('..')) return null;

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function normalizeStorageObjectName(
  name?: string | null,
  bucket: string = COMMUNITY_BUCKET
): string | null {
  if (!name) return null;
  let normalized = String(name).trim().replace(/^\/+/, '');
  if (bucket && normalized.startsWith(`${bucket}/`)) {
    normalized = normalized.slice(bucket.length + 1);
  } else if (normalized.startsWith(`${COMMUNITY_BUCKET}/`)) {
    normalized = normalized.slice(`${COMMUNITY_BUCKET}/`.length);
  }
  if (!normalized) return null;
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

/**
 * Classify Supabase storage failures into precise, actionable user-facing messages.
 */
export function classifyStorageError(error: any, context?: string): Error {
  const msg = (error?.message || error?.error_description || String(error || '')).toLowerCase();
  const status =
    error?.status ||
    error?.statusCode ||
    (error?.originalResponse ? error.originalResponse.getStatus?.() : undefined);

  if (
    status === 403 ||
    msg.includes('policy') ||
    msg.includes('permission') ||
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('access denied') ||
    msg.includes('unauthorized')
  ) {
    return new Error(
      `Permission denied by storage policy (RLS)${context ? ` during ${context}` : ''}. Please ensure you are signed in and storage policies permit this action.`
    );
  }

  if (status === 404 || (msg.includes('bucket') && msg.includes('not found'))) {
    return new Error(
      `Storage bucket '${COMMUNITY_BUCKET}' was not found. Please ensure the bucket exists in Supabase Storage.`
    );
  }

  if (
    status === 413 ||
    msg.includes('payload too large') ||
    msg.includes('entity too large') ||
    msg.includes('file size') ||
    msg.includes('size limit') ||
    msg.includes('maximum size')
  ) {
    return new Error('File exceeds the allowed size limit (25MB) configured in Supabase Storage.');
  }

  if (status === 401 || msg.includes('jwt') || msg.includes('token') || msg.includes('session expired') || msg.includes('invalid claim')) {
    return new Error('Your session has expired. Please sign in again.');
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('load failed') ||
    status === 0
  ) {
    return new Error(
      `Network connection to Supabase Storage failed or timed out${context ? ` during ${context}` : ''}. Please check your connection and try again.`
    );
  }

  return new Error(error?.message || 'Storage operation failed. Please try again.');
}

function classifyStorageFailureCode(error: any): DeletePaperErrorCode {
  const msg = (error?.message || error?.error_description || String(error || '')).toLowerCase();
  const status = error?.status || error?.statusCode;

  if (
    status === 401 ||
    status === 403 ||
    msg.includes('policy') ||
    msg.includes('permission') ||
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('unauthorized') ||
    msg.includes('access denied')
  ) {
    return 'STORAGE_PERMISSION_ERROR';
  }

  if (
    status === 0 ||
    status >= 500 ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('load failed')
  ) {
    return 'STORAGE_NETWORK_ERROR';
  }

  return 'STORAGE_ERROR';
}

/**
 * Perform a resumable chunked upload via TUS protocol to Supabase Storage.
 * Recommended for files larger than 6MB or on mobile connections.
 */
export async function uploadWithTus(
  file: File | Blob,
  storagePath: string,
  contentType: string,
  onProgress?: (text: string, percentage?: number) => void
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    throw new Error('Authentication session expired. Please sign in again to upload.');
  }

  const endpoint = `${SUPABASE_URL}/storage/v1/upload/resumable`;

  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: COMMUNITY_BUCKET,
        objectName: storagePath,
        contentType: contentType,
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      onError: (error) => {
        console.error('TUS resumable upload error:', error);
        reject(classifyStorageError(error, 'resumable upload'));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0) {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          onProgress?.(`Uploading PDF (${percentage}%)...`, percentage);
        }
      },
      onSuccess: () => {
        resolve();
      },
    });

    // Check for previous incomplete upload to resume, otherwise start
    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads && previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      })
      .catch(() => {
        upload.start();
      });
  });
}

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
  total_marks: number | null;
  time_allowed_minutes: number | null;
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
  onProgress?: (progressText: string, percentage?: number) => void;
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
  totalMarks?: number | null;
  timeAllowedMinutes?: number | null;
  tags?: string[];
  uploaderDisplayName?: string;
}

/**
 * Transform Supabase community_pyqs table row into the application's standard Paper structure.
 */
export function mapCommunityRowToPaper(row: CommunityPyqRow & {
  paper_moderation_states?: any;
  previous_status?: string;
  removal_reason?: string;
  removed_by_label?: string;
  removed_at?: string;
  is_removed?: boolean;
}): Paper {
  const sectionsArray = Array.isArray(row.sections) ? row.sections : [];
  const imageMeta = sectionsArray.find((s: any) => s && s.isImageBased === true);
  const isImageBased =
    !!imageMeta ||
    (!!row.file_name &&
      (row.file_name.toLowerCase().endsWith('.png') ||
        row.file_name.toLowerCase().endsWith('.jpg') ||
        row.file_name.toLowerCase().endsWith('.jpeg') ||
        row.file_name.toLowerCase().endsWith('.webp') ||
        row.file_name.toLowerCase().endsWith('.gif') ||
        row.file_name.toLowerCase().endsWith('.svg') ||
        row.file_name.includes('Pages (Images)')));

  const imageUrls: string[] = Array.isArray(imageMeta?.imageUrls)
    ? imageMeta.imageUrls.filter(Boolean)
    : isImageBased && row.file_url
    ? [row.file_url]
    : [];

  const explicitImagePaths: string[] = Array.isArray(imageMeta?.imagePaths)
    ? imageMeta.imagePaths.map((p: any) => extractCommunityStoragePath(p)).filter((p: string | null): p is string => Boolean(p))
    : [];

  const derivedImagePaths: string[] =
    explicitImagePaths.length > 0
      ? explicitImagePaths
      : imageUrls
          .map((u) => extractCommunityStoragePath(u))
          .filter((p: string | null): p is string => Boolean(p));

  const resolvedFilePath =
    extractCommunityStoragePath(row.file_path) ||
    derivedImagePaths[0] ||
    extractCommunityStoragePath(row.file_url) ||
    undefined;

  const pageCount: number = imageMeta?.pageCount || imageUrls.length || 1;
  const eventName: string = imageMeta?.eventName || sectionsArray[0]?.eventName || '';

  // Dedicated moderation state (via joined paper_moderation_states or RPC) with legacy sections fallback
  const modStateRaw = Array.isArray(row.paper_moderation_states)
    ? row.paper_moderation_states[0]
    : row.paper_moderation_states;
  const legacyModAction = sectionsArray.find(
    (s: any) => s && (s.action === 'removed_by_admin' || s.type === 'moderation_action')
  );
  const isRemoved =
    row.is_removed === true ||
    modStateRaw?.is_removed === true ||
    row.status === 'removed' ||
    row.status === 'takedown' ||
    row.status === 'taken_down' ||
    !!legacyModAction;

  const status = isRemoved
    ? 'removed'
    : row.status === 'active' || row.status === 'published'
    ? 'approved'
    : (row.status as any);

  const removalReason =
    row.removal_reason ||
    modStateRaw?.removal_reason ||
    legacyModAction?.reason ||
    row.moderation_notes ||
    'Removed by Administrator';
  const removedBy =
    row.removed_by_label ||
    modStateRaw?.removed_by_label ||
    legacyModAction?.adminEmail ||
    'Studify Administrator';
  const removedAt =
    row.removed_at ||
    modStateRaw?.removed_at ||
    legacyModAction?.timestamp ||
    row.updated_at ||
    row.created_at;

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
    timeAllowedMinutes:
      row.time_allowed_minutes && row.time_allowed_minutes > 0 ? Number(row.time_allowed_minutes) : undefined,
    status,
    previousStatus: row.previous_status || modStateRaw?.previous_status || undefined,
    isRemoved,
    rejectionReason: row.status === 'rejected' ? row.moderation_notes || undefined : undefined,
    removalReason: isRemoved ? removalReason : undefined,
    removedBy: isRemoved ? removedBy : undefined,
    removedAt: isRemoved ? removedAt : undefined,
    isImageBased,
    imageUrls,
    imagePaths: derivedImagePaths.length > 0 ? derivedImagePaths : undefined,
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
    filePath: resolvedFilePath,
    uploaderDisplayName: row.uploader_display_name,
    sections: sectionsArray,
    tags: Array.isArray(row.tags) ? row.tags : [row.subject, row.grade, row.exam_board],
    rating:
      Number(row.rating_count || 0) > 0 &&
      row.rating !== null &&
      row.rating !== undefined &&
      Number(row.rating) > 0
        ? Number(row.rating)
        : undefined,
    ratingCount: Number(row.rating_count || 0),
    reviews: Array.isArray(row.reviews) ? row.reviews : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    isFlagged: Boolean(row.is_flagged),
    reportCount: Number(row.report_count || 0),
    moderationNotes: row.moderation_notes || undefined,
  };
}

export interface CommunityPyqServiceDependencies {
  supabaseClient?: typeof supabase;
  isCurrentUserAdmin?: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
  tusUploader?: typeof uploadWithTus;
}

export function createCommunityPyqService(deps?: CommunityPyqServiceDependencies) {
  const client = deps?.supabaseClient ?? supabase;
  const checkAdmin = deps?.isCurrentUserAdmin ?? (() => supabaseDb.isCurrentUserAdmin());
  const fetchFn = deps?.fetchImpl ?? fetch;
  const tusUploader = deps?.tusUploader ?? uploadWithTus;

  return {
    /**
     * Fetch all active Community PYQs with explicit error status so callers can
     * distinguish a genuinely empty library ([]) from a network/database failure.
     */
    async fetchCommunityPyqsWithStatus(): Promise<{ papers: Paper[]; error: Error | null }> {
      try {
        const { data, error } = await client
          .from('community_pyqs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('communityPyqService.fetchCommunityPyqs error:', error.message);
          return { papers: [], error: new Error(error.message) };
        }

        const all = (data || []).map(mapCommunityRowToPaper);
        // Exclude removed, taken down, or rejected papers from the public library feed
        return {
          papers: all.filter((p) => p.status !== 'removed' && p.status !== 'rejected'),
          error: null,
        };
      } catch (err: any) {
        console.warn('Unexpected error in fetchCommunityPyqs:', err);
        return {
          papers: [],
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },

    /**
     * Fetch all active Community PYQs for public browsing (excludes removed papers).
     */
    async fetchCommunityPyqs(): Promise<Paper[]> {
      const res = await this.fetchCommunityPyqsWithStatus();
      return res.papers;
    },

    /**
     * Fetch a single community PYQ by UUID.
     */
    async getCommunityPyqById(id: string): Promise<Paper | null> {
      try {
        const { data, error } = await client
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
        const { data, error } = await client
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
     * Upload a new community PYQ (Supports single PDF or multiple image photographs):
     * 1. Requires authenticated Supabase user.
     * 2. Validates file size, extension, and MIME type.
     * 3. Persists exact storage path(s) in `file_path` and `sections[0].imagePaths`.
     * 4. Atomically cleans up Storage if the database insert fails.
     */
    async uploadCommunityPyq(input: UploadCommunityPyqInput): Promise<{ paper: Paper | null; error: Error | null }> {
      try {
        // 1. Authenticate user
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();
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

          const MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB bucket per-object limit
          const imageMimeTypes: string[] = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size <= 0) {
              return { paper: null, error: new Error(`Page ${i + 1} is an empty file.`) };
            }
            if (file.size > MAX_SINGLE_FILE_BYTES) {
              return { paper: null, error: new Error(`Page ${i + 1} exceeds the 25MB per-file storage limit.`) };
            }
            totalSizeBytes += file.size;

            const rawName = file.name || `page_${i + 1}.jpg`;
            const fileExtMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
            const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : 'jpg';
            const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

            if (!ALLOWED_EXTENSIONS.includes(ext)) {
              return {
                paper: null,
                error: new Error(
                  `Page ${i + 1} has unsupported format (.${ext}). Only PNG, JPG, WEBP, GIF, and SVG photos are allowed.`
                ),
              };
            }

            imageMimeTypes.push(
              ext === 'png'
                ? 'image/png'
                : ext === 'webp'
                ? 'image/webp'
                : ext === 'gif'
                ? 'image/gif'
                : ext === 'svg'
                ? 'image/svg+xml'
                : 'image/jpeg'
            );
          }

          if (totalSizeBytes > 30 * 1024 * 1024) {
            return {
              paper: null,
              error: new Error('Total image size exceeds 30MB limit. Please compress images before uploading.'),
            };
          }

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            input.onProgress?.(
              `Uploading photograph ${i + 1} of ${files.length}...`,
              Math.round(((i + 1) / files.length) * 100)
            );

            const rawName = file.name || `page_${i + 1}.jpg`;
            const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const pageUuid =
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2);
            const storagePath = `${user.id}/${Date.now()}_${pageUuid}_p${i + 1}_${cleanName}`;

            const { error: uploadError } = await client.storage
              .from(COMMUNITY_BUCKET)
              .upload(storagePath, file, {
                contentType: imageMimeTypes[i],
                upsert: false,
              });

            if (uploadError) {
              console.error(`Page ${i + 1} upload failed:`, uploadError.message);
              if (uploadedPaths.length > 0) {
                await client.storage.from(COMMUNITY_BUCKET).remove(uploadedPaths).catch(() => {});
              }
              return { paper: null, error: classifyStorageError(uploadError, `page ${i + 1} upload`) };
            }

            uploadedPaths.push(storagePath);
            const { data: urlData } = client.storage.from(COMMUNITY_BUCKET).getPublicUrl(storagePath);
            imageUrls.push(urlData.publicUrl);
          }

          const totalMarks = toOptionalPositiveInteger(input.totalMarks);
          const timeAllowedMinutes = toOptionalPositiveInteger(input.timeAllowedMinutes);

          const payload: Record<string, any> = {
            uploader_id: user.id,
            uploader_display_name: uploaderDisplayName,
            title: input.title.trim(),
            subject: input.subject.trim(),
            grade: input.grade,
            exam_board: input.examBoard,
            year: Number(input.year),
            chapter: input.chapter?.trim() || '',
            description: input.description?.trim() || '',
            ...(totalMarks !== undefined ? { total_marks: totalMarks } : {}),
            ...(timeAllowedMinutes !== undefined ? { time_allowed_minutes: timeAllowedMinutes } : {}),
            file_name: `${files.length} Pages (Images)`,
            file_path: uploadedPaths[0],
            file_url: imageUrls[0],
            file_size_bytes: totalSizeBytes,
            tags: input.tags || [input.examBoard, input.grade, input.subject, String(input.year), 'Photos'],
            sections: [
              {
                isImageBased: true,
                imageUrls,
                imagePaths: uploadedPaths,
                pageCount: imageUrls.length,
                eventName: input.eventName?.trim() || '',
              },
            ],
          };

          const { data: insertedRow, error: insertError } = await client
            .from('community_pyqs')
            .insert([payload])
            .select()
            .single();

          if (insertError) {
            console.error('community_pyqs insert error:', insertError.message);
            await client.storage.from(COMMUNITY_BUCKET).remove(uploadedPaths).catch(() => {});
            return { paper: null, error: new Error(`Database record failed: ${insertError.message}`) };
          }

          const paper = mapCommunityRowToPaper(insertedRow);
          return { paper, error: null };
        }

        // -------------------------------------------------------------
        // CASE B: Standard / Resumable PDF upload (up to 25MB)
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
          return { paper: null, error: new Error('File size exceeds the 25MB maximum limit.') };
        }

        const rawName = input.fileName || (input.file as File).name || 'paper.pdf';
        const fileExtMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
        const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : '';
        const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return {
            paper: null,
            error: new Error(`Unsupported file extension (.${ext}). Only PDF, PNG, JPG, WEBP, GIF, and SVG files are permitted.`),
          };
        }

        const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2);
        const storagePath = `${user.id}/${Date.now()}_${uniqueId}_${cleanName}`;

        const contentType =
          ext === 'pdf'
            ? 'application/pdf'
            : ext === 'png'
            ? 'image/png'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
            ? 'image/gif'
            : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/jpeg';

        const CHUNKED_THRESHOLD = 6 * 1024 * 1024; // 6MB

        if (fileSize > CHUNKED_THRESHOLD && ext === 'pdf') {
          input.onProgress?.('Starting resumable PDF upload...', 0);
          await tusUploader(input.file, storagePath, contentType, input.onProgress);
        } else {
          input.onProgress?.('Uploading PDF to storage...', 35);
          const { error: uploadError } = await client.storage
            .from(COMMUNITY_BUCKET)
            .upload(storagePath, input.file, {
              contentType,
              upsert: false,
            });

          if (uploadError) {
            const rawMsg = (uploadError.message || '').toLowerCase();
            const isFetchOrNetwork =
              rawMsg.includes('failed to fetch') ||
              rawMsg.includes('network') ||
              rawMsg.includes('load failed') ||
              rawMsg.includes('timeout') ||
              rawMsg.includes('aborted');

            if (isFetchOrNetwork && ext === 'pdf') {
              console.warn(
                'Standard upload encountered network/fetch error. Falling back to TUS resumable upload:',
                uploadError.message
              );
              input.onProgress?.('Connection interrupted. Switching to resumable upload...', 10);
              try {
                await tusUploader(input.file, storagePath, contentType, input.onProgress);
              } catch (tusErr: any) {
                console.error('TUS resumable upload fallback failed:', tusErr);
                throw classifyStorageError(tusErr, 'resumable upload');
              }
            } else {
              console.error('Community storage upload failed:', uploadError.message);
              throw classifyStorageError(uploadError, 'standard upload');
            }
          }
        }

        const { data: urlData } = client.storage.from(COMMUNITY_BUCKET).getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        const totalMarks = toOptionalPositiveInteger(input.totalMarks);
        const timeAllowedMinutes = toOptionalPositiveInteger(input.timeAllowedMinutes);

        const payload: Record<string, any> = {
          uploader_id: user.id,
          uploader_display_name: uploaderDisplayName,
          title: input.title.trim(),
          subject: input.subject.trim(),
          grade: input.grade,
          exam_board: input.examBoard,
          year: Number(input.year),
          chapter: input.chapter?.trim() || '',
          description: input.description?.trim() || '',
          ...(totalMarks !== undefined ? { total_marks: totalMarks } : {}),
          ...(timeAllowedMinutes !== undefined ? { time_allowed_minutes: timeAllowedMinutes } : {}),
          file_name: input.fileName || rawName,
          file_path: storagePath,
          file_url: publicUrl,
          file_size_bytes: fileSize,
          tags: input.tags || [input.examBoard, input.grade, input.subject, String(input.year)],
          sections: input.eventName ? [{ eventName: input.eventName.trim() }] : [],
        };

        const { data: insertedRow, error: insertError } = await client
          .from('community_pyqs')
          .insert([payload])
          .select()
          .single();

        if (insertError) {
          console.error('community_pyqs insert error:', insertError.message);
          await client.storage.from(COMMUNITY_BUCKET).remove([storagePath]).catch(() => {});
          return { paper: null, error: new Error(`Database record failed: ${insertError.message}`) };
        }

        const paper = mapCommunityRowToPaper(insertedRow);
        return { paper, error: null };
      } catch (err: any) {
        console.error('Unexpected error in uploadCommunityPyq:', err);
        return { paper: null, error: err instanceof Error ? err : new Error(String(err?.message || err)) };
      }
    },

    /**
     * Update an existing community PYQ submission.
     */
    async updateCommunityPyq(
      id: string,
      updates: UpdateCommunityPyqInput
    ): Promise<{ success: boolean; error: Error | null }> {
      try {
        const payload: Record<string, any> = {};

        if (updates.title !== undefined) payload.title = updates.title.trim();
        if (updates.subject !== undefined) payload.subject = updates.subject.trim();
        if (updates.grade !== undefined) payload.grade = updates.grade;
        if (updates.examBoard !== undefined) payload.exam_board = updates.examBoard;
        if (updates.year !== undefined) payload.year = Number(updates.year);
        if (updates.chapter !== undefined) payload.chapter = updates.chapter.trim();
        if (updates.description !== undefined) payload.description = updates.description.trim();
        if (updates.totalMarks === null) {
          payload.total_marks = null;
        } else if (updates.totalMarks !== undefined) {
          const val = toOptionalPositiveInteger(updates.totalMarks);
          if (val === undefined) {
            return { success: false, error: new Error('Total marks must be a positive integer.') };
          }
          payload.total_marks = val;
        }
        if (updates.timeAllowedMinutes === null) {
          payload.time_allowed_minutes = null;
        } else if (updates.timeAllowedMinutes !== undefined) {
          const val = toOptionalPositiveInteger(updates.timeAllowedMinutes);
          if (val === undefined) {
            return { success: false, error: new Error('Time allowed must be a positive integer (in minutes).') };
          }
          payload.time_allowed_minutes = val;
        }
        if (updates.tags !== undefined) payload.tags = updates.tags;
        if (updates.uploaderDisplayName !== undefined) {
          payload.uploader_display_name = updates.uploaderDisplayName.trim();
        }

        const { error } = await client.from('community_pyqs').update(payload).eq('id', id);

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
     * Authoritative admin status update in public.community_pyqs (approve / reject).
     */
    async updateCommunityPyqStatus(
      id: string,
      status: 'approved' | 'active' | 'rejected',
      moderationNotes?: string
    ): Promise<{ paper: Paper | null; error: Error | null }> {
      try {
        const isAdmin = await checkAdmin();
        if (!isAdmin) {
          return { paper: null, error: new Error('Permission denied: administrator privileges required.') };
        }

        const dbStatus = status === 'approved' ? 'active' : status;
        const payload: Record<string, any> = {
          status: dbStatus,
          moderation_notes: status === 'rejected' ? moderationNotes?.trim() || 'Did not meet quality standards.' : null,
        };

        const { data, error } = await client
          .from('community_pyqs')
          .update(payload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (error) {
          return { paper: null, error: new Error(error.message) };
        }
        if (!data) {
          return { paper: null, error: new Error('Submission not found or status update was not permitted.') };
        }

        return { paper: mapCommunityRowToPaper(data), error: null };
      } catch (err: any) {
        return { paper: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    /**
     * Studify Team Administrator Reversible Removal:
     * Calls atomic `admin_remove_paper` RPC (preserves `sections`, logs removal audit row,
     * records `paper_moderation_states.previous_status`, and sets `status = 'removed'`).
     */
    async removeCommunityPyqByAdmin(
      id: string,
      reason: string,
      _adminEmail?: string
    ): Promise<{ success: boolean; error: Error | null }> {
      try {
        const cleanReason = reason?.trim() || 'Removed by Administrator';
        const { data, error } = await client.rpc('admin_remove_paper', {
          p_paper_id: id,
          p_reason: cleanReason,
        });

        if (error) {
          console.error('removeCommunityPyqByAdmin error:', error.message);
          return { success: false, error: new Error(error.message) };
        }

        if (data && data.success === false) {
          return { success: false, error: new Error(data.error || 'Could not remove paper.') };
        }

        return { success: true, error: null };
      } catch (err: any) {
        console.error('Unexpected error in removeCommunityPyqByAdmin:', err);
        return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    /**
     * Studify Team Administrator Restoration:
     * Restores the exact existing `community_pyqs` record to its `previous_status`,
     * preserves storage paths, reviews, ratings, and bookmarks, clears public removal notice,
     * and writes an immutable `restore_paper` audit entry.
     */
    async restoreCommunityPyqByAdmin(
      id: string,
      restoreNote?: string
    ): Promise<{ paper: Paper | null; error: Error | null }> {
      try {
        const { data, error } = await client.rpc('admin_restore_paper', {
          p_paper_id: id,
          p_restore_note: restoreNote?.trim() || null,
        });

        if (error) {
          console.error('restoreCommunityPyqByAdmin error:', error.message);
          return { paper: null, error: new Error(error.message) };
        }

        const restoredRow = data && typeof data === 'object' && 'paper' in data ? (data as any).paper : data;
        if (restoredRow && restoredRow.id) {
          return { paper: mapCommunityRowToPaper(restoredRow), error: null };
        }

        const refreshed = await this.getCommunityPyqById(id);
        return { paper: refreshed, error: null };
      } catch (err: any) {
        console.error('Unexpected error in restoreCommunityPyqByAdmin:', err);
        return { paper: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },

    /**
     * Fetch safe public removal notice for an unpublished paper without leaking
     * private storage paths, URLs, uploader IDs, or raw section metadata.
     */
    async getPaperRemovalNotice(paperId: string): Promise<PaperRemovalNotice | null> {
      try {
        const { data, error } = await client.rpc('get_paper_removal_notice', {
          p_paper_id: paperId,
        });
        if (error || !data) return null;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row || !row.id) return null;
        return {
          id: row.id,
          title: row.title || 'Question Paper',
          subject: row.subject || '',
          examBoard: row.exam_board || '',
          grade: row.grade || '',
          year: Number(row.year) || new Date().getFullYear(),
          removalReason: row.removal_reason || 'Removed by Administrator',
          removedAt: row.removed_at || new Date().toISOString(),
          removedBy: row.removed_by || 'Studify Administrator',
        };
      } catch {
        return null;
      }
    },

    /**
     * Fetch all papers for Studify Team Administrator Moderation (including removed/flagged/pending).
     */
    async fetchAdminModerationPyqs(): Promise<Paper[]> {
      try {
        const { data, error } = await client
          .from('community_pyqs')
          .select('*, paper_moderation_states(*)')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(mapCommunityRowToPaper);
        }

        const { data: plainData, error: plainError } = await client
          .from('community_pyqs')
          .select('*')
          .order('created_at', { ascending: false });

        if (plainError) {
          console.warn('fetchAdminModerationPyqs error:', plainError.message);
          return [];
        }

        return (plainData || []).map(mapCommunityRowToPaper);
      } catch (err) {
        console.warn('Unexpected error in fetchAdminModerationPyqs:', err);
        return [];
      }
    },

    /**
     * Fetch Removed / Unpublished Papers specifically for the Admin Moderation Panel.
     */
    async fetchAdminRemovedPyqs(): Promise<Paper[]> {
      try {
        const { data, error } = await client.rpc('admin_list_removed_papers');
        if (!error && Array.isArray(data)) {
          return data.map(mapCommunityRowToPaper);
        }
      } catch {
        // Fallback if RPC not yet applied
      }

      const all = await this.fetchAdminModerationPyqs();
      return all.filter((p) => p.status === 'removed' || p.isRemoved);
    },

    /**
     * Single Authoritative Deletion Method for Studify PYQs (Handles Cases A-F + Partial Failure):
     * - Removes Storage objects first (bucket-aware across community-pyqs and app-files)
     * - Uses private-bucket authenticated `.exists()` / `.info()` verification when supported,
     *   with signed-URL / HEAD fallback only for mock or legacy endpoints
     * - If any Storage object fails or partially fails, preserves DB row intact (`STORAGE_PARTIAL_DELETE` when >=1 succeeded)
     * - Deletes DB record atomically (via `delete_community_pyq_permanently` RPC when present, else scoped delete)
     */
    async deleteCommunityPyq(id: string, filePath?: string): Promise<DeleteCommunityPyqResult> {
      const fail = (
        code: DeletePaperErrorCode,
        message: string,
        opts?: {
          storageDeleted?: boolean;
          deletedPaths?: string[];
          missingPaths?: string[];
          failedPaths?: { path: string; reason: string }[];
          storagePartiallyDeleted?: boolean;
        }
      ): DeleteCommunityPyqResult => ({
        success: false,
        code,
        error: new Error(message),
        storageDeleted: Boolean(opts?.storageDeleted),
        dbDeleted: false,
        deletedPaths: opts?.deletedPaths || [],
        missingPaths: opts?.missingPaths || [],
        failedPaths: opts?.failedPaths,
        storagePartiallyDeleted: Boolean(opts?.storagePartiallyDeleted),
      });

      try {
        // 1. Authenticate caller
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();
        if (authError || !user) {
          return fail('UNAUTHENTICATED', 'You must be signed in to delete submissions.');
        }

        // 2. Fetch existing DB row (Case E if absent)
        const { data: existingRow, error: fetchError } = await client
          .from('community_pyqs')
          .select('id, uploader_id, file_path, file_url, sections')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) {
          return fail('DB_ERROR', `Could not verify submission before deletion: ${fetchError.message}`);
        }

        if (!existingRow) {
          return fail(
            'NOT_FOUND',
            'This submission could not be found in the database (it may have already been deleted).'
          );
        }

        // 3. Enforce ownership or verified admin authorization (Case F)
        const isAdmin = await checkAdmin();
        const isUploader = existingRow.uploader_id === user.id;

        if (!isUploader && !isAdmin) {
          return fail('UNAUTHORIZED', 'Permission denied: only the uploader or a verified admin can delete this upload.');
        }

        // 4. Collect all exact unique storage targets grouped by bucket
        const bucketTargets = new Map<string, Set<string>>();
        const addTarget = (raw?: string | null) => {
          const parsed = parseStorageBucketAndPath(raw, COMMUNITY_BUCKET);
          if (!parsed || !parsed.isSupabaseStorage) return;
          if (!bucketTargets.has(parsed.bucket)) {
            bucketTargets.set(parsed.bucket, new Set<string>());
          }
          bucketTargets.get(parsed.bucket)!.add(parsed.path);
        };

        addTarget(existingRow.file_path);
        addTarget(filePath);
        addTarget(existingRow.file_url);

        if (Array.isArray(existingRow.sections)) {
          for (const sec of existingRow.sections) {
            if (!sec) continue;
            if (typeof sec.filePath === 'string') addTarget(sec.filePath);
            if (typeof sec.fileUrl === 'string') addTarget(sec.fileUrl);
            if (typeof sec.path === 'string') addTarget(sec.path);
            if (typeof sec.url === 'string') addTarget(sec.url);
            if (Array.isArray(sec.imagePaths)) {
              for (const p of sec.imagePaths) addTarget(p);
            }
            if (Array.isArray(sec.imageUrls)) {
              for (const u of sec.imageUrls) addTarget(u);
            }
          }
        }

        const confirmedRemoved: string[] = [];
        const missingPaths: string[] = [];
        const failedPaths: { path: string; reason: string }[] = [];
        let firstFailureCode: DeletePaperErrorCode | null = null;
        let firstFailureMessage: string | null = null;

        // 5. Delete storage objects FIRST and verify deletion or genuine absence before touching DB
        for (const [bucket, pathSet] of bucketTargets.entries()) {
          const pathList = Array.from(pathSet);
          if (pathList.length === 0) continue;

          const bucketRef = client.storage.from(bucket) as unknown as {
            remove: (paths: string[]) => Promise<{ data: any[] | null; error: any | null }>;
            exists?: (path: string) => Promise<{ data: boolean; error: any }>;
            info?: (path: string) => Promise<{ data: unknown; error: any }>;
            createSignedUrl?: (
              path: string,
              expiresIn: number
            ) => Promise<{ data: { signedUrl: string } | null; error: any }>;
            getPublicUrl: (path: string) => { data: { publicUrl: string } };
          };

          const { data: removedObjects, error: storageError } = await bucketRef.remove(pathList);

          if (storageError) {
            const errCode = classifyStorageFailureCode(storageError);
            const msg = classifyStorageError(storageError, 'file deletion').message;
            if (!firstFailureCode) {
              firstFailureCode = errCode;
              firstFailureMessage = msg;
            }
            for (const p of pathList) {
              failedPaths.push({ path: p, reason: msg });
            }
            continue;
          }

          const removedNames = new Set(
            (Array.isArray(removedObjects) ? removedObjects : [])
              .map((obj: any) => normalizeStorageObjectName(obj?.name, bucket))
              .filter((n): n is string => Boolean(n))
          );

          const unconfirmedPaths: string[] = [];
          for (const targetPath of pathList) {
            const normTarget = normalizeStorageObjectName(targetPath, bucket) || targetPath;
            if (removedNames.has(normTarget)) {
              confirmedRemoved.push(targetPath);
            } else {
              unconfirmedPaths.push(targetPath);
            }
          }

          // Inspect unconfirmed paths:
          // When authenticated SDK methods (.exists / .info) exist, verify exclusively through
          // authenticated Storage endpoints and NEVER fall through to unauthenticated getPublicUrl()
          // HTTP HEAD probes (which return HTTP 400 on private buckets even when the object still exists!).
          const hasAuthenticatedProbe =
            typeof bucketRef.exists === 'function' || typeof bucketRef.info === 'function';

          for (const candidatePath of unconfirmedPaths) {
            const recordFailure = (code: DeletePaperErrorCode, msg: string) => {
              if (!firstFailureCode) {
                firstFailureCode = code;
                firstFailureMessage = msg;
              }
              failedPaths.push({ path: candidatePath, reason: msg });
            };

            if (hasAuthenticatedProbe) {
              let resolvedStatus: 'missing' | 'exists' | 'failed' = 'failed';
              let failCode: DeletePaperErrorCode = 'STORAGE_ERROR';
              let failMsg =
                'Could not verify storage object status before deleting database record. Database record was preserved.';

              if (typeof bucketRef.exists === 'function') {
                try {
                  const { data: stillExists, error: existsErr } = await bucketRef.exists(candidatePath);
                  const existsStatus = Number(existsErr?.statusCode ?? existsErr?.status ?? 0);
                  const existsMsg = String(existsErr?.message || '').toLowerCase();

                  if (stillExists === true && !existsErr) {
                    resolvedStatus = 'exists';
                    failCode = 'STORAGE_PERMISSION_ERROR';
                    failMsg =
                      'Permission denied: storage file still exists and could not be deleted (blocked by storage RLS policy or non-owner restriction). Database record was preserved.';
                  } else if (
                    stillExists === false &&
                    (!existsErr || existsStatus === 404 || existsMsg.includes('not found'))
                  ) {
                    resolvedStatus = 'missing';
                  } else if (
                    existsStatus === 401 ||
                    existsStatus === 403 ||
                    existsMsg.includes('policy') ||
                    existsMsg.includes('permission') ||
                    existsMsg.includes('unauthorized')
                  ) {
                    resolvedStatus = 'failed';
                    failCode = 'STORAGE_PERMISSION_ERROR';
                    failMsg = `Storage access denied (HTTP ${existsStatus || 403}) while verifying deletion. Database record was preserved.`;
                  } else if (existsStatus === 400) {
                    // Storage HEAD /object/{bucket}/{path} returns empty HTTP 400 for both missing objects
                    // and certain RLS denials; disambiguate via authenticated GET /object/info/{bucket}/{path}
                    if (typeof bucketRef.info === 'function') {
                      try {
                        const { data: infoData, error: infoErr } = await bucketRef.info(candidatePath);
                        const infoStatus = Number(infoErr?.statusCode ?? infoErr?.status ?? 0);
                        const infoMsg = String(infoErr?.message || '').toLowerCase();

                        if (!infoErr && infoData) {
                          resolvedStatus = 'exists';
                          failCode = 'STORAGE_PERMISSION_ERROR';
                          failMsg =
                            'Permission denied: storage file still exists and could not be deleted. Database record was preserved.';
                        } else if (
                          infoStatus === 404 ||
                          infoMsg.includes('not found') ||
                          infoMsg.includes('no such object')
                        ) {
                          resolvedStatus = 'missing';
                        } else if (
                          infoStatus === 401 ||
                          infoStatus === 403 ||
                          infoMsg.includes('policy') ||
                          infoMsg.includes('permission') ||
                          infoMsg.includes('unauthorized')
                        ) {
                          resolvedStatus = 'failed';
                          failCode = 'STORAGE_PERMISSION_ERROR';
                          failMsg = `Storage permission denied (HTTP ${infoStatus || 403}) while verifying deletion. Database record was preserved.`;
                        } else {
                          resolvedStatus = 'failed';
                          failCode = classifyStorageFailureCode(infoErr);
                          failMsg = `Could not verify missing vs protected storage object (HTTP ${infoStatus || 400}). Database record was preserved.`;
                        }
                      } catch (infoThrown: any) {
                        resolvedStatus = 'failed';
                        failCode = classifyStorageFailureCode(infoThrown);
                        failMsg = classifyStorageError(infoThrown, 'deletion verification').message;
                      }
                    } else if (typeof bucketRef.createSignedUrl === 'function') {
                      try {
                        const { data: signedData, error: signedErr } = await bucketRef.createSignedUrl(candidatePath, 60);
                        if (signedData?.signedUrl && !signedErr) {
                          const signedRes = await fetchFn(signedData.signedUrl, {
                            method: 'HEAD',
                            cache: 'no-store',
                          });
                          if (signedRes.status === 404) {
                            resolvedStatus = 'missing';
                          } else if (signedRes.ok || signedRes.status === 200 || signedRes.status === 206) {
                            resolvedStatus = 'exists';
                            failCode = 'STORAGE_PERMISSION_ERROR';
                            failMsg =
                              'Permission denied: storage file still exists and could not be deleted. Database record was preserved.';
                          } else {
                            resolvedStatus = 'failed';
                            failCode =
                              signedRes.status === 401 || signedRes.status === 403
                                ? 'STORAGE_PERMISSION_ERROR'
                                : 'STORAGE_NETWORK_ERROR';
                            failMsg = `Storage verification returned HTTP ${signedRes.status}. Database record was preserved.`;
                          }
                        } else {
                          const sStatus = Number(signedErr?.statusCode ?? signedErr?.status ?? 0);
                          const sMsg = String(signedErr?.message || '').toLowerCase();
                          if (sStatus === 404 || sMsg.includes('not found')) {
                            resolvedStatus = 'missing';
                          } else {
                            resolvedStatus = 'failed';
                            failCode = classifyStorageFailureCode(signedErr);
                            failMsg = classifyStorageError(signedErr, 'deletion verification').message;
                          }
                        }
                      } catch (signedThrown: any) {
                        resolvedStatus = 'failed';
                        failCode = classifyStorageFailureCode(signedThrown);
                        failMsg = classifyStorageError(signedThrown, 'deletion verification').message;
                      }
                    }
                  }
                } catch (existsThrown: any) {
                  resolvedStatus = 'failed';
                  failCode = classifyStorageFailureCode(existsThrown);
                  failMsg = classifyStorageError(existsThrown, 'deletion verification').message;
                }
              } else if (typeof bucketRef.info === 'function') {
                try {
                  const { data: infoData, error: infoErr } = await bucketRef.info(candidatePath);
                  const infoStatus = Number(infoErr?.statusCode ?? infoErr?.status ?? 0);
                  const infoMsg = String(infoErr?.message || '').toLowerCase();
                  if (!infoErr && infoData) {
                    resolvedStatus = 'exists';
                    failCode = 'STORAGE_PERMISSION_ERROR';
                    failMsg =
                      'Permission denied: storage file still exists and could not be deleted. Database record was preserved.';
                  } else if (infoStatus === 404 || infoMsg.includes('not found')) {
                    resolvedStatus = 'missing';
                  } else {
                    resolvedStatus = 'failed';
                    failCode = classifyStorageFailureCode(infoErr);
                    failMsg = classifyStorageError(infoErr, 'deletion verification').message;
                  }
                } catch (infoThrown: any) {
                  resolvedStatus = 'failed';
                  failCode = classifyStorageFailureCode(infoThrown);
                  failMsg = classifyStorageError(infoThrown, 'deletion verification').message;
                }
              }

              if (resolvedStatus === 'missing') {
                missingPaths.push(candidatePath);
              } else {
                recordFailure(failCode, failMsg);
              }
              continue;
            }

            // Fallback ONLY for unit-test mocks that provide getPublicUrl without .exists() / .info()
            const { data: publicUrlData } = bucketRef.getPublicUrl(candidatePath);
            const rawUrl = publicUrlData?.publicUrl || '';
            if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
              recordFailure(
                'STORAGE_ERROR',
                'Could not verify whether storage object still exists before deleting database record. Aborting deletion.'
              );
              continue;
            }

            const cacheBustUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
            let verifyRes: Response;
            try {
              verifyRes = await fetchFn(cacheBustUrl, { method: 'HEAD', cache: 'no-store' });
              if (verifyRes.status === 405) {
                verifyRes = await fetchFn(cacheBustUrl, {
                  method: 'GET',
                  headers: { Range: 'bytes=0-0' },
                  cache: 'no-store',
                });
              }
            } catch {
              try {
                verifyRes = await fetchFn(cacheBustUrl, {
                  method: 'GET',
                  headers: { Range: 'bytes=0-0' },
                  cache: 'no-store',
                });
              } catch {
                recordFailure(
                  'STORAGE_NETWORK_ERROR',
                  'Could not verify storage file status due to a network error. Database record was preserved safely.'
                );
                continue;
              }
            }

            if (verifyRes.status === 200 || verifyRes.status === 206 || verifyRes.ok) {
              recordFailure(
                'STORAGE_PERMISSION_ERROR',
                'Permission denied: storage file still exists and could not be deleted (blocked by storage RLS policy or non-owner restriction). Database record was preserved.'
              );
              continue;
            }

            if (verifyRes.status === 401 || verifyRes.status === 403) {
              recordFailure(
                'STORAGE_PERMISSION_ERROR',
                `Storage access returned HTTP ${verifyRes.status} while verifying deletion. Database record was preserved.`
              );
              continue;
            }

            if (verifyRes.status === 404 || verifyRes.status === 400) {
              missingPaths.push(candidatePath);
              continue;
            }

            recordFailure(
              'STORAGE_NETWORK_ERROR',
              `Unexpected storage response HTTP ${verifyRes.status} while verifying deletion. Database record was preserved.`
            );
          }
        }

        // If any Storage deletion failed, preserve the DB row intact and surface partial vs total failure clearly
        if (failedPaths.length > 0) {
          const isPartial = confirmedRemoved.length > 0;
          const summaryMsg = isPartial
            ? `Deleted ${confirmedRemoved.length} file(s), but ${failedPaths.length} file(s) could not be removed (${failedPaths[0].reason}). The database record was preserved so you can safely retry deletion.`
            : firstFailureMessage || 'Storage deletion failed; database record was preserved.';
          return fail(isPartial ? 'STORAGE_PARTIAL_DELETE' : firstFailureCode || 'STORAGE_ERROR', summaryMsg, {
            storageDeleted: isPartial,
            deletedPaths: confirmedRemoved,
            missingPaths,
            failedPaths,
            storagePartiallyDeleted: isPartial,
          });
        }

        // 6. Delete authoritative database row AFTER Storage cleanup succeeded
        let deletedViaRpc = false;
        try {
          const { data: rpcData, error: rpcError } = await client.rpc('delete_community_pyq_permanently', {
            p_paper_id: id,
          });
          if (!rpcError && rpcData && (rpcData as any).deleted === true) {
            deletedViaRpc = true;
          } else if (!rpcError && rpcData && (rpcData as any).deleted === false) {
            const rpcReason = String((rpcData as any).error || 'Database permanent delete did not complete.');
            if (rpcReason.toLowerCase().includes('not found')) {
              return fail('NOT_FOUND', rpcReason);
            }
            const storageNote =
              confirmedRemoved.length > 0
                ? `Storage file(s) were removed (${confirmedRemoved.length}), but deleting the database record failed`
                : `Storage file(s) were already absent, and deleting the database record failed`;
            return fail(
              'DB_DELETE_FAILED_AFTER_STORAGE_DELETE',
              `${storageNote}: ${rpcReason}. Retrying deletion is safe.`,
              {
                storageDeleted: confirmedRemoved.length > 0,
                deletedPaths: confirmedRemoved,
                missingPaths,
              }
            );
          } else if (rpcError) {
            const code = String(rpcError.code || '').toUpperCase();
            const msg = String(rpcError.message || '').toLowerCase();
            const rpcMissing = code === '42883' || code === 'PGRST202' || msg.includes('does not exist');
            if (!rpcMissing) {
              const storageNote =
                confirmedRemoved.length > 0
                  ? `Storage file(s) were removed (${confirmedRemoved.length}), but deleting the database record failed`
                  : `Storage file(s) were already absent, and deleting the database record failed`;
              return fail(
                'DB_DELETE_FAILED_AFTER_STORAGE_DELETE',
                `${storageNote}: ${rpcError.message}. Retrying deletion is safe.`,
                {
                  storageDeleted: confirmedRemoved.length > 0,
                  deletedPaths: confirmedRemoved,
                  missingPaths,
                }
              );
            }
          }
        } catch (rpcThrown: any) {
          const code = String(rpcThrown?.code || '').toUpperCase();
          const msg = String(rpcThrown?.message || '').toLowerCase();
          const rpcMissing = code === '42883' || code === 'PGRST202' || msg.includes('does not exist');
          if (!rpcMissing) {
            const storageNote =
              confirmedRemoved.length > 0
                ? `Storage file(s) were removed (${confirmedRemoved.length}), but deleting the database record failed`
                : `Storage file(s) were already absent, and deleting the database record failed`;
            return fail(
              'DB_DELETE_FAILED_AFTER_STORAGE_DELETE',
              `${storageNote}: ${rpcThrown?.message || 'RPC error'}. Retrying deletion is safe.`,
              {
                storageDeleted: confirmedRemoved.length > 0,
                deletedPaths: confirmedRemoved,
                missingPaths,
              }
            );
          }
        }

        if (!deletedViaRpc) {
          let deleteQuery = client.from('community_pyqs').delete().eq('id', id);
          if (!isAdmin) {
            deleteQuery = deleteQuery.eq('uploader_id', user.id);
          }

          const { data: deletedRows, error: dbError } = await deleteQuery.select('id');

          if (dbError || !deletedRows || deletedRows.length === 0) {
            const storageNote =
              confirmedRemoved.length > 0
                ? `Storage file(s) were removed (${confirmedRemoved.length}), but deleting the database record failed`
                : `Storage file(s) were already absent, and deleting the database record failed`;
            const reason = dbError?.message
              ? `${storageNote}: ${dbError.message}. Retrying deletion is safe.`
              : `${storageNote} due to database RLS permissions or missing row access. Retrying deletion is safe.`;

            if (dbError) {
              console.error('deleteCommunityPyq database error (after storage step):', dbError.message);
            }

            return fail('DB_DELETE_FAILED_AFTER_STORAGE_DELETE', reason, {
              storageDeleted: confirmedRemoved.length > 0,
              deletedPaths: confirmedRemoved,
              missingPaths,
            });
          }
        }

        // 7. Best-effort cleanup of related bookmarks & ratings after confirmed DB deletion
        try {
          let savedDelete = client.from('saved_papers').delete().eq('paper_id', id);
          if (!isAdmin) {
            savedDelete = savedDelete.eq('user_id', user.id);
          }
          await savedDelete;
        } catch {
          // Non-fatal secondary cleanup
        }

        try {
          let ratingDelete = client.from('paper_ratings').delete().eq('paper_id', id);
          if (!isAdmin) {
            ratingDelete = ratingDelete.eq('user_id', user.id);
          }
          await ratingDelete;
        } catch {
          // Non-fatal secondary cleanup
        }

        const outcomeCode: DeletePaperOutcomeCode =
          missingPaths.length > 0 ? 'DELETED_WITH_MISSING_STORAGE' : 'DELETED';

        return {
          success: true,
          code: outcomeCode,
          error: null,
          storageDeleted: confirmedRemoved.length > 0,
          dbDeleted: true,
          deletedPaths: confirmedRemoved,
          missingPaths,
        };
      } catch (err: any) {
        console.error('Unexpected error in deleteCommunityPyq:', err);
        return {
          success: false,
          code: 'DB_ERROR',
          error: err instanceof Error ? err : new Error(String(err)),
          storageDeleted: false,
          dbDeleted: false,
          deletedPaths: [],
          missingPaths: [],
        };
      }
    },

    /**
     * Increment view counter using hardened RPC: increment_community_pyq_view(target_pyq_id).
     */
    async incrementView(targetPyqId: string): Promise<void> {
      try {
        const { error } = await client.rpc('increment_community_pyq_view', {
          target_pyq_id: targetPyqId,
        });
        if (error) {
          console.warn('increment_community_pyq_view notice:', error.message);
        }
      } catch {
        // Silent catch so UI does not fail on view count
      }
    },

    /**
     * Increment download counter using hardened RPC: increment_community_pyq_download(target_pyq_id).
     */
    async incrementDownload(targetPyqId: string): Promise<void> {
      try {
        const { error } = await client.rpc('increment_community_pyq_download', {
          target_pyq_id: targetPyqId,
        });
        if (error) {
          console.warn('increment_community_pyq_download notice:', error.message);
        }
      } catch {
        // Silent catch so download flow proceeds uninterrupted
      }
    },
  };
}

export const communityPyqService = createCommunityPyqService();

