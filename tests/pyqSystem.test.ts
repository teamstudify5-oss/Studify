import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createCommunityPyqService,
  extractCommunityStoragePath,
  mapCommunityRowToPaper,
  CommunityPyqRow,
} from '../src/services/communityPyqService';
import { parseStorageBucketAndPath } from '../src/services/supabaseStorage';
import { storageService } from '../src/services/storage';
import { workspaceService, createWorkspaceService } from '../src/services/workspaceService';
import {
  createAppFeedbackService,
  computeFeedbackBreakdown,
} from '../src/services/appFeedbackService';
import { syncAccountCacheIsolation } from '../src/context/AuthContext';

// Lightweight in-memory localStorage mock for Node test runner isolation
const mockStore = new Map<string, string>();
const originalLocalStorage = (globalThis as any).localStorage;
(globalThis as any).localStorage = {
  getItem: (k: string) => (mockStore.has(k) ? mockStore.get(k)! : null),
  setItem: (k: string, v: string) => {
    mockStore.set(k, String(v));
  },
  removeItem: (k: string) => {
    mockStore.delete(k);
  },
  clear: () => mockStore.clear(),
  key: (i: number) => Array.from(mockStore.keys())[i] ?? null,
  get length() {
    return mockStore.size;
  },
};

after(() => {
  if (originalLocalStorage !== undefined) {
    (globalThis as any).localStorage = originalLocalStorage;
  } else {
    delete (globalThis as any).localStorage;
  }
});

beforeEach(() => {
  mockStore.clear();
  storageService.clearInMemoryState();
  workspaceService.setStorageScope('user');
});

interface MockSupabaseOptions {
  currentUserId?: string | null;
  rows?: Record<string, any>[];
  storageUploadError?: Error | null;
  storageRemoveResult?: { data: any[] | null; error: any | null };
  dbDeleteResult?: { data: any[] | null; error: any | null };
  onStorageRemove?: (paths: string[]) => void;
  onDbDelete?: (filters: Record<string, any>) => void;
}

function createMockSupabase(opts: MockSupabaseOptions = {}) {
  const tableRows: Record<string, any[]> = {
    community_pyqs: opts.rows ? opts.rows.map((r) => ({ ...r })) : [],
    saved_papers: [],
    paper_ratings: [],
  };

  const client: any = {
    auth: {
      getUser: async () => ({
        data: {
          user: opts.currentUserId
            ? { id: opts.currentUserId, user_metadata: { name: 'Test User' } }
            : null,
        },
        error: null,
      }),
      getSession: async () => ({
        data: { session: opts.currentUserId ? { access_token: 'mock-token' } : null },
        error: null,
      }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          if (opts.storageUploadError) {
            return { data: null, error: opts.storageUploadError };
          }
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
        remove: async (paths: string[]) => {
          opts.onStorageRemove?.(paths);
          if (opts.storageRemoveResult) {
            return opts.storageRemoveResult;
          }
          return {
            data: paths.map((name) => ({ name })),
            error: null,
          };
        },
      }),
    },
    from: (table: string) => {
      const filters: Record<string, any> = {};
      let mode: 'select' | 'insert' | 'delete' = 'select';
      let insertRows: any[] = [];

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          filters[col] = val;
          return builder;
        },
        order: () => builder,
        insert: (rowsToInsert: any[]) => {
          mode = 'insert';
          insertRows = rowsToInsert;
          return {
            select: () => ({
              single: async () => {
                const inserted = {
                  id: `pyq-${Date.now()}`,
                  views_count: 0,
                  downloads_count: 0,
                  rating: 0,
                  rating_count: 0,
                  reviews: [],
                  comments: [],
                  status: 'active',
                  is_flagged: false,
                  report_count: 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  ...insertRows[0],
                };
                tableRows[table] = tableRows[table] || [];
                tableRows[table].unshift(inserted);
                return { data: inserted, error: null };
              },
            }),
          };
        },
        delete: () => {
          mode = 'delete';
          const executeDelete = () => {
            if (table === 'community_pyqs') {
              opts.onDbDelete?.({ ...filters });
              if (opts.dbDeleteResult) {
                return opts.dbDeleteResult;
              }
            }
            const existing = tableRows[table] || [];
            const matched: any[] = [];
            const remaining: any[] = [];
            for (const row of existing) {
              const isMatch = Object.entries(filters).every(([k, v]) => row[k] === v);
              if (isMatch) matched.push(row);
              else remaining.push(row);
            }
            tableRows[table] = remaining;
            return { data: matched.map((r) => ({ id: r.id })), error: null };
          };

          const delChain: any = {
            eq: (col: string, val: any) => {
              filters[col] = val;
              return delChain;
            },
            select: async () => executeDelete(),
            then: (resolve: any) => resolve(executeDelete()),
          };
          return delChain;
        },
        maybeSingle: async () => {
          const rows = tableRows[table] || [];
          const found = rows.find((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v)
          );
          return { data: found ?? null, error: null };
        },
        then: (resolve: any) => {
          if (mode === 'select') {
            const rows = (tableRows[table] || []).filter((r) =>
              Object.entries(filters).every(([k, v]) => r[k] === v)
            );
            resolve({ data: rows, error: null });
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return builder;
    },
    rpc: async () => ({ error: null }),
  };

  return { client, tableRows };
}

function makeSampleRow(overrides: Partial<CommunityPyqRow> = {}): CommunityPyqRow {
  return {
    id: 'paper-1',
    uploader_id: 'user-a',
    uploader_display_name: 'Student A',
    title: 'Physics Midterm',
    subject: 'Physics',
    grade: 'Class 12',
    exam_board: 'CBSE',
    year: 2025,
    chapter: null,
    description: null,
    total_marks: 70,
    time_allowed_minutes: 180,
    file_name: 'physics.pdf',
    file_path: 'user-a/123_uuid_physics.pdf',
    file_url: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/123_uuid_physics.pdf',
    file_size_bytes: 1024,
    tags: ['CBSE', 'Physics'],
    sections: [],
    views_count: 0,
    downloads_count: 0,
    rating: 0,
    rating_count: 0,
    reviews: [],
    comments: [],
    status: 'active',
    is_flagged: false,
    report_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

test('Scenario 1: PDF & multi-image upload stores exact file_path and sections[0].imagePaths verbatim', async () => {
  const { client, tableRows } = createMockSupabase({ currentUserId: 'user-a' });
  const svc = createCommunityPyqService({
    supabaseClient: client,
    isCurrentUserAdmin: async () => false,
  });

  // 1A: PDF upload
  const pdfBlob = new Blob(['%PDF-1.4 test content'], { type: 'application/pdf' });
  const pdfUpload = await svc.uploadCommunityPyq({
    file: pdfBlob,
    fileName: 'sample_exam.pdf',
    title: 'Chemistry Mock',
    subject: 'Chemistry',
    grade: 'Class 12',
    examBoard: 'CBSE',
    year: 2025,
    isImageBased: false,
  });

  assert.equal(pdfUpload.error, null);
  assert.ok(pdfUpload.paper);
  const rawPdfRow = tableRows.community_pyqs[0];
  assert.ok(rawPdfRow.file_path.startsWith('user-a/'));
  assert.equal(pdfUpload.paper.filePath, rawPdfRow.file_path);

  // 1B: Multi-image upload
  const page1 = new File([new Uint8Array([137, 80, 78, 71])], 'page_1.png', { type: 'image/png' });
  const page2 = new File([new Uint8Array([137, 80, 78, 71])], 'page_2.png', { type: 'image/png' });
  const imgUpload = await svc.uploadCommunityPyq({
    files: [page1, page2],
    title: 'Maths Handwritten Photos',
    subject: 'Mathematics',
    grade: 'Class 12',
    examBoard: 'CBSE',
    year: 2025,
    isImageBased: true,
  });

  assert.equal(imgUpload.error, null);
  assert.ok(imgUpload.paper);
  const rawImgRow = tableRows.community_pyqs[0];
  const storedPaths: string[] = rawImgRow.sections[0].imagePaths;
  assert.equal(storedPaths.length, 2);
  assert.equal(rawImgRow.file_path, storedPaths[0]);
  assert.deepEqual(imgUpload.paper.imagePaths, storedPaths);
  assert.equal(
    extractCommunityStoragePath(imgUpload.paper.imageUrls?.[1]),
    storedPaths[1]
  );
});

test('Scenario 2 (Case A): Delete deletes Storage objects first and then deletes DB row', async () => {
  const row = makeSampleRow({
    id: 'paper-img-2',
    file_name: '2 Pages (Images)',
    file_path: 'user-a/p1.png',
    file_url: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/p1.png',
    sections: [
      {
        isImageBased: true,
        imagePaths: ['user-a/p1.png', 'user-a/p2.png'],
        imageUrls: [
          'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/p1.png',
          'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/p2.png',
        ],
      },
    ],
  });

  const events: string[] = [];
  const { client, tableRows } = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
    onStorageRemove: (paths) => events.push(`storage:${paths.join(',')}`),
    onDbDelete: () => events.push('db'),
  });

  const svc = createCommunityPyqService({
    supabaseClient: client,
    isCurrentUserAdmin: async () => false,
  });

  const res = await svc.deleteCommunityPyq('paper-img-2');
  assert.equal(res.success, true);
  assert.equal(res.code, 'DELETED');
  assert.equal(res.storageDeleted, true);
  assert.equal(res.dbDeleted, true);
  assert.deepEqual(res.deletedPaths, ['user-a/p1.png', 'user-a/p2.png']);
  assert.deepEqual(events, ['storage:user-a/p1.png,user-a/p2.png', 'db']);
  assert.equal(tableRows.community_pyqs.length, 0);
});

