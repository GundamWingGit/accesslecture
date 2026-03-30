-- AccessLecture Database Schema
-- Run this in Supabase SQL Editor to set up your database

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Lectures table
create table if not exists lectures (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  course_id text,
  audio_url text,
  status text not null default 'uploaded',
  compliance_mode text not null default 'clean',
  duration_seconds float,
  progress_pct float default 0,
  progress_message text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transcripts table
create table if not exists transcripts (
  id uuid primary key default uuid_generate_v4(),
  lecture_id uuid references lectures(id) on delete cascade unique,
  segments jsonb not null default '[]',
  raw_text text not null default '',
  cleaned_text text,
  speaker_map jsonb default '{}',
  created_at timestamptz default now()
);

-- Captions table
create table if not exists captions (
  id text primary key,
  lecture_id uuid references lectures(id) on delete cascade,
  sequence int not null,
  start_ms int not null,
  end_ms int not null,
  original_text text not null,
  cleaned_text text,
  speaker text,
  created_at timestamptz default now()
);

-- Accessibility scores table
create table if not exists accessibility_scores (
  id uuid primary key default uuid_generate_v4(),
  lecture_id uuid references lectures(id) on delete cascade,
  overall float not null,
  rating text not null,
  dimensions jsonb not null default '[]',
  visual_references jsonb default '[]',
  created_at timestamptz default now()
);

-- Courses table (for academic vocabulary context)
create table if not exists courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  syllabus_text text,
  vocabulary jsonb default '[]',
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_captions_lecture on captions(lecture_id, sequence);
create index if not exists idx_transcripts_lecture on transcripts(lecture_id);
create index if not exists idx_scores_lecture on accessibility_scores(lecture_id, created_at desc);
create index if not exists idx_lectures_status on lectures(status);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger lectures_updated_at
  before update on lectures
  for each row execute function update_updated_at();

-- Enable realtime for progress updates
alter publication supabase_realtime add table lectures;
