const DB_NAME = 'studify_guest_note_files_v1';
const STORE_NAME = 'note_files';
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB before client optimization

export const GUEST_NOTE_FILES_DB_NAME = DB_NAME;

export const ALLOWED_NOTE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export interface StoredLocalBlobRecord {
  key: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  savedAt: string;
}

// In-memory fallback map when running inside SSR / Node test environments without IndexedDB
const memoryFallbackStore = new Map<string, StoredLocalBlobRecord>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open local file storage.'));
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export function validateNoteFileCandidate(
  file: { type?: string; name?: string; size?: number }
): { valid: boolean; kind: 'pdf' | 'image'; mimeType: string; error?: string } {
  const name = (file.name || '').toLowerCase();
  let mimeType = (file.type || '').toLowerCase().trim();

  if (!mimeType) {
    if (name.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (name.endsWith('.png')) mimeType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (name.endsWith('.webp')) mimeType = 'image/webp';
  }
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  if (!ALLOWED_NOTE_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      kind: 'image',
      mimeType,
      error: `Unsupported file format (${file.name || mimeType || 'unknown'}). Upload a PDF, PNG, JPG, or WebP image.`,
    };
  }

  const size = Number(file.size || 0);
  if (size <= 0) {
    return {
      valid: false,
      kind: mimeType === 'application/pdf' ? 'pdf' : 'image',
      mimeType,
      error: 'Selected file is empty.',
    };
  }

  if (mimeType === 'application/pdf' && size > MAX_PDF_BYTES) {
    return {
      valid: false,
      kind: 'pdf',
      mimeType,
      error: 'PDF exceeds the 25 MB limit per file.',
    };
  }

  if (mimeType !== 'application/pdf' && size > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      kind: 'image',
      mimeType,
      error: 'Image exceeds the 20 MB limit.',
    };
  }

  return {
    valid: true,
    kind: mimeType === 'application/pdf' ? 'pdf' : 'image',
    mimeType,
  };
}

/**
 * Downscales very large camera photos cleanly while keeping handwritten text sharp.
 * Falls back safely to the original Blob in environments without Canvas/DOM.
 */
export async function optimizeNoteImageBlob(
  file: Blob,
  originalName: string = 'note_photo.jpg',
  maxDimension: number = 1920,
  quality: number = 0.86
): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
  const mime = (file.type || 'image/jpeg').toLowerCase();
  if (mime === 'application/pdf') {
    return { blob: file, mimeType: 'application/pdf', fileName: originalName };
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { blob: file, mimeType: mime || 'image/jpeg', fileName: originalName };
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not decode image.'));
        image.src = objectUrl;
      });

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        return { blob: file, mimeType: mime || 'image/jpeg', fileName: originalName };
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      // If image is already reasonably sized and compact, keep untouched
      if (scale === 1 && file.size <= 1_200_000) {
        return { blob: file, mimeType: mime || 'image/jpeg', fileName: originalName };
      }

      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { blob: file, mimeType: mime || 'image/jpeg', fileName: originalName };
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const outMime = mime === 'image/png' && file.size < 2_000_000 ? 'image/png' : 'image/jpeg';
      const encoded = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), outMime, quality);
      });

      if (!encoded) {
        return { blob: file, mimeType: mime || 'image/jpeg', fileName: originalName };
      }

      const baseName = originalName.replace(/\.[^.]+$/, '') || 'note_page';
      const ext = outMime === 'image/png' ? 'png' : 'jpg';
      return {
        blob: encoded,
        mimeType: outMime,
        fileName: `${baseName}.${ext}`,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return { blob: file, mimeType: mime || 'image/jpeg', fileName: originalName };
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const noteAttachmentStore = {
  async saveLocalBlob(
    key: string,
    blob: Blob,
    meta?: { fileName?: string; mimeType?: string }
  ): Promise<void> {
    const record: StoredLocalBlobRecord = {
      key,
      blob,
      fileName: meta?.fileName || 'note_attachment',
      mimeType: meta?.mimeType || blob.type || 'application/octet-stream',
      savedAt: new Date().toISOString(),
    };

    if (!hasIndexedDb()) {
      memoryFallbackStore.set(key, record);
      return;
    }

    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Failed to store local attachment.'));
      });
    } finally {
      db.close();
    }
  },

  async getLocalBlob(key: string): Promise<Blob | null> {
    if (!key) return null;
    if (!hasIndexedDb()) {
      return memoryFallbackStore.get(key)?.blob || null;
    }

    const db = await openDatabase();
    try {
      return await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => {
          const rec = req.result as StoredLocalBlobRecord | undefined;
          resolve(rec?.blob || null);
        };
        req.onerror = () => reject(req.error || new Error('Failed to read local attachment.'));
      });
    } finally {
      db.close();
    }
  },

  async deleteLocalBlob(key: string): Promise<void> {
    if (!key) return;
    if (!hasIndexedDb()) {
      memoryFallbackStore.delete(key);
      return;
    }

    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Failed to remove local attachment.'));
      });
    } finally {
      db.close();
    }
  },

  clearInMemoryBlobsForTest(): void {
    memoryFallbackStore.clear();
  },
};