test('Scenario 3 (Case B): Delete succeeds cleanly with DELETED_WITH_MISSING_STORAGE when Storage object is already missing (404)', async () => {
  const row = makeSampleRow({ id: 'paper-orphan-storage' });
  const { client, tableRows } = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
    storageRemoveResult: { data: [], error: null },
  });

  const svc = createCommunityPyqService({
    supabaseClient: client,
    isCurrentUserAdmin: async () => false,
    fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch,
  });

  const res = await svc.deleteCommunityPyq('paper-orphan-storage');
  assert.equal(res.success, true);
  assert.equal(res.code, 'DELETED_WITH_MISSING_STORAGE');
  assert.equal(res.storageDeleted, false);
  assert.equal(res.dbDeleted, true);
  assert.deepEqual(res.missingPaths, ['user-a/123_uuid_physics.pdf']);
  assert.equal(tableRows.community_pyqs.length, 0);
});

test('Scenario 4 (Case C): Delete aborts BEFORE touching DB when Storage fails or file still returns HTTP 200/403/500/network error', async () => {
  const row = makeSampleRow({ id: 'paper-rls-blocked' });

  // 4A: Direct Storage 403 error
  let dbCalledA = false;
  const mockA = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
    storageRemoveResult: {
      data: null,
      error: Object.assign(new Error('new row violates row-level security policy'), { statusCode: 403 }),
    },
    onDbDelete: () => {
      dbCalledA = true;
    },
  });
  const svcA = createCommunityPyqService({
    supabaseClient: mockA.client,
    isCurrentUserAdmin: async () => true,
  });
  const resA = await svcA.deleteCommunityPyq('paper-rls-blocked');
  assert.equal(resA.success, false);
  assert.equal(resA.code, 'STORAGE_PERMISSION_ERROR');
  assert.equal(dbCalledA, false);
  assert.equal(mockA.tableRows.community_pyqs.length, 1);

  // 4B: Silent RLS block (remove returns [] and error: null, HEAD returns 200 OK!)
  let dbCalledB = false;
  const mockB = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
    storageRemoveResult: { data: [], error: null },
    onDbDelete: () => {
      dbCalledB = true;
    },
  });
  const svcB = createCommunityPyqService({
    supabaseClient: mockB.client,
    isCurrentUserAdmin: async () => true,
    fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
  });
  const resB = await svcB.deleteCommunityPyq('paper-rls-blocked');
  assert.equal(resB.success, false);
  assert.equal(resB.code, 'STORAGE_PERMISSION_ERROR');
  assert.equal(dbCalledB, false);
  assert.equal(mockB.tableRows.community_pyqs.length, 1);

  // 4C: Network error on HEAD check
  let dbCalledC = false;
  const mockC = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
    storageRemoveResult: { data: [], error: null },
    onDbDelete: () => {
      dbCalledC = true;
    },
  });
  const svcC = createCommunityPyqService({
    supabaseClient: mockC.client,
    isCurrentUserAdmin: async () => true,
    fetchImpl: (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch,
  });
  const resC = await svcC.deleteCommunityPyq('paper-rls-blocked');
  assert.equal(resC.success, false);
  assert.equal(resC.code, 'STORAGE_NETWORK_ERROR');
  assert.equal(dbCalledC, false);
});

test('Scenario 5 (Case D): Storage removed but DB delete fails -> explicit partial-state error and safe retry succeeds via Case B', async () => {
  const row = makeSampleRow({ id: 'paper-partial' });

  // Attempt 1: storage deleted, DB delete blocked
  const mock1 = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
    dbDeleteResult: { data: [], error: new Error('DB RLS denied delete') },
  });
  const svc1 = createCommunityPyqService({
    supabaseClient: mock1.client,
    isCurrentUserAdmin: async () => false,
  });

  const res1 = await svc1.deleteCommunityPyq('paper-partial');
  assert.equal(res1.success, false);
  assert.equal(res1.code, 'DB_DELETE_FAILED_AFTER_STORAGE_DELETE');
  assert.equal(res1.storageDeleted, true);
  assert.equal(res1.dbDeleted, false);
  assert.equal(mock1.tableRows.community_pyqs.length, 1);

  // Attempt 2: retry after DB permission resolved, storage returns 404 (already deleted) -> Case B cleans up DB
  const mock2 = createMockSupabase({
    currentUserId: 'user-a',
    rows: mock1.tableRows.community_pyqs,
    storageRemoveResult: { data: [], error: null },
  });
  const svc2 = createCommunityPyqService({
    supabaseClient: mock2.client,
    isCurrentUserAdmin: async () => false,
    fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch,
  });

  const res2 = await svc2.deleteCommunityPyq('paper-partial');
  assert.equal(res2.success, true);
  assert.equal(res2.code, 'DELETED_WITH_MISSING_STORAGE');
  assert.equal(res2.dbDeleted, true);
  assert.equal(mock2.tableRows.community_pyqs.length, 0);
});

