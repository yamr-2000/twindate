-- Run this in your Supabase Dashboard > SQL Editor
-- Creates the profiles table used by TwinDate

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  age integer not null check (age >= 18),
  gender text not null check (gender in ('male', 'female')),
  interested_in text not null check (interested_in in ('males', 'females', 'both')),
  ai_personality_summary jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read all profiles"
  on profiles for select using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can delete own profile"
  on profiles for delete using (auth.uid() = id);

-- Daily AI Match Reports
create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  people_count integer not null default 0,
  match_count integer not null default 0,
  best_match_name text,
  best_match_score integer,
  vibe_traits text[] default '{}',
  daily_insight text not null,
  created_at timestamptz default now(),
  unique (user_id, report_date)
);

alter table daily_reports enable row level security;

create policy "Users can read own reports"
  on daily_reports for select using (auth.uid() = user_id);

create policy "Users can insert own reports"
  on daily_reports for insert with check (auth.uid() = user_id);

create policy "Users can delete own reports"
  on daily_reports for delete using (auth.uid() = user_id);
