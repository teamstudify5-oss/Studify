-- ==============================================================================
-- STUDIFY SUPABASE SCHEMA (Production Ready)
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. STUDY PROJECTS TABLE
-- Stores student workspaces, subjects, targets, tasks, notes, and attached papers
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

-- Enable RLS for study_projects
alter table public.study_projects enable row level security;

-- Policies for study_projects (User isolated)
create policy "Users can view their own projects"
  on public.study_projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.study_projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.study_projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.study_projects for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------

-- 2. QUICK CAPTURES TABLE
-- Scratchpad for study thoughts, formulas, doubts, and web resources
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

-- Enable RLS for quick_captures
alter table public.quick_captures enable row level security;

-- Policies for quick_captures (User isolated)
create policy "Users can view their own quick captures"
  on public.quick_captures for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quick captures"
  on public.quick_captures for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own quick captures"
  on public.quick_captures for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own quick captures"
  on public.quick_captures for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------

-- 3. SAVED PAPERS / BOOKMARKS TABLE
-- Tracks papers bookmarked by authenticated students
create table if not exists public.saved_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  paper_id text not null,
  created_at timestamptz not null default now(),
  constraint saved_papers_user_paper_unique unique (user_id, paper_id)
);

-- Enable RLS for saved_papers
alter table public.saved_papers enable row level security;

-- Policies for saved_papers (User isolated)
create policy "Users can view their own bookmarks"
  on public.saved_papers for select
  using (auth.uid() = user_id);

create policy "Users can add bookmarks"
  on public.saved_papers for insert
  with check (auth.uid() = user_id);

create policy "Users can remove bookmarks"
  on public.saved_papers for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------

-- 4. QUESTION PAPERS TABLE (Community Repository & User Submissions)
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
  rating numeric not null default 5.0,
  rating_count integer not null default 1,
  reviews jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS for papers
alter table public.papers enable row level security;

-- Policies for papers:
-- 1) Anyone can view approved papers, authors can view their own pending/rejected papers
create policy "Approved papers are publicly readable"
  on public.papers for select
  using (status = 'approved' or auth.uid() = user_id);

-- 2) Logged in users can insert papers
create policy "Authenticated users can submit papers"
  on public.papers for insert
  with check (auth.role() = 'authenticated' and (user_id is null or auth.uid() = user_id));

-- 3) Authors can update their own papers
create policy "Users can update their own submitted papers"
  on public.papers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) Authors can delete their own papers
create policy "Users can delete their own papers"
  on public.papers for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------------

-- 5. NOTES TABLE (Study Notes, Formulas, AI Revision Cards)
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

-- Enable RLS for notes
alter table public.notes enable row level security;

-- Policies for notes (User isolated via auth.uid())
create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Enable Realtime publication for notes table
alter publication supabase_realtime add table public.notes;