test('Scenario 6 (Cases E & F & Admin): NOT_FOUND, UNAUTHORIZED non-owner, and admin cross-user delete scoping', async () => {
  const row = makeSampleRow({ id: 'paper-owned-by-a', uploader_id: 'user-a' });

  // Case E: Missing DB row
  const mockMissing = createMockSupabase({
    currentUserId: 'user-a',
    rows: [],
  });
  const svcMissing = createCommunityPyqService({
    supabaseClient: mockMissing.client,
    isCurrentUserAdmin: async () => false,
  });
  const resMissing = await svcMissing.deleteCommunityPyq('does-not-exist');
  assert.equal(resMissing.success, false);
  assert.equal(resMissing.code, 'NOT_FOUND');

  // Case F: Signed in as User B (neither uploader nor admin)
  let dbDeleteTouched = false;
  let storageTouched = false;
  const mockUnauthorized = createMockSupabase({
    currentUserId: 'user-b',
    rows: [row],
    onStorageRemove: () => {
      storageTouched = true;
    },
    onDbDelete: () => {
      dbDeleteTouched = true;
    },
  });
  const svcUnauthorized = createCommunityPyqService({
    supabaseClient: mockUnauthorized.client,
    isCurrentUserAdmin: async () => false,
  });
  const resUnauthorized = await svcUnauthorized.deleteCommunityPyq('paper-owned-by-a');
  assert.equal(resUnauthorized.success, false);
  assert.equal(resUnauthorized.code, 'UNAUTHORIZED');
  assert.equal(storageTouched, false);
  assert.equal(dbDeleteTouched, false);

  // Admin deleting User A's row: DB delete must NOT add uploader_id filter
  let adminDeleteFilters: Record<string, any> = {};
  const mockAdmin = createMockSupabase({
    currentUserId: 'admin-user',
    rows: [row],
    onDbDelete: (f) => {
      adminDeleteFilters = f;
    },
  });
  const svcAdmin = createCommunityPyqService({
    supabaseClient: mockAdmin.client,
    isCurrentUserAdmin: async () => true,
  });
  const resAdmin = await svcAdmin.deleteCommunityPyq('paper-owned-by-a');
  assert.equal(resAdmin.success, true);
  assert.equal(resAdmin.code, 'DELETED');
  assert.equal(adminDeleteFilters.uploader_id, undefined);
});

test('Scenario 7: Cross-account library visibility shows active uploads consistently while hiding removed/rejected rows', async () => {
  const activeRow = makeSampleRow({ id: 'active-by-a', uploader_id: 'user-a', status: 'active' });
  const removedRow = makeSampleRow({ id: 'removed-by-admin', uploader_id: 'user-a', status: 'removed' });
  const rejectedRow = makeSampleRow({ id: 'rejected-row', uploader_id: 'user-a', status: 'rejected' });

  // Account B viewer
  const mockB = createMockSupabase({
    currentUserId: 'user-b',
    rows: [activeRow, removedRow, rejectedRow],
  });
  const svcB = createCommunityPyqService({ supabaseClient: mockB.client });
  const feedB = await svcB.fetchCommunityPyqsWithStatus();
  assert.equal(feedB.error, null);
  assert.deepEqual(
    feedB.papers.map((p) => p.id),
    ['active-by-a']
  );

  // Anonymous viewer
  const mockAnon = createMockSupabase({
    currentUserId: null,
    rows: [activeRow, removedRow, rejectedRow],
  });
  const svcAnon = createCommunityPyqService({ supabaseClient: mockAnon.client });
  const feedAnon = await svcAnon.fetchCommunityPyqsWithStatus();
  assert.equal(feedAnon.error, null);
  assert.deepEqual(
    feedAnon.papers.map((p) => p.id),
    ['active-by-a']
  );
  assert.equal(mapCommunityRowToPaper(activeRow).submittedBy.email, '');
});

test('Scenario 8: Switching accounts clears storageService and workspaceService caches without leaking User A data to User B', () => {
  const paperA = mapCommunityRowToPaper(makeSampleRow({ id: 'cache-paper-a' }));
  storageService.savePapers([paperA]);
  workspaceService.saveProjects([
    {
      id: 'proj-a',
      title: 'Private Study Plan A',
      subject: 'Physics',
      color: 'cyan',
      description: 'User A secret project',
      status: 'active',
      paperIds: ['cache-paper-a'],
      tasks: [],
      notes: [],
      resources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  assert.equal(storageService.getPapers().length, 1);
  assert.equal(workspaceService.getProjects().length, 1);

  // Same-user check should be a no-op
  assert.equal(syncAccountCacheIsolation('user-a', 'user-a'), false);
  assert.equal(storageService.getPapers().length, 1);

  // Transition User A -> User B must purge all cached papers & workspace items
  assert.equal(syncAccountCacheIsolation('user-a', 'user-b'), true);
  assert.equal(storageService.getPapers().length, 0);
  assert.equal(storageService.getSavedPaperIds().length, 0);
  assert.equal(workspaceService.getProjects().length, 0);
});

test('Scenario 9: Supabase Storage PDF & image downloads use authentic MIME Blob URLs with cache: no-store (never opens cross-origin tab)', async () => {
  const { downloadPaperAsset } = await import('../src/services/paperDownloadService');
  const paper = mapCommunityRowToPaper(
    makeSampleRow({
      id: 'download-pdf-1',
      title: 'Physics Board 2025',
      file_name: 'Physics_Board_2025.pdf',
      file_url:
        'https://qmavgwghcolismyhfufn.supabase.co/storage/v1/object/public/community-pyqs/user-a/Physics_Board_2025.pdf',
    })
  );

  const triggered: Array<{ href: string; downloadName: string }> = [];
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const createdBlobs: Blob[] = [];

  const result = await downloadPaperAsset(paper, {
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), init });
      return new Response(new Uint8Array([37, 80, 68, 70, 45]), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });
    }) as typeof fetch,
    createObjectUrl: (b) => {
      createdBlobs.push(b);
      return 'blob:https://app.local/mock-pdf-uuid';
    },
    revokeObjectUrl: () => {},
    triggerDownload: (href, downloadName) => {
      triggered.push({ href, downloadName });
    },
  });

  assert.equal(result.kind, 'pdf');
  assert.equal(result.downloadedFileName, 'Physics_Board_2025.pdf');
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].init?.cache, 'no-store');
  assert.equal(createdBlobs.length, 1);
  assert.equal(createdBlobs[0].type, 'application/pdf');
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].href, 'blob:https://app.local/mock-pdf-uuid');
  assert.equal(triggered[0].downloadName, 'Physics_Board_2025.pdf');

  // Verify HTTP 400 missing storage object fails clearly instead of navigating
  await assert.rejects(
    () =>
      downloadPaperAsset(paper, {
        fetchImpl: (async () => new Response('{"error":"not_found"}', { status: 400 })) as typeof fetch,
      }),
    /could not be found in storage/i
  );
});

test('Scenario 10: Single image download & HEAD 405 -> GET 404 storage deletion fallback work reliably', async () => {
  const { downloadPaperAsset } = await import('../src/services/paperDownloadService');

  const imagePaper = mapCommunityRowToPaper(
    makeSampleRow({
      id: 'download-img-1',
      title: 'Testing Photo Paper',
      file_name: '1 Pages (Images)',
      file_path: 'user-a/testing.jpg',
      file_url: 'https://qmavgwghcolismyhfufn.supabase.co/storage/v1/object/public/community-pyqs/user-a/testing.jpg',
      sections: [
        {
          isImageBased: true,
          imagePaths: ['user-a/testing.jpg'],
          imageUrls: ['https://qmavgwghcolismyhfufn.supabase.co/storage/v1/object/public/community-pyqs/user-a/testing.jpg'],
        },
      ],
    })
  );

  const imgBlobs: Blob[] = [];
  const imgTriggered: Array<{ href: string; downloadName: string }> = [];

  const imgResult = await downloadPaperAsset(imagePaper, {
    fetchImpl: (async () =>
      new Response(new Uint8Array([255, 216, 255]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      })) as typeof fetch,
    createObjectUrl: (b) => {
      imgBlobs.push(b);
      return 'blob:https://app.local/mock-img-uuid';
    },
    revokeObjectUrl: () => {},
    triggerDownload: (href, downloadName) => {
      imgTriggered.push({ href, downloadName });
    },
  });

  assert.equal(imgResult.kind, 'image');
  assert.equal(imgResult.downloadedFileName, 'Testing_Photo_Paper.jpg');
  assert.equal(imgBlobs[0].type, 'image/jpeg');
  assert.equal(imgTriggered[0].downloadName, 'Testing_Photo_Paper.jpg');

  // Verify HEAD 405 -> GET Range 404 fallback deletes missing storage row cleanly
  const row = makeSampleRow({ id: 'paper-head-405' });
  const { client, tableRows } = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
    storageRemoveResult: { data: [], error: null },
  });

  const methods: string[] = [];
  const svc = createCommunityPyqService({
    supabaseClient: client,
    isCurrentUserAdmin: async () => false,
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method || 'GET');
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 405 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch,
  });

  const delRes = await svc.deleteCommunityPyq('paper-head-405');
  assert.equal(delRes.success, true);
  assert.equal(delRes.code, 'DELETED_WITH_MISSING_STORAGE');
  assert.deepEqual(methods, ['HEAD', 'GET']);
  assert.equal(tableRows.community_pyqs.length, 0);
});

