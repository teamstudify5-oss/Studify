import JSZip from 'jszip';
import { Paper } from '../types';
import { supabase } from '../supabaseClient.js';
import {
  COMMUNITY_BUCKET,
  parseStorageBucketAndPath,
  supabaseStorage,
} from './supabaseStorage';

export interface PaperDownloadResult {
  downloadedFileName: string;
  kind: 'pdf' | 'image' | 'zip' | 'text';
}

export interface StorageDownloadLike {
  from: (bucket: string) => {
    download: (path: string, transform?: unknown, options?: { cache?: RequestCache }) => Promise<{ data: Blob | null; error: any }>;
    createSignedUrl: (
      path: string,
      expiresIn: number,
      options?: { download?: string | boolean }
    ) => Promise<{ data: { signedUrl?: string } | null; error: any }>;
  };
}

export interface DownloadPaperDependencies {
  fetchImpl?: typeof fetch;
  storageClient?: StorageDownloadLike;
  triggerDownload?: (href: string, downloadName: string, mimeType?: string) => void;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

const SUPPORTED_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'zip'] as const;

function sanitizeBaseName(raw: string): string {
  const cleaned = (raw || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  return cleaned.slice(0, 120) || 'studify_paper';
}

export function sanitizeFileName(rawName: string, fallbackExt: string): string {
  const cleanExt = fallbackExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'pdf';
  const trimmed = (rawName || '').trim();
  const match = trimmed.match(/^(.*)\.([a-zA-Z0-9]{1,8})$/);

  if (match && match[1]) {
    const base = sanitizeBaseName(match[1]);
    const ext = match[2].toLowerCase();
    return `${base}.${ext}`;
  }

  return `${sanitizeBaseName(trimmed)}.${cleanExt}`;
}

function getMimeFromExt(ext: string): string {
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
      return 'application/octet-stream';
  }
}

function inferExtensionFromUrlOrMime(
  urlOrPath: string,
  mimeType?: string | null,
  fallback = 'jpg'
): string {
  const mime = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'zip';

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
    const pathname = new URL(urlOrPath, origin).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match) {
      const ext = match[1].toLowerCase();
      if ((SUPPORTED_EXTS as readonly string[]).includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
  } catch {
    // ignore URL parse failure
  }

  return fallback;
}

function scheduleCleanup(fn: () => void, delayMs: number): void {
  const timer = setTimeout(fn, delayMs) as unknown as { unref?: () => void };
  timer?.unref?.();
}

function triggerBrowserDownload(href: string, downloadName: string, mimeType?: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = downloadName;
  link.rel = 'noopener noreferrer';
  if (mimeType) {
    link.type = mimeType;
  }
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  scheduleCleanup(() => {
    try {
      link.remove();
    } catch {
      // ignore cleanup failure
    }
  }, 1000);
}

/**
 * Inspects leading bytes to reject HTML error pages / JSON error payloads and infer authentic format.
 */
async function validateDownloadedBlob(
  blob: Blob,
  reportedMime: string | null | undefined,
  expectedKind: 'pdf' | 'image' | 'any'
): Promise<{ blob: Blob; mimeType: string; detectedExt: string | null }> {
  if (!blob || blob.size <= 0) {
    throw new Error('Downloaded file is empty.');
  }

  const normalizedReported = (reportedMime || '').toLowerCase().split(';')[0].trim();
  if (normalizedReported === 'application/json' || normalizedReported === 'text/html') {
    throw new Error('Storage returned an error payload instead of the requested paper file.');
  }

  const headSlice = blob.slice(0, 64);
  const buffer = await headSlice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const headText = new TextDecoder().decode(bytes).trimStart();

  // Reject HTML / JSON masquerading inside generic blobs
  if (
    headText.startsWith('<!DOCTYPE') ||
    headText.startsWith('<html') ||
    headText.startsWith('{')
  ) {
    throw new Error('Storage returned an invalid response instead of the paper file.');
  }

  // Detect authentic file signatures
  let detectedExt: string | null = null;
  let detectedMime: string | null = null;

  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    detectedExt = 'pdf';
    detectedMime = 'application/pdf';
  } else if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    detectedExt = 'png';
    detectedMime = 'image/png';
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detectedExt = 'jpg';
    detectedMime = 'image/jpeg';
  } else if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    detectedExt = 'webp';
    detectedMime = 'image/webp';
  } else if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    detectedExt = 'gif';
    detectedMime = 'image/gif';
  } else if (headText.startsWith('<svg') || headText.includes('<svg')) {
    detectedExt = 'svg';
    detectedMime = 'image/svg+xml';
  }

  if (expectedKind === 'pdf' && normalizedReported && normalizedReported !== 'application/pdf' && normalizedReported !== 'application/octet-stream' && detectedExt !== 'pdf') {
    throw new Error('Downloaded file is not a valid PDF document.');
  }

  const finalMime =
    detectedMime ||
    (normalizedReported && normalizedReported !== 'application/octet-stream'
      ? normalizedReported
      : expectedKind === 'pdf'
      ? 'application/pdf'
      : 'application/octet-stream');

  const typedBlob =
    blob.type === finalMime ? blob : new Blob([blob], { type: finalMime });

  return {
    blob: typedBlob,
    mimeType: finalMime,
    detectedExt,
  };
}

