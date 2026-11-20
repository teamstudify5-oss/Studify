// ============================================================================
// SUPABASE EDGE FUNCTION: studify-factory-reset
// Owner-only, one-time clean-slate factory reset for Studify test data.
//
// Security guarantees:
//   - Requires a valid Supabase Auth JWT in Authorization: Bearer <token>.
//   - Verifies the 'owner' role strictly on the server via user_roles table
//     or server-controlled app_metadata (never trusts client flags or email).
//   - Uses SUPABASE_SERVICE_ROLE_KEY strictly inside the Edge Function runtime.
//   - Requires exact confirmationPhrase: "RESET STUDIFY TEST DATA" to execute.
//   - Uses Supabase Storage API recursive paginated listing + batched .remove()
//     (max 1000 paths per batch) — NEVER runs SQL DELETE on storage.objects.
//   - Preserves auth.users, public.user_roles, schemas, tables, functions,
//     RLS policies, and storage bucket configurations.
// ============================================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CONFIRMATION_PHRASE = 'RESET STUDIFY TEST DATA';
const TARGET_BUCKETS = ['community-pyqs', 'app-files'] as const;
const MAX_REMOVE_BATCH = 1000;

interface TableResetSpec {
  table: string;
  pkColumn: string;
  category: 'content' | 'moderation';
}

// Foreign-key-safe deletion order (children/references first, parents last)
const RESET_TABLES: TableResetSpec[] = [
  { table: 'paper_ratings', pkColumn: 'id', category: 'content' },
  { table: 'paper_reports', pkColumn: 'id', category: 'moderation' },
  { table: 'moderation_logs', pkColumn: 'id', category: 'moderation' },
  { table: 'user_moderation_status', pkColumn: 'user_id', category: 'moderation' },
  { table: 'saved_papers', pkColumn: 'id', category: 'content' },
  { table: 'notes', pkColumn: 'id', category: 'content' },
  { table: 'quick_captures', pkColumn: 'id', category: 'content' },
  { table: 'study_projects', pkColumn: 'id', category: 'content' },
  { table: 'user_download_quotas', pkColumn: 'id', category: 'content' },
  { table: 'app_feedback', pkColumn: 'id', category: 'content' },
  { table: 'community_pyqs', pkColumn: 'id', category: 'content' },
  { table: 'papers', pkColumn: 'id', category: 'content' },
];

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

