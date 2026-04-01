-- Multi-invocation transcription for long lectures (Vercel ~800s per invocation).
-- Safe to run once; column is optional until applied (app should tolerate missing column via types / migration order).

alter table public.lectures
  add column if not exists pipeline_checkpoint jsonb;

comment on column public.lectures.pipeline_checkpoint is
  'Resumable phase-1 state: chunks, gap_fill, ocr, finalize (long-form transcription).';