async function fetchUrlAsBlob(
  url: string,
  fetchImpl: typeof fetch
): Promise<{ blob: Blob; contentType: string | null }> {
  let response: Response;
  try {
    response = await fetchImpl(url, { mode: 'cors', cache: 'no-store' });
  } catch {
    throw new Error('Could not reach file storage to download this paper. Please check your connection and try again.');
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 404) {
      throw new Error('The file for this paper could not be found in storage.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Access denied while downloading this paper from storage.');
    }
    throw new Error(`Storage returned HTTP ${response.status} while downloading this paper.`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.toLowerCase().includes('application/json') || contentType.toLowerCase().includes('text/html'))) {
    throw new Error('Storage returned an invalid response instead of the paper file.');
  }

  const blob = await response.blob();
  if (blob.size <= 0) {
    throw new Error('Downloaded file is empty.');
  }

  return { blob, contentType };
}

/**
 * Resolves any managed storage path or legacy Supabase URL using private-bucket authenticated
 * `.download()` first, falling back to a short-lived signed URL + `fetch(..., { cache: 'no-store' })`.
 */
async function fetchStorageOrRemoteBlob(
  rawTarget: string,
  expectedKind: 'pdf' | 'image' | 'any',
  deps?: DownloadPaperDependencies
): Promise<{ blob: Blob; mimeType: string; detectedExt: string | null; resolvedRef: string }> {
  const fetchImpl = deps?.fetchImpl ?? fetch;

  if (rawTarget.startsWith('blob:') || rawTarget.startsWith('data:')) {
    const localRes = await fetchImpl(rawTarget);
    const localBlob = await localRes.blob();
    const validated = await validateDownloadedBlob(localBlob, localBlob.type, expectedKind);
    return { ...validated, resolvedRef: rawTarget };
  }

  const parsed = parseStorageBucketAndPath(rawTarget, COMMUNITY_BUCKET);
  if (parsed && parsed.isSupabaseStorage) {
    // Offline test compatibility: if fetchImpl is injected without a storageClient mock,
    // route all storage paths through injected fetchImpl instead of hitting live Supabase Storage.
    if (deps?.fetchImpl && !deps?.storageClient) {
      const targetUrl =
        rawTarget.startsWith('http://') || rawTarget.startsWith('https://')
          ? rawTarget
          : `https://storage.local/storage/v1/object/${parsed.bucket}/${parsed.path}`;
      const { blob, contentType } = await fetchUrlAsBlob(targetUrl, fetchImpl);
      const validated = await validateDownloadedBlob(blob, contentType || blob.type, expectedKind);
      return { ...validated, resolvedRef: rawTarget };
    }

    // 1. Primary path for private & public buckets: authenticated Storage .download()
    if (deps?.storageClient) {
      const bucketRef = deps.storageClient.from(parsed.bucket);
      const { data, error } = await bucketRef.download(parsed.path, undefined, { cache: 'no-store' });
      if (!error && data) {
        const validated = await validateDownloadedBlob(data, data.type, expectedKind);
        return { ...validated, resolvedRef: parsed.path };
      }

      const { data: signedData } = await bucketRef.createSignedUrl(parsed.path, 300);
      if (signedData?.signedUrl) {
        const { blob, contentType } = await fetchUrlAsBlob(signedData.signedUrl, fetchImpl);
        const validated = await validateDownloadedBlob(blob, contentType || blob.type, expectedKind);
        return { ...validated, resolvedRef: signedData.signedUrl };
      }

      const status = error?.statusCode ?? error?.status;
      if (status === 401 || status === 403) {
        throw new Error('Access denied while downloading this paper from storage.');
      }
      if (status === 404 || status === 400) {
        throw new Error('The file for this paper could not be found in storage.');
      }
      throw new Error(error?.message || 'Could not download file from Supabase Storage.');
    }

    const direct = await supabaseStorage.downloadStorageBlob(rawTarget, COMMUNITY_BUCKET);
    if (direct.blob && !direct.error) {
      const validated = await validateDownloadedBlob(direct.blob, direct.contentType, expectedKind);
      return { ...validated, resolvedRef: parsed.path };
    }

    // 2. Fallback: short-lived signed URL from Storage
    const signedUrl = await supabaseStorage.getSignedFileUrl(rawTarget, 300, {
      defaultBucket: parsed.bucket,
    });
    if (signedUrl) {
      const { blob, contentType } = await fetchUrlAsBlob(signedUrl, fetchImpl);
      const validated = await validateDownloadedBlob(blob, contentType || blob.type, expectedKind);
      return { ...validated, resolvedRef: signedUrl };
    }

    // 3. Final fallback only if direct external/public URL was provided cleanly
    if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
      const { blob, contentType } = await fetchUrlAsBlob(rawTarget, fetchImpl);
      const validated = await validateDownloadedBlob(blob, contentType || blob.type, expectedKind);
      return { ...validated, resolvedRef: rawTarget };
    }

    if (direct.status === 401 || direct.status === 403) {
      throw new Error('Access denied while downloading this paper from storage.');
    }
    if (direct.status === 404 || direct.status === 400) {
      throw new Error('The file for this paper could not be found in storage.');
    }
    throw direct.error || new Error('Unable to download this paper from storage.');
  }

  // Non-Supabase external HTTP(S) URL
  const { blob, contentType } = await fetchUrlAsBlob(rawTarget, fetchImpl);
  const validated = await validateDownloadedBlob(blob, contentType || blob.type, expectedKind);
  return { ...validated, resolvedRef: rawTarget };
}