test('Scenario 11: Private-bucket download() & 300s createSignedUrl() fallback preserve GIF/SVG MIME types and reject HTML/JSON/empty payloads', async () => {
  const { downloadPaperAsset, downloadManagedFile } = await import('../src/services/paperDownloadService');

  // 11A: Private storage .download() primary path returns authentic PDF Blob URL
  const pdfPaper = mapCommunityRowToPaper(
    makeSampleRow({
      id: 'private-pdf-1',
      title: 'Private Calculus Exam',
      file_name: 'calculus_2026.pdf',
      file_path: 'user-a/calculus_2026.pdf',
    })
  );

  let signedFallbackCalled = false;
  const pdfBlobs: Blob[] = [];
  const res1 = await downloadPaperAsset(pdfPaper, {
    storageClient: {
      from: () => ({
        download: async () => ({
          data: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], {
            type: 'application/octet-stream',
          }),
          error: null,
        }),
        createSignedUrl: async () => {
          signedFallbackCalled = true;
          return { data: { signedUrl: 'https://signed.local/unused' }, error: null };
        },
      }),
    },
    createObjectUrl: (b) => {
      pdfBlobs.push(b);
      return 'blob:https://app.local/private-pdf';
    },
    revokeObjectUrl: () => {},
    triggerDownload: () => {},
  });

  assert.equal(signedFallbackCalled, false);
  assert.equal(res1.kind, 'pdf');
  assert.equal(pdfBlobs[0].type, 'application/pdf');

  // 11B: When .download() returns error, 300s createSignedUrl fallback serves SVG with image/svg+xml
  const svgPaper = mapCommunityRowToPaper(
    makeSampleRow({
      id: 'private-svg-1',
      title: 'Optics Ray Diagram',
      file_name: 'optics.svg',
      file_path: 'user-a/optics.svg',
      file_url: 'https://qmavgwghcolismyhfufn.supabase.co/storage/v1/object/public/community-pyqs/user-a/optics.svg',
      sections: [
        {
          isImageBased: true,
          imagePaths: ['user-a/optics.svg'],
          imageUrls: [],
        },
      ],
    })
  );

  let ttlUsed = 0;
  const svgBlobs: Blob[] = [];
  const resSvg = await downloadPaperAsset(svgPaper, {
    storageClient: {
      from: () => ({
        download: async () => ({ data: null, error: { message: 'stream fallback', statusCode: 500 } }),
        createSignedUrl: async (_path: string, expiresIn: number) => {
          ttlUsed = expiresIn;
          return { data: { signedUrl: 'https://signed.local/optics.svg?token=abc' }, error: null };
        },
      }),
    },
    fetchImpl: (async () =>
      new Response('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      })) as typeof fetch,
    createObjectUrl: (b) => {
      svgBlobs.push(b);
      return 'blob:https://app.local/private-svg';
    },
    revokeObjectUrl: () => {},
    triggerDownload: () => {},
  });

  assert.equal(ttlUsed, 300);
  assert.equal(resSvg.kind, 'image');
  assert.equal(resSvg.downloadedFileName, 'optics.svg');
  assert.equal(svgBlobs[0].type, 'image/svg+xml');

  // 11C: GIF image download preserves image/gif
  const gifBlobs: Blob[] = [];
  const savedGifName = await downloadManagedFile('user-a/anim.gif', 'Reaction Diagram', 'community-pyqs', {
    storageClient: {
      from: () => ({
        download: async () => ({
          data: new Blob([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], {
            type: 'application/octet-stream',
          }),
          error: null,
        }),
        createSignedUrl: async () => ({ data: null, error: null }),
      }),
    },
    createObjectUrl: (b) => {
      gifBlobs.push(b);
      return 'blob:https://app.local/gif';
    },
    revokeObjectUrl: () => {},
    triggerDownload: () => {},
  });
  assert.equal(savedGifName, 'Reaction_Diagram.gif');
  assert.equal(gifBlobs[0].type, 'image/gif');

  // 11D: Reject HTML / JSON / empty payloads returned with HTTP 200
  await assert.rejects(
    () =>
      downloadPaperAsset(pdfPaper, {
        storageClient: {
          from: () => ({
            download: async () => ({
              data: new Blob(['<!DOCTYPE html><html><body>Error</body></html>'], {
                type: 'application/octet-stream',
              }),
              error: null,
            }),
            createSignedUrl: async () => ({ data: null, error: null }),
          }),
        },
      }),
    /invalid response/i
  );

  await assert.rejects(
    () =>
      downloadPaperAsset(pdfPaper, {
        storageClient: {
          from: () => ({
            download: async () => ({
              data: new Blob(['{"error":"forbidden"}'], { type: 'application/json' }),
              error: null,
            }),
            createSignedUrl: async () => ({ data: null, error: null }),
          }),
        },
      }),
    /error payload/i
  );
});

test('Scenario 12: Multi-image partial Storage deletion returns STORAGE_PARTIAL_DELETE, preserves DB row, and retry succeeds', async () => {
  const row = makeSampleRow({
    id: 'paper-partial-multi',
    file_name: '2 Pages (Images)',
    file_path: 'user-a/page1.jpg',
    file_url: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/page1.jpg',
    sections: [
      {
        isImageBased: true,
        imagePaths: ['user-a/page1.jpg', 'user-a/page2.jpg'],
        imageUrls: [
          'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/page1.jpg',
          'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/page2.jpg',
        ],
      },
    ],
  });

  // Attempt 1: remove() deletes only page1.jpg; page2.jpg still exists via private .exists() probe -> STORAGE_PARTIAL_DELETE
  const mock1 = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
  });
  const baseStorageFrom1 = mock1.client.storage.from;
  mock1.client.storage.from = (bucket: string) => ({
    ...baseStorageFrom1(bucket),
    remove: async () => ({ data: [{ name: 'user-a/page1.jpg' }], error: null }),
    exists: async (p: string) => ({ data: p === 'user-a/page2.jpg', error: null }),
  });

  const svc1 = createCommunityPyqService({
    supabaseClient: mock1.client,
    isCurrentUserAdmin: async () => false,
  });

  const partialRes = await svc1.deleteCommunityPyq('paper-partial-multi');
  assert.equal(partialRes.success, false);
  assert.equal(partialRes.code, 'STORAGE_PARTIAL_DELETE');
  assert.equal(partialRes.storagePartiallyDeleted, true);
  assert.equal(partialRes.dbDeleted, false);
  assert.deepEqual(partialRes.deletedPaths, ['user-a/page1.jpg']);
  assert.equal(partialRes.failedPaths?.length, 1);
  assert.equal(partialRes.failedPaths?.[0].path, 'user-a/page2.jpg');
  // Database row MUST still exist after partial storage failure
  assert.equal(mock1.tableRows.community_pyqs.length, 1);

  // Attempt 2: Retry removes remaining page2.jpg while page1.jpg already absent (.exists() = false) -> DB deleted
  const mock2 = createMockSupabase({
    currentUserId: 'user-a',
    rows: mock1.tableRows.community_pyqs,
  });
  const baseStorageFrom2 = mock2.client.storage.from;
  mock2.client.storage.from = (bucket: string) => ({
    ...baseStorageFrom2(bucket),
    remove: async () => ({ data: [{ name: 'user-a/page2.jpg' }], error: null }),
    exists: async () => ({ data: false, error: null }),
  });

  const svc2 = createCommunityPyqService({
    supabaseClient: mock2.client,
    isCurrentUserAdmin: async () => false,
  });

  const retryRes = await svc2.deleteCommunityPyq('paper-partial-multi');
  assert.equal(retryRes.success, true);
  assert.equal(retryRes.code, 'DELETED_WITH_MISSING_STORAGE');
  assert.equal(retryRes.dbDeleted, true);
  assert.deepEqual(retryRes.deletedPaths, ['user-a/page2.jpg']);
  assert.deepEqual(retryRes.missingPaths, ['user-a/page1.jpg']);
  assert.equal(mock2.tableRows.community_pyqs.length, 0);
});