async function listAllBucketObjects(
  supabaseAdmin: SupabaseClient,
  bucket: string
): Promise<{ exists: boolean; paths: string[]; error?: string }> {
  const { data: bucketInfo, error: bucketError } = await supabaseAdmin.storage.getBucket(bucket);
  if (bucketError || !bucketInfo) {
    const msg = (bucketError?.message || '').toLowerCase();
    if (msg.includes('not found') || (bucketError as any)?.status === 404) {
      return { exists: false, paths: [] };
    }
    return {
      exists: false,
      paths: [],
      error: bucketError?.message || `Unable to inspect bucket '${bucket}'.`,
    };
  }

  const collectedPaths: string[] = [];
  const foldersToScan: string[] = [''];

  while (foldersToScan.length > 0) {
    const currentPrefix = foldersToScan.shift()!;
    let offset = 0;

    while (true) {
      const { data: items, error: listError } = await supabaseAdmin.storage
        .from(bucket)
        .list(currentPrefix, {
          limit: 1000,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (listError) {
        return {
          exists: true,
          paths: collectedPaths,
          error: `Failed listing '${bucket}/${currentPrefix}': ${listError.message}`,
        };
      }

      if (!items || items.length === 0) {
        break;
      }

      for (const item of items) {
        if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
        const fullPath = currentPrefix ? `${currentPrefix}/${item.name}` : item.name;

        // In Supabase Storage, folder prefixes have id === null
        if (item.id === null) {
          foldersToScan.push(fullPath);
        } else {
          collectedPaths.push(fullPath);
        }
      }

      if (items.length < 1000) {
        break;
      }
      offset += items.length;
    }
  }

  return { exists: true, paths: collectedPaths };
}

async function inspectTableCount(
  supabaseAdmin: SupabaseClient,
  spec: TableResetSpec
): Promise<{
  table: string;
  category: 'content' | 'moderation';
  exists: boolean;
  rowCount: number;
  error?: string;
}> {
  const { count, error } = await supabaseAdmin
    .from(spec.table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    if (isMissingTableError(error)) {
      return { table: spec.table, category: spec.category, exists: false, rowCount: 0 };
    }
    return {
      table: spec.table,
      category: spec.category,
      exists: true,
      rowCount: 0,
      error: error.message,
    };
  }

  return {
    table: spec.table,
    category: spec.category,
    exists: true,
    rowCount: count ?? 0,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Server environment is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' },
      500
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized: Missing Bearer token.' }, 401);
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    return jsonResponse({ error: 'Unauthorized: Empty Bearer token.' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Authenticate caller JWT on the server
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(jwt);

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized: Invalid or expired session token.' }, 401);
  }

  // 2. Verify 'owner' role strictly from trusted server-side sources only
  let hasOwnerRole = user.app_metadata?.role === 'owner';

  if (!hasOwnerRole) {
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleError && roleRow?.role === 'owner') {
      hasOwnerRole = true;
    }
  }

  if (!hasOwnerRole) {
    return jsonResponse(
      {
        error:
          'Forbidden: Only a verified Studify owner account (app_metadata.role = "owner" or public.user_roles.role = "owner") may run factory reset.',
      },
      403
    );
  }

  // 3. Parse request payload
  let payload: {
    mode?: 'preview' | 'execute';
    confirmationPhrase?: string;
    preserveModerationRecords?: boolean;
  } = {};

  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const mode = payload.mode === 'execute' ? 'execute' : 'preview';
  const preserveModerationRecords = Boolean(payload.preserveModerationRecords);

  // 4. PREVIEW / DRY-RUN MODE
  if (mode === 'preview') {
    const tablePreviews = await Promise.all(
      RESET_TABLES.map((spec) => inspectTableCount(supabaseAdmin, spec))
    );

    const bucketPreviews = await Promise.all(
      TARGET_BUCKETS.map(async (bucket) => {
        const res = await listAllBucketObjects(supabaseAdmin, bucket);
        return {
          bucket,
          exists: res.exists,
          objectCount: res.paths.length,
          samplePaths: res.paths.slice(0, 10),
          error: res.error || null,
        };
      })
    );

    const { count: userRolesCount } = await supabaseAdmin
      .from('user_roles')
      .select('*', { count: 'exact', head: true });

    return jsonResponse({
      mode: 'preview',
      verifiedOwnerId: user.id,
      requiredConfirmationPhrase: CONFIRMATION_PHRASE,
      preserveModerationRecordsOptionAvailable: true,
      databaseTables: tablePreviews,
      storageBuckets: bucketPreviews,
      preservedResources: {
        authUsers: 'Preserved (never deleted)',
        userRolesCount: userRolesCount ?? null,
        schemaAndPolicies: 'Preserved (tables, columns, functions, RLS policies intact)',
        storageBuckets: 'Preserved (bucket definitions and RLS policies intact)',
      },
    });
  }

  // 5. EXECUTE MODE — Require exact confirmation phrase
  if (payload.confirmationPhrase !== CONFIRMATION_PHRASE) {
    return jsonResponse(
      {
        error: `Confirmation phrase mismatch. You must pass confirmationPhrase: "${CONFIRMATION_PHRASE}".`,
      },
      400
    );
  }

  const errors: string[] = [];

  // 6. Step A — Delete Storage objects via official Storage API (batched <= 1000)
  const storageSummary: Array<{
    bucket: string;
    exists: boolean;
    initialObjectCount: number;
    deletedObjectCount: number;
    remainingObjectCount: number;
    error: string | null;
  }> = [];

  for (const bucket of TARGET_BUCKETS) {
    const listed = await listAllBucketObjects(supabaseAdmin, bucket);
    if (!listed.exists) {
      storageSummary.push({
        bucket,
        exists: false,
        initialObjectCount: 0,
        deletedObjectCount: 0,
        remainingObjectCount: 0,
        error: listed.error || null,
      });
      if (listed.error) errors.push(listed.error);
      continue;
    }

    if (listed.error) {
      errors.push(listed.error);
    }

    let deletedCount = 0;
    let bucketErr: string | null = listed.error || null;

    for (let i = 0; i < listed.paths.length; i += MAX_REMOVE_BATCH) {
      const batch = listed.paths.slice(i, i + MAX_REMOVE_BATCH);
      const { data: removed, error: removeErr } = await supabaseAdmin.storage
        .from(bucket)
        .remove(batch);

      if (removeErr) {
        const msg = `Storage removal error in '${bucket}': ${removeErr.message}`;
        bucketErr = bucketErr ? `${bucketErr}; ${msg}` : msg;
        errors.push(msg);
      } else {
        deletedCount += Array.isArray(removed) ? removed.length : batch.length;
      }
    }

    // Verify bucket is actually empty after deletion
    const postCheck = await listAllBucketObjects(supabaseAdmin, bucket);
    const remainingCount = postCheck.paths.length;
    if (remainingCount > 0) {
      const msg = `Bucket '${bucket}' still has ${remainingCount} object(s) remaining after reset.`;
      bucketErr = bucketErr ? `${bucketErr}; ${msg}` : msg;
      errors.push(msg);
    }

    storageSummary.push({
      bucket,
      exists: true,
      initialObjectCount: listed.paths.length,
      deletedObjectCount: deletedCount,
      remainingObjectCount: remainingCount,
      error: bucketErr,
    });
  }

  // 7. Step B — Delete Database content in safe FK-compatible order
  const databaseSummary: Array<{
    table: string;
    category: 'content' | 'moderation';
    exists: boolean;
    skipped: boolean;
    initialRowCount: number;
    deletedRowCount: number;
    remainingRowCount: number;
    error: string | null;
  }> = [];

  for (const spec of RESET_TABLES) {
    const initial = await inspectTableCount(supabaseAdmin, spec);

    if (!initial.exists) {
      databaseSummary.push({
        table: spec.table,
        category: spec.category,
        exists: false,
        skipped: true,
        initialRowCount: 0,
        deletedRowCount: 0,
        remainingRowCount: 0,
        error: null,
      });
      continue;
    }

    if (preserveModerationRecords && spec.category === 'moderation') {
      databaseSummary.push({
        table: spec.table,
        category: spec.category,
        exists: true,
        skipped: true,
        initialRowCount: initial.rowCount,
        deletedRowCount: 0,
        remainingRowCount: initial.rowCount,
        error: null,
      });
      continue;
    }

    if (initial.error) {
      errors.push(`Table '${spec.table}' inspect error: ${initial.error}`);
      databaseSummary.push({
        table: spec.table,
        category: spec.category,
        exists: true,
        skipped: false,
        initialRowCount: 0,
        deletedRowCount: 0,
        remainingRowCount: 0,
        error: initial.error,
      });
      continue;
    }

    let tableErr: string | null = null;
    if (initial.rowCount > 0) {
      const { error: deleteErr } = await supabaseAdmin
        .from(spec.table)
        .delete()
        .not(spec.pkColumn, 'is', null);

      if (deleteErr) {
        tableErr = `Failed clearing '${spec.table}': ${deleteErr.message}`;
        errors.push(tableErr);
      }
    }

    const post = await inspectTableCount(supabaseAdmin, spec);
    if (post.error) {
      const msg = `Post-check error on '${spec.table}': ${post.error}`;
      tableErr = tableErr ? `${tableErr}; ${msg}` : msg;
      errors.push(msg);
    } else if (post.rowCount > 0) {
      const msg = `Table '${spec.table}' still has ${post.rowCount} row(s) remaining.`;
      tableErr = tableErr ? `${tableErr}; ${msg}` : msg;
      errors.push(msg);
    }

    databaseSummary.push({
      table: spec.table,
      category: spec.category,
      exists: true,
      skipped: false,
      initialRowCount: initial.rowCount,
      deletedRowCount: Math.max(0, initial.rowCount - post.rowCount),
      remainingRowCount: post.rowCount,
      error: tableErr,
    });
  }

  const { count: preservedRolesCount } = await supabaseAdmin
    .from('user_roles')
    .select('*', { count: 'exact', head: true });

  const success = errors.length === 0;

  return jsonResponse(
    {
      success,
      mode: 'execute',
      verifiedOwnerId: user.id,
      completedAt: new Date().toISOString(),
      storage: storageSummary,
      database: databaseSummary,
      preserved: {
        authUsers: 'Preserved',
        userRolesCount: preservedRolesCount ?? null,
        schemasPoliciesAndBuckets: 'Preserved',
      },
      errors,
      nextBrowserStep:
        'Refresh Studify or run clearStudifyContentCaches() to clear stale local browser caches without signing out.',
    },
    success ? 200 : 207
  );
});