/**
 * Helper for workspace / generic attachment downloads so all saved attachments
 * trigger real device downloads via same-origin Blob URLs instead of opening tabs.
 */
export async function downloadManagedFile(
  pathOrUrl: string,
  suggestedFileName: string,
  defaultBucket: string = COMMUNITY_BUCKET,
  deps?: DownloadPaperDependencies
): Promise<string> {
  const triggerDownload = deps?.triggerDownload ?? triggerBrowserDownload;
  const createObjectUrl = deps?.createObjectUrl ?? ((b: Blob) => URL.createObjectURL(b));
  const revokeObjectUrl = deps?.revokeObjectUrl ?? ((u: string) => URL.revokeObjectURL(u));

  const parsed = parseStorageBucketAndPath(pathOrUrl, defaultBucket);
  const targetRef =
    parsed && parsed.isSupabaseStorage
      ? `${parsed.bucket}/${parsed.path}`
      : pathOrUrl;

  const { blob, mimeType, detectedExt, resolvedRef } = await fetchStorageOrRemoteBlob(
    targetRef,
    'any',
    deps
  );

  const inferredExt =
    detectedExt || inferExtensionFromUrlOrMime(resolvedRef, mimeType || blob.type, 'pdf');
  const safeFileName = sanitizeFileName(suggestedFileName, inferredExt);
  const finalMime = mimeType === 'application/octet-stream' ? getMimeFromExt(inferredExt) : mimeType;
  const finalBlob = blob.type === finalMime ? blob : new Blob([blob], { type: finalMime });

  const blobUrl = createObjectUrl(finalBlob);
  triggerDownload(blobUrl, safeFileName, finalMime);
  scheduleCleanup(() => revokeObjectUrl(blobUrl), 60_000);

  return safeFileName;
}

