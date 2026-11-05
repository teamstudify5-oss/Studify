-- ==============================================================================
-- STUDIFY SUPABASE SCHEMA (Production Ready & Safely Repeatable - Bug 17 Fixed)
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- All operations use IF NOT EXISTS / DROP POLICY IF EXISTS to allow safe re-runs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. USER ROLES & ADMIN PERMISSIONS (Priority 2)
-- ------------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'moderator', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Repeatable policy definitions
drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Users can read their own role"
  on public.user_roles for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles"
  on public.user_roles for select
  using (
    exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role in ('owner', 'admin')
    )
  );

-- Helper security function for RLS checks
create or replace function public.is_admin(check_uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_uid and role in ('owner', 'admin')
  ) or exists (
    select 1 from auth.users
    where id = check_uid and (
      raw_app_meta_data->>'role' in ('owner', 'admin') or
      raw_app_meta_data->>'is_admin' = 'true'
    )
  );
$$;

-- ------------------------------------------------------------------------------
-- 1. STUDY PROJECTS TABLE
-- Stores student workspaces, subjects, targets, tasks, notes, and attached papers
-- ------------------------------------------------------------------------------
create table if not exists public.study_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  subject text not null,
  exam_board text,
  target_exam text,
  target_date text,
  color text not null default 'cyan',
  icon text default 'Folder',
  description text default '',
  status text not null default 'active',
  paper_ids jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_projects enable row level security;

drop policy if exists "Users can view their own projects" on public.study_projects;
create policy "Users can view their own projects"
  on public.study_projects for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own projects" on public.study_projects;
create policy "Users can insert their own projects"
  on public.study_projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own projects" on public.study_projects;
create policy "Users can update their own projects"
  on public.study_projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own projects" on public.study_projects;
create policy "Users can delete their own projects"
  on public.study_projects for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 2. QUICK CAPTURES TABLE
-- Scratchpad for study thoughts, formulas, doubts, and web resources
-- ------------------------------------------------------------------------------
create table if not exists public.quick_captures (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text default '',
  content text not null,
  type text not null default 'thought',
  project_id text,
  tags jsonb not null default '[]'::jsonb,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.quick_captures enable row level security;

drop policy if exists "Users can view their own quick captures" on public.quick_captures;
create policy "Users can view their own quick captures"
  on public.quick_captures for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own quick captures" on public.quick_captures;
create policy "Users can insert their own quick captures"
  on public.quick_captures for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own quick captures" on public.quick_captures;
create policy "Users can update their own quick captures"
  on public.quick_captures for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own quick captures" on public.quick_captures;
create policy "Users can delete their own quick captures"
  on public.quick_captures for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3. SAVED PAPERS / BOOKMARKS TABLE
-- Tracks papers bookmarked by authenticated students
-- ------------------------------------------------------------------------------
create table if not exists public.saved_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  paper_id text not null,
  created_at timestamptz not null default now(),
  constraint saved_papers_user_paper_unique unique (user_id, paper_id)
);

alter table public.saved_papers enable row level security;

drop policy if exists "Users can view their own bookmarks" on public.saved_papers;
create policy "Users can view their own bookmarks"
  on public.saved_papers for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add bookmarks" on public.saved_papers;
create policy "Users can add bookmarks"
  on public.saved_papers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove bookmarks" on public.saved_papers;
create policy "Users can remove bookmarks"
  on public.saved_papers for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. QUESTION PAPERS TABLE (Community Repository & User Submissions)