test('Scenario 13: Reversible Admin remove -> safe removal notice -> restore preserves sections & metadata without leaking private fields', async () => {
  const originalSections = [{ isImageBased: true, imagePaths: ['user-a/p1.png'], imageUrls: [] }];
  const row = makeSampleRow({
    id: 'paper-reversible-1',
    status: 'active',
    sections: originalSections,
  });

  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const { client, tableRows } = createMockSupabase({
    currentUserId: 'admin-1',
    rows: [row],
  });

  client.rpc = async (fn: string, args: Record<string, unknown> = {}) => {
    rpcCalls.push({ fn, args });
    if (fn === 'admin_remove_paper') {
      const target = tableRows.community_pyqs.find((r) => r.id === args.p_paper_id);
      if (target) {
        target.previous_status = target.status;
        target.status = 'removed';
        target.moderation_notes = String(args.p_reason || '');
      }
      return {
        data: { success: true, paper_id: args.p_paper_id, previous_status: 'active', status: 'removed' },
        error: null,
      };
    }
    if (fn === 'get_paper_removal_notice') {
      const target = tableRows.community_pyqs.find((r) => r.id === args.p_paper_id && r.status === 'removed');
      if (!target) return { data: [], error: null };
      // Public notice RPC deliberately omits file_path, file_url, uploader_id, and sections
      return {
        data: [
          {
            id: target.id,
            title: target.title,
            subject: target.subject,
            exam_board: target.exam_board,
            grade: target.grade,
            year: target.year,
            removal_reason: target.moderation_notes,
            removed_at: target.updated_at,
            removed_by: 'Studify Administrator',
          },
        ],
        error: null,
      };
    }
    if (fn === 'admin_restore_paper') {
      const target = tableRows.community_pyqs.find((r) => r.id === args.p_paper_id);
      if (target) {
        target.status = target.previous_status || 'active';
        target.moderation_notes = null;
      }
      return { data: target, error: null };
    }
    return { data: null, error: null };
  };

  const svc = createCommunityPyqService({
    supabaseClient: client,
    isCurrentUserAdmin: async () => true,
  });

  // Step 1: Reversible removal keeps DB row & sections untouched
  const removeRes = await svc.removeCommunityPyqByAdmin('paper-reversible-1', 'Copyright claim verified');
  assert.equal(removeRes.success, true);
  assert.equal(tableRows.community_pyqs[0].status, 'removed');
  assert.deepEqual(tableRows.community_pyqs[0].sections, originalSections);

  // Step 2: Public notice exposes official reason without leaking file paths or uploader ID
  const notice = await svc.getPaperRemovalNotice('paper-reversible-1');
  assert.ok(notice);
  assert.equal(notice.removalReason, 'Copyright claim verified');
  assert.equal(notice.removedBy, 'Studify Administrator');
  assert.equal((notice as any).filePath, undefined);
  assert.equal((notice as any).uploaderId, undefined);

  // Step 3: Restore returns existing paper record to previous published state
  const restoreRes = await svc.restoreCommunityPyqByAdmin('paper-reversible-1', 'Resolved with permission');
  assert.equal(restoreRes.error, null);
  assert.ok(restoreRes.paper);
  assert.equal(restoreRes.paper.id, 'paper-reversible-1');
  assert.equal(restoreRes.paper.status, 'approved');
  assert.deepEqual(restoreRes.paper.imagePaths, ['user-a/p1.png']);
  assert.deepEqual(
    rpcCalls.map((c) => c.fn),
    ['admin_remove_paper', 'get_paper_removal_notice', 'admin_restore_paper']
  );
});