export async function downloadPaperAsset(
  paper: Paper,
  deps?: DownloadPaperDependencies
): Promise<PaperDownloadResult> {
  const triggerDownload = deps?.triggerDownload ?? triggerBrowserDownload;
  const createObjectUrl = deps?.createObjectUrl ?? ((b: Blob) => URL.createObjectURL(b));
  const revokeObjectUrl = deps?.revokeObjectUrl ?? ((u: string) => URL.revokeObjectURL(u));

  const imageTargets =
    paper.imagePaths && paper.imagePaths.length > 0
      ? paper.imagePaths.filter(Boolean)
      : paper.imageUrls && paper.imageUrls.length > 0
      ? paper.imageUrls.filter(Boolean)
      : paper.isImageBased && (paper.filePath || paper.fileUrl)
      ? [paper.filePath || paper.fileUrl!]
      : [];

  // 1. Multi-page image question paper -> bundle all pages cleanly into a single ZIP archive
  if (imageTargets.length > 1) {
    const zip = new JSZip();

    for (let i = 0; i < imageTargets.length; i++) {
      const { blob, mimeType, detectedExt, resolvedRef } = await fetchStorageOrRemoteBlob(
        imageTargets[i],
        'image',
        deps
      );
      const ext =
        detectedExt || inferExtensionFromUrlOrMime(resolvedRef, mimeType || blob.type, 'jpg');
      const pageNum = String(i + 1).padStart(2, '0');
      zip.file(`page_${pageNum}.${ext}`, blob);
    }

    const rawZipBlob = await zip.generateAsync({ type: 'blob' });
    const zipMime = 'application/zip';
    const zipBlob =
      rawZipBlob.type === zipMime ? rawZipBlob : new Blob([rawZipBlob], { type: zipMime });
    const baseTitle = sanitizeBaseName(paper.title || `${paper.subject}_${paper.year}`);
    const zipFileName = `${baseTitle}_pages.zip`;
    const blobUrl = createObjectUrl(zipBlob);
    triggerDownload(blobUrl, zipFileName, zipMime);
    scheduleCleanup(() => revokeObjectUrl(blobUrl), 60_000);

    return { downloadedFileName: zipFileName, kind: 'zip' };
  }

  // 2. Single attached file (PDF or single image)
  const singleTarget =
    imageTargets.length === 1 ? imageTargets[0] : paper.filePath || paper.fileUrl;

  if (singleTarget) {
    const isSingleImage =
      imageTargets.length === 1 ||
      Boolean(paper.isImageBased) ||
      /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(singleTarget);

    const { blob, mimeType, detectedExt, resolvedRef } = await fetchStorageOrRemoteBlob(
      singleTarget,
      isSingleImage ? 'image' : 'pdf',
      deps
    );

    const inferredExt =
      detectedExt ||
      inferExtensionFromUrlOrMime(
        resolvedRef,
        mimeType || blob.type,
        isSingleImage ? 'jpg' : 'pdf'
      );

    const rawBaseName =
      paper.fileName && !paper.fileName.toLowerCase().includes('pages (images)')
        ? paper.fileName
        : `${paper.title || `${paper.subject}_${paper.year}`}.${inferredExt}`;
    const safeFileName = sanitizeFileName(rawBaseName, inferredExt);

    const finalMime =
      mimeType && mimeType !== 'application/octet-stream'
        ? mimeType
        : getMimeFromExt(inferredExt);
    const typedBlob = blob.type === finalMime ? blob : new Blob([blob], { type: finalMime });

    const blobUrl = createObjectUrl(typedBlob);
    triggerDownload(blobUrl, safeFileName, finalMime);
    scheduleCleanup(() => revokeObjectUrl(blobUrl), 60_000);

    return {
      downloadedFileName: safeFileName,
      kind: isSingleImage ? 'image' : 'pdf',
    };
  }

  // 3. Pure structured text paper (ONLY when there is truly no attached fileUrl/filePath or images)
  if (
    Array.isArray(paper.sections) &&
    paper.sections.some((s) => Array.isArray(s.questions) && s.questions.length > 0)
  ) {
    const questionsText = paper.sections
      .map(
        (sec) =>
          `\n--- ${sec.name}: ${sec.title} (${sec.totalMarks} Marks) ---\n` +
          (sec.instructions ? `Instructions: ${sec.instructions}\n\n` : '\n') +
          sec.questions
            .map(
              (q) =>
                `Q.${q.number} [${q.marks} Marks]\n${q.text}\n` +
                (q.formula ? `Formula: ${q.formula}\n` : '') +
                (q.choices
                  ? q.choices.map((c) => `  (${c.key}) ${c.text}`).join('\n') + '\n'
                  : '')
            )
            .join('\n')
      )
      .join('\n');

    const marksLine = paper.totalMarks && paper.totalMarks > 0 ? `Total Marks: ${paper.totalMarks}\n` : '';
    const timeLine =
      paper.timeAllowedMinutes && paper.timeAllowedMinutes > 0
        ? `Time: ${paper.timeAllowedMinutes / 60} Hours\n`
        : '';

    const fileContent =
      `${paper.examBoard.toUpperCase()} — ${paper.grade}\n` +
      `Subject: ${paper.subject} (${paper.year})\n` +
      `Title: ${paper.title}\n` +
      marksLine +
      timeLine +
      `\n============================================================\n` +
      questionsText +
      `\n\n============================================================\n` +
      `Downloaded from Studify (100% Free Study Repository)\n`;

    const textMime = 'text/plain;charset=utf-8';
    const blob = new Blob([fileContent], { type: textMime });
    const url = createObjectUrl(blob);
    const txtName = `${sanitizeBaseName((paper.fileName || `${paper.subject}_${paper.year}`).replace(/\.(pdf|txt)$/i, ''))}.txt`;
    triggerDownload(url, txtName, textMime);
    scheduleCleanup(() => revokeObjectUrl(url), 60_000);

    return { downloadedFileName: txtName, kind: 'text' };
  }

  throw new Error('No downloadable PDF or image file is attached to this paper.');
}