-- ------------------------------------------------------------------------------
create table if not exists public.papers (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null,
  subject text not null,
  grade text not null,
  exam_board text not null,
  year integer not null,
  chapter text,
  description text,
  total_marks integer not null default 100,
  time_allowed_minutes integer not null default 180,
  file_name text,
  file_url text,
  file_size_bytes bigint default 2500000,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'approved',
  submitted_by jsonb default '{}'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  views_count integer not null default 0,
  downloads_count integer not null default 0,
  rating numeric default null,
  rating_count integer not null default 0,
  reviews jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.papers enable row level security;

drop policy if exists "Approved papers are publicly readable" on public.papers;
create policy "Approved papers are publicly readable"
  on public.papers for select
  using (status = 'approved' or auth.uid() = user_id or public.is_admin());

drop policy if exists "Authenticated users can submit papers" on public.papers;
create policy "Authenticated users can submit papers"
  on public.papers for insert
  with check (auth.role() = 'authenticated' and (user_id is null or auth.uid() = user_id));

drop policy if exists "Users can update their own submitted papers" on public.papers;
create policy "Users can update their own submitted papers"
  on public.papers for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can delete their own papers" on public.papers;
create policy "Users can delete their own papers"
  on public.papers for delete
  using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. REAL RATINGS TABLE (Priority 3: 1 rating per user per paper)
-- ------------------------------------------------------------------------------
create table if not exists public.paper_ratings (
  id uuid primary key default gen_random_uuid(),
  paper_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  rating integer not null check (rating >= 1 and rating <= 5),
  review_text text,
  user_display_name text not null default 'Student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_ratings_user_paper_unique unique (user_id, paper_id)
);

alter table public.paper_ratings enable row level security;

drop policy if exists "Anyone can read ratings" on public.paper_ratings;
create policy "Anyone can read ratings"
  on public.paper_ratings for select
  using (true);

drop policy if exists "Authenticated users can rate once per paper" on public.paper_ratings;
create policy "Authenticated users can rate once per paper"
  on public.paper_ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit their own rating" on public.paper_ratings;
create policy "Users can edit their own rating"
  on public.paper_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own rating" on public.paper_ratings;
create policy "Users can delete their own rating"
  on public.paper_ratings for delete
  using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. REPORT & MODERATION SYSTEM (Priority 6)
-- ------------------------------------------------------------------------------
create table if not exists public.paper_reports (
  id uuid primary key default gen_random_uuid(),
  paper_id text not null,
  reporter_id uuid references auth.users(id) on delete set null default auth.uid(),
  reporter_name text not null default 'Student',
  reporter_email text,
  reason_category text not null check (
    reason_category in (
      'copyright',
      'incorrect_content',
      'poor_quality',
      'duplicate',
      'spam',
      'unsafe_file',
      'privacy_violation',
      'other'
    )
  ),
  reason_details text not null,
  evidence_url text,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed', 'takedown')),
  resolution_notes text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.paper_reports enable row level security;

drop policy if exists "Users can view reports they created" on public.paper_reports;
create policy "Users can view reports they created"
  on public.paper_reports for select
  using (auth.uid() = reporter_id or public.is_admin());

drop policy if exists "Authenticated users can submit reports" on public.paper_reports;
create policy "Authenticated users can submit reports"
  on public.paper_reports for insert
  with check (auth.role() = 'authenticated' and (reporter_id is null or auth.uid() = reporter_id));

drop policy if exists "Only moderators can update reports" on public.paper_reports;
create policy "Only moderators can update reports"
  on public.paper_reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- Moderation history & audit trail table
create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references auth.users(id) default auth.uid(),
  action text not null,
  target_type text not null check (target_type in ('paper', 'report', 'user')),
  target_id text not null,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.moderation_logs enable row level security;

drop policy if exists "Only admins can view moderation logs" on public.moderation_logs;
create policy "Only admins can view moderation logs"
  on public.moderation_logs for select
  using (public.is_admin());

drop policy if exists "Only admins can record moderation logs" on public.moderation_logs;
create policy "Only admins can record moderation logs"
  on public.moderation_logs for insert
  with check (public.is_admin());

-- User moderation status / suspensions table
create table if not exists public.user_moderation_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_suspended boolean not null default false,
  suspension_reason text,
  suspended_until timestamptz,
  suspended_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_moderation_status enable row level security;

drop policy if exists "Users can check their own suspension status" on public.user_moderation_status;
create policy "Users can check their own suspension status"
  on public.user_moderation_status for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Only admins can manage user suspensions" on public.user_moderation_status;
create policy "Only admins can manage user suspensions"
  on public.user_moderation_status for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. NOTES TABLE (Study Notes, Formulas, AI Revision Cards)
-- ------------------------------------------------------------------------------
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  project_id text,
  title text not null default 'Untitled Note',
  content text not null default '',
  tags jsonb not null default '[]'::jsonb,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "Users can view their own notes" on public.notes;
create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own notes" on public.notes;
create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Safely add notes table to Realtime publication (repeatable check)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