test('Scenario 14: Guest quota verification requires server-signed token and rejects forged or malformed tokens', async () => {
  const { downloadQuotaService } = await import('../src/services/downloadQuotaService');

  const validToken = 'vis_0123456789abcdef0123456789abcdef.' + 'a'.repeat(64);
  const rpcClient = {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      if (fn === 'issue_guest_quota_token') {
        return { data: validToken, error: null };
      }
      if (fn === 'get_guest_download_quota') {
        if (args.p_token !== validToken) {
          return { data: null, error: { message: 'Invalid guest token signature.', code: '42501' } };
        }
        return {
          data: {
            identifier: 'anon:vis_0123456789abcdef0123456789abcdef',
            user_id: null,
            visitor_id: 'vis_0123456789abcdef0123456789abcdef',
            downloads_used: 3,
            downloads_allowed: 10,
            uploads_completed: 0,
            current_cycle_uploads: 0,
            upload_hashes: [],
            download_history: [],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };

  const issued = await downloadQuotaService.ensureSignedGuestToken(rpcClient);
  assert.equal(issued.mode, 'rpc');
  assert.equal(issued.token, validToken);

  const validCheck = await downloadQuotaService.verifyAndGetGuestQuota(validToken, rpcClient);
  assert.equal(validCheck.ok, true);
  assert.equal(validCheck.quota?.remainingDownloads, 7);

  // Forged signature must fail cleanly
  const forgedCheck = await downloadQuotaService.verifyAndGetGuestQuota(
    'vis_0123456789abcdef0123456789abcdef.' + 'f'.repeat(64),
    rpcClient
  );
  assert.equal(forgedCheck.ok, false);
  assert.match(forgedCheck.error || '', /invalid/i);

  // Raw unsigned visitor_id must fail format check immediately
  const rawCheck = await downloadQuotaService.verifyAndGetGuestQuota('vid_client_spoofed', rpcClient);
  assert.equal(rawCheck.ok, false);
  assert.match(rawCheck.error || '', /invalid/i);
});

test('Scenario 15: Private-bucket .exists() 404 verification treats missing storage object as DELETED_WITH_MISSING_STORAGE without unauthenticated public probes', async () => {
  const row = makeSampleRow({
    id: 'paper-priv-404',
    uploader_id: 'user-a',
    file_path: 'user-a/missing_private.pdf',
    file_url: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/missing_private.pdf',
  });
  const { client, tableRows } = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row],
  });

  let publicUrlCalled = false;
  let fetchCalled = false;
  const existsCalledPaths: string[] = [];

  client.storage = {
    from: () => ({
      remove: async () => ({ data: [], error: null }),
      exists: async (targetPath: string) => {
        existsCalledPaths.push(targetPath);
        return { data: false, error: { statusCode: 404, message: 'Object not found' } };
      },
      getPublicUrl: () => {
        publicUrlCalled = true;
        return { data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/never' } };
      },
    }),
  };

  const svc = createCommunityPyqService({
    supabaseClient: client,
    isCurrentUserAdmin: async () => false,
    fetchImpl: (async () => {
      fetchCalled = true;
      return { ok: false, status: 400 } as unknown as Response;
    }) as typeof fetch,
  });

  const res = await svc.deleteCommunityPyq('paper-priv-404');
  assert.equal(res.success, true);
  assert.equal(res.code, 'DELETED_WITH_MISSING_STORAGE');
  assert.deepEqual(existsCalledPaths, ['user-a/missing_private.pdf']);
  assert.equal(publicUrlCalled, false);
  assert.equal(fetchCalled, false);
  assert.equal(tableRows.community_pyqs.length, 0);
});

test('Scenario 16: Private-bucket 403 or 400+live .info() verification aborts with STORAGE_PERMISSION_ERROR and preserves DB row', async () => {
  // 16A: .exists() returns 403 Permission Denied
  const row403 = makeSampleRow({
    id: 'paper-priv-403',
    uploader_id: 'user-a',
    file_path: 'user-a/protected.pdf',
  });
  const mock403 = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row403],
  });
  let publicUrlCalled = false;
  mock403.client.storage = {
    from: () => ({
      remove: async () => ({ data: [], error: null }),
      exists: async () => ({ data: false, error: { statusCode: 403, message: 'new row violates policy' } }),
      getPublicUrl: () => {
        publicUrlCalled = true;
        return { data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/never' } };
      },
    }),
  };

  const svc403 = createCommunityPyqService({
    supabaseClient: mock403.client,
    isCurrentUserAdmin: async () => false,
  });

  const res403 = await svc403.deleteCommunityPyq('paper-priv-403');
  assert.equal(res403.success, false);
  assert.equal(res403.code, 'STORAGE_PERMISSION_ERROR');
  assert.equal(publicUrlCalled, false);
  assert.equal(mock403.tableRows.community_pyqs.length, 1);

  // 16B: .exists() returns empty HTTP 400, .info() confirms live object -> must abort
  const row400Live = makeSampleRow({
    id: 'paper-priv-400-live',
    uploader_id: 'user-a',
    file_path: 'user-a/live_protected.pdf',
  });
  const mock400 = createMockSupabase({
    currentUserId: 'user-a',
    rows: [row400Live],
  });
  mock400.client.storage = {
    from: () => ({
      remove: async () => ({ data: [], error: null }),
      exists: async () => ({ data: false, error: { statusCode: 400, message: '' } }),
      info: async () => ({ data: { id: 'obj-live-1', name: 'user-a/live_protected.pdf' }, error: null }),
      getPublicUrl: () => {
        publicUrlCalled = true;
        return { data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/never' } };
      },
    }),
  };

  const svc400 = createCommunityPyqService({
    supabaseClient: mock400.client,
    isCurrentUserAdmin: async () => false,
  });

  const res400 = await svc400.deleteCommunityPyq('paper-priv-400-live');
  assert.equal(res400.success, false);
  assert.equal(res400.code, 'STORAGE_PERMISSION_ERROR');
  assert.equal(publicUrlCalled, false);
  assert.equal(mock400.tableRows.community_pyqs.length, 1);
});

test('Scenario 17: delete_community_pyq_permanently returning deleted:false or non-missing RPC error must NOT fall back silently', async () => {
  const rowFail = makeSampleRow({
    id: 'paper-rpc-fail',
    uploader_id: 'user-a',
    file_path: 'user-a/rpc_fail.pdf',
  });
  const mockFail = createMockSupabase({
    currentUserId: 'user-a',
    rows: [rowFail],
  });
  let directDbDeleteCalled = false;
  mockFail.client.rpc = async () => ({
    data: { deleted: false, error: 'Blocked by rating trigger' },
    error: null,
  });
  const origFrom = mockFail.client.from.bind(mockFail.client);
  mockFail.client.from = (table: string) => {
    const chain = origFrom(table);
    const origDelete = chain.delete;
    chain.delete = () => {
      if (table === 'community_pyqs') directDbDeleteCalled = true;
      return origDelete();
    };
    return chain;
  };

  const svcFail = createCommunityPyqService({
    supabaseClient: mockFail.client,
    isCurrentUserAdmin: async () => false,
  });
  const failRes = await svcFail.deleteCommunityPyq('paper-rpc-fail');
  assert.equal(failRes.success, false);
  assert.equal(failRes.code, 'DB_DELETE_FAILED_AFTER_STORAGE_DELETE');
  assert.match(String(failRes.error || ''), /Blocked by rating trigger/);
  assert.equal(directDbDeleteCalled, false);
  assert.equal(mockFail.tableRows.community_pyqs.length, 1);

  // RPC returning deleted:false with "not found" maps to NOT_FOUND
  const rowNotFound = makeSampleRow({
    id: 'paper-rpc-not-found',
    uploader_id: 'user-a',
    file_path: 'user-a/rpc_missing.pdf',
  });
  const mockNotFound = createMockSupabase({
    currentUserId: 'user-a',
    rows: [rowNotFound],
  });
  mockNotFound.client.rpc = async () => ({
    data: { deleted: false, error: 'Paper not found' },
    error: null,
  });
  const svcNotFound = createCommunityPyqService({
    supabaseClient: mockNotFound.client,
    isCurrentUserAdmin: async () => false,
  });
  const nfRes = await svcNotFound.deleteCommunityPyq('paper-rpc-not-found');
  assert.equal(nfRes.success, false);
  assert.equal(nfRes.code, 'NOT_FOUND');

  // RPC throwing non-missing error returns DB_DELETE_FAILED_AFTER_STORAGE_DELETE without fallback
  const rowThrown = makeSampleRow({
    id: 'paper-rpc-thrown',
    uploader_id: 'user-a',
    file_path: 'user-a/rpc_thrown.pdf',
  });
  const mockThrown = createMockSupabase({
    currentUserId: 'user-a',
    rows: [rowThrown],
  });
  let thrownFallbackCalled = false;
  mockThrown.client.rpc = async () => {
    const err: any = new Error('permission denied for delete_community_pyq_permanently');
    err.code = '42501';
    throw err;
  };
  const origThrownFrom = mockThrown.client.from.bind(mockThrown.client);
  mockThrown.client.from = (table: string) => {
    const chain = origThrownFrom(table);
    const origDelete = chain.delete;
    chain.delete = () => {
      if (table === 'community_pyqs') thrownFallbackCalled = true;
      return origDelete();
    };
    return chain;
  };
  const svcThrown = createCommunityPyqService({
    supabaseClient: mockThrown.client,
    isCurrentUserAdmin: async () => false,
  });
  const thrownRes = await svcThrown.deleteCommunityPyq('paper-rpc-thrown');
  assert.equal(thrownRes.success, false);
  assert.equal(thrownRes.code, 'DB_DELETE_FAILED_AFTER_STORAGE_DELETE');
  assert.equal(thrownFallbackCalled, false);
});

test('Scenario 18: Legacy section paths, cross-bucket app-files objects, and malformed URI encoding are handled safely', async () => {
  // Safe malformed URI fallback without throwing URIError
  const malformedParsed = parseStorageBucketAndPath(
    'https://example.supabase.co/storage/v1/object/sign/community-pyqs/user-a/%E0%A4%A_broken.pdf?token=abc'
  );
  assert.deepEqual(malformedParsed, {
    bucket: 'community-pyqs',
    path: 'user-a/%E0%A4%A_broken.pdf',
    isSupabaseStorage: true,
  });

  // Valid encoded URL decodes cleanly
  const encodedParsed = parseStorageBucketAndPath(
    'https://example.supabase.co/storage/v1/object/authenticated/app-files/user-a/papers/my%20file.pdf'
  );
  assert.deepEqual(encodedParsed, {
    bucket: 'app-files',
    path: 'user-a/papers/my file.pdf',
    isSupabaseStorage: true,
  });

  // Delete extracts sec.filePath, sec.path, and cross-bucket app-files targets
  const legacyRow = makeSampleRow({
    id: 'paper-legacy-sections',
    uploader_id: 'user-a',
    file_path: 'user-a/main.pdf',
    file_url: 'https://example.supabase.co/storage/v1/object/public/community-pyqs/user-a/main.pdf',
    sections: [
      { title: 'Legacy Sec 1', filePath: 'user-a/sec_legacy.pdf' },
      { title: 'Legacy Sec 2', path: 'app-files/user-a/papers/app_attachment.pdf' },
    ],
  });
  const { client } = createMockSupabase({
    currentUserId: 'user-a',
    rows: [legacyRow],
  });

  const removedByBucket: Record<string, string[]> = {};
  client.storage = {
    from: (bucket: string) => ({
      remove: async (paths: string[]) => {
        removedByBucket[bucket] = [...(removedByBucket[bucket] || []), ...paths];
        return { data: paths.map((name) => ({ name })), error: null };
      },
      getPublicUrl: (p: string) => ({
        data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${p}` },
      }),
    }),
  };

  const svc = createCommunityPyqService({
    supabaseClient: client,
    isCurrentUserAdmin: async () => false,
  });
  const res = await svc.deleteCommunityPyq('paper-legacy-sections');
  assert.equal(res.success, true);
  assert.deepEqual(removedByBucket['community-pyqs']?.sort(), ['user-a/main.pdf', 'user-a/sec_legacy.pdf'].sort());
  assert.deepEqual(removedByBucket['app-files'], ['user-a/papers/app_attachment.pdf']);
});

test('Scenario 19: Consolidated SQL migration enforces SECURITY DEFINER hardening, trigger deduplication, and deletion permissions', () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationPath = path.resolve(
    thisDir,
    '../supabase/migrations/20261119_consolidated_pyq_security_triggers_and_deletion.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const executableSql = sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  // Must never use unsafe current_user IN/NOT IN ('postgres', 'supabase_admin') inside executable SQL
  assert.equal(/\bcurrent_user\b/i.test(executableSql), false, 'Migration must not execute current_user checks');

  // Must drop the conflicting legacy guard trigger
  assert.match(executableSql, /DROP TRIGGER IF EXISTS trg_studify_guard_community_pyq_fields ON public\.community_pyqs;/);

  // Must enforce transaction-bound internal mutation tokens
  assert.match(executableSql, /app_private\.begin_internal_pyq_mutation/);
  assert.match(executableSql, /app_private\.verify_internal_pyq_mutation/);

  // Must grant authenticated DELETE on community_pyqs and handle storage owner/admin policies
  assert.match(executableSql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.community_pyqs TO authenticated;/);
  assert.match(executableSql, /owner_id = \(SELECT auth\.uid\(\)::text\)/);
  assert.match(executableSql, /owner = \(SELECT auth\.uid\(\)\)/);
  assert.match(executableSql, /public\.is_admin\(\(SELECT auth\.uid\(\)\)\)/);
});

test('Scenario 20: Workspace guest/user persistence, Quick Capture project gate, DB error surfacing, and guest migration', async () => {
  const createdProjectsInDb: any[] = [];
  const createdCapturesInDb: any[] = [];
  const createdNotesInDb: any[] = [];
  let shouldFailProjectWrite = false;
  let shouldFailCaptureWrite = false;
  let shouldFailNoteWrite = false;

  const mockDb: any = {
    loadProjectsWithStatus: async () => ({ projects: [...createdProjectsInDb], synced: true }),
    loadQuickCapturesWithStatus: async () => ({ captures: [...createdCapturesInDb], synced: true }),
    createProjectWithStatus: async (project: any) => {
      if (shouldFailProjectWrite) {
        return { project: null, error: new Error('column "exam_board" does not exist') };
      }
      createdProjectsInDb.push(project);
      return { project, error: null };
    },
    updateProjectWithStatus: async () => ({ success: true, error: null }),
    updateProject: async () => true,
    deleteProject: async () => true,
    createQuickCaptureWithStatus: async (item: any) => {
      if (shouldFailCaptureWrite) {
        return { item: null, error: new Error('column "content" of relation "quick_captures" does not exist') };
      }
      createdCapturesInDb.push(item);
      return { item, error: null };
    },
    updateQuickCapture: async () => true,
    deleteQuickCapture: async () => true,
    createNoteWithStatus: async (note: any) => {
      if (shouldFailNoteWrite) {
        return { success: false, error: new Error('notes RLS insert blocked') };
      }
      createdNotesInDb.push(note);
      return { success: true, error: null };
    },
    deleteNote: async () => true,
  };

  const ws = createWorkspaceService(mockDb);

  // 20A: Guest mode persists projects, notes, and Quick Captures locally, isolated from user cache
  ws.setStorageScope('guest');
  const blockedGuestCapture = await ws.addQuickCaptureAsync({
    content: 'Blocked before project exists',
    type: 'thought',
  });
  assert.equal(blockedGuestCapture.item, null);
  assert.match(String(blockedGuestCapture.error?.message || ''), /Create a Study Project first/i);

  const guestProjRes = await ws.createProjectAsync({
    title: 'Guest Physics Revision',
    subject: 'Physics',
    color: 'cyan',
  });
  assert.equal(guestProjRes.error, null);
  assert.ok(guestProjRes.project);
  assert.equal(ws.getProjects().length, 1);

  const guestNoteRes = await ws.saveNoteAsync(guestProjRes.project.id, {
    title: 'Gauss Law Summary',
    content: 'Flux = q / epsilon_0',
    tags: ['Electrostatics'],
  });
  assert.equal(guestNoteRes.error, null);
  assert.equal(ws.getProjects()[0].notes.length, 1);

  const guestCapRes = await ws.addQuickCaptureAsync({
    title: 'Key Formula',
    content: 'E = -dV/dr',
    type: 'formula',
    projectId: guestProjRes.project.id,
  });
  assert.equal(guestCapRes.error, null);
  assert.equal(guestCapRes.item?.projectId, guestProjRes.project.id);
  assert.equal(createdProjectsInDb.length, 0);

  // 20B: Account switch clears user cache while preserving guest items until migrated on sign-in
  ws.setStorageScope('user');
  ws.saveProjects([
    {
      id: 'user-a-proj',
      title: 'User A Private Project',
      color: 'cyan',
      paperIds: [],
      tasks: [],
      notes: [],
      resources: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  syncAccountCacheIsolation('user-a', null);
  assert.equal(workspaceService.getStorageScope(), 'guest');

  // Guest items migrate to Supabase on sign-in and guest keys are cleared afterwards
  ws.setStorageScope('user');
  const migrated = await ws.syncGuestItemsToSupabaseIfAny();
  assert.equal(migrated.migratedProjects, 1);
  assert.equal(migrated.migratedCaptures, 1);
  assert.equal(createdProjectsInDb.length, 1);
  assert.equal(createdNotesInDb.length, 1);
  assert.equal(createdCapturesInDb.length, 1);
  assert.equal(mockStore.has('studify_guest_projects_v1'), false);
  assert.equal(mockStore.has('studify_guest_captures_v1'), false);

  // 20C: Signed-in mode propagates real Supabase DB errors without faking saved items
  shouldFailProjectWrite = true;
  const failedProj = await ws.createProjectAsync({ title: 'Should Fail DB', color: 'cyan' });
  assert.equal(failedProj.project, null);
  assert.match(String(failedProj.error?.message || ''), /exam_board/);
  assert.equal(ws.getProjects().some((p) => p.title === 'Should Fail DB'), false);
  shouldFailProjectWrite = false;

  const userProjRes = await ws.createProjectAsync({ title: 'Verified DB Project', color: 'cyan' });
  assert.equal(userProjRes.error, null);
  assert.ok(userProjRes.project);

  shouldFailCaptureWrite = true;
  const failedCap = await ws.addQuickCaptureAsync({
    content: 'Should not silently pretend saved',
    type: 'doubt',
    projectId: userProjRes.project.id,
  });
  assert.equal(failedCap.item, null);
  assert.match(String(failedCap.error?.message || ''), /quick_captures/);
  shouldFailCaptureWrite = false;

  shouldFailNoteWrite = true;
  const failedNote = await ws.saveNoteAsync(userProjRes.project.id, {
    title: 'Should Fail Note',
    content: 'Body',
    tags: [],
  });
  assert.equal(failedNote.note, null);
  assert.match(String(failedNote.error?.message || ''), /notes RLS/i);
});

test('Scenario 21: Play Store app rating breakdown, public guest RPC persistence, and DB error propagation', async () => {
  // 21A: Pure breakdown & average calculation across ratings with and without comments
  const breakdownSummary = computeFeedbackBreakdown(
    [
      {
        id: '1',
        visitorId: 'v-1',
        authorName: 'Aarav',
        rating: 5,
        comment: 'Super fast PYQ search!',
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      },
      {
        id: '2',
        visitorId: 'v-2',
        authorName: 'Student',
        rating: 4,
        comment: '',
        createdAt: '2026-11-20T11:00:00Z',
        updatedAt: '2026-11-20T11:00:00Z',
      },
      {
        id: '3',
        visitorId: 'v-3',
        authorName: 'Meera',
        rating: 5,
        comment: 'Love the clean study workspace.',
        createdAt: '2026-11-20T12:00:00Z',
        updatedAt: '2026-11-20T12:00:00Z',
      },
    ],
    'v-1'
  );
  assert.equal(breakdownSummary.totalRatings, 3);
  assert.equal(breakdownSummary.totalReviews, 2);
  assert.equal(breakdownSummary.averageRating, 4.7);
  assert.deepEqual(breakdownSummary.ratingBreakdown, { 5: 2, 4: 1, 3: 0, 2: 0, 1: 0 });
  assert.equal(breakdownSummary.userRating, 5);
  assert.equal(breakdownSummary.userAuthorName, 'Aarav');
  assert.equal(breakdownSummary.items.length, 2);

  // 21B: RPC write + read stores public visitor rating/comment and never drops existing data
  const storedRows: any[] = [];
  let forceRpcWriteError = false;
  const mockSupabaseClient: any = {
    rpc: async (fnName: string, args: any) => {
      if (fnName === 'submit_app_feedback') {
        if (forceRpcWriteError) {
          return { data: null, error: { code: '42501', message: 'permission denied for table app_feedback' } };
        }
        const existingIdx = storedRows.findIndex((r) => r.visitor_id === args.p_visitor_id);
        const now = new Date().toISOString();
        if (existingIdx !== -1) {
          const prev = storedRows[existingIdx];
          storedRows[existingIdx] = {
            ...prev,
            rating: args.p_rating ?? prev.rating,
            comment: args.p_comment ?? prev.comment,
            author_name: args.p_author_name || prev.author_name || 'Student',
            updated_at: now,
          };
          return { data: { success: true, item: storedRows[existingIdx] }, error: null };
        }
        const inserted = {
          id: `fb_${storedRows.length + 1}`,
          visitor_id: args.p_visitor_id,
          author_name: args.p_author_name || 'Student',
          rating: args.p_rating ?? 5,
          comment: args.p_comment ?? '',
          created_at: now,
          updated_at: now,
        };
        storedRows.push(inserted);
        return { data: { success: true, item: inserted }, error: null };
      }

      if (fnName === 'get_app_feedback_summary') {
        const totalRatings = storedRows.length;
        const written = storedRows.filter((r) => r.comment && r.comment.trim().length > 0);
        const avg =
          totalRatings > 0
            ? Number((storedRows.reduce((s, r) => s + r.rating, 0) / totalRatings).toFixed(1))
            : null;
        return {
          data: {
            average_rating: avg,
            total_ratings: totalRatings,
            total_reviews: written.length,
            rating_breakdown: {
              '5': storedRows.filter((r) => r.rating === 5).length,
              '4': storedRows.filter((r) => r.rating === 4).length,
              '3': storedRows.filter((r) => r.rating === 3).length,
              '2': storedRows.filter((r) => r.rating === 2).length,
              '1': storedRows.filter((r) => r.rating === 1).length,
            },
            user_feedback: storedRows.find((r) => r.visitor_id === args.p_visitor_id) || null,
            items: written,
          },
          error: null,
        };
      }
      return { data: null, error: { code: '42883', message: 'function does not exist' } };
    },
  };

  const fbSvc = createAppFeedbackService(mockSupabaseClient);
  const save1 = await fbSvc.submitFeedback({
    visitorId: 'guest-browser-1',
    rating: 5,
    comment: '<Great> offline & workspace flow!',
    authorName: 'Riya',
  });
  assert.equal(save1.success, true);
  assert.equal(save1.error, null);
  assert.equal(save1.feedback?.comment, 'Great offline & workspace flow!');
  assert.equal(save1.feedback?.authorName, 'Riya');

  const summary = await fbSvc.getFeedbackSummary('guest-browser-1');
  assert.equal(summary.averageRating, 5);
  assert.equal(summary.totalRatings, 1);
  assert.equal(summary.totalReviews, 1);
  assert.equal(summary.items[0]?.authorName, 'Riya');

  // Must surface failure instead of returning { success: true }
  forceRpcWriteError = true;
  const failedSave = await fbSvc.submitFeedback({
    visitorId: 'guest-browser-2',
    rating: 4,
    comment: 'Should fail cleanly',
  });
  assert.equal(failedSave.success, false);
  assert.equal(failedSave.feedback, null);
  assert.match(String(failedSave.error?.message || ''), /permission denied/i);
});

test('Scenario 22: Workspace & App Feedback SQL migration aligns schema and hardens public RPCs', () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationPath = path.resolve(
    thisDir,
    '../supabase/migrations/20261121_workspace_schema_and_app_feedback.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const executableSql = sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  assert.equal(/\bcurrent_user\b/i.test(executableSql), false, 'Migration must not use unsafe current_user checks');
  assert.match(executableSql, /ALTER TABLE public\.study_projects ALTER COLUMN subject DROP NOT NULL;/);
  assert.match(executableSql, /ALTER TABLE public\.quick_captures ADD COLUMN IF NOT EXISTS project_id text;/);
  assert.match(executableSql, /CREATE OR REPLACE FUNCTION public\.submit_app_feedback/);
  assert.match(executableSql, /CREATE OR REPLACE FUNCTION public\.get_app_feedback_summary/);
  assert.match(executableSql, /SET search_path = ''/);
  assert.match(executableSql, /GRANT EXECUTE ON FUNCTION public\.submit_app_feedback\(text, integer, text, text\) TO anon, authenticated, service_role;/);
  assert.match(executableSql, /GRANT EXECUTE ON FUNCTION public\.get_app_feedback_summary\(text, integer\) TO anon, authenticated, service_role;/);
});
