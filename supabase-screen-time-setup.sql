-- StudyTracker: Private Screen Time & App Usage tracking table
-- Run once in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.screen_time_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('extension', 'android')),
  total_seconds integer NOT NULL DEFAULT 0 CHECK (total_seconds >= 0),
  distracting_seconds integer NOT NULL DEFAULT 0 CHECK (distracting_seconds >= 0),
  study_seconds integer NOT NULL DEFAULT 0 CHECK (study_seconds >= 0),
  apps jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date, source)
);

CREATE INDEX IF NOT EXISTS screen_time_logs_user_date_idx
  ON public.screen_time_logs (user_id, log_date DESC);

ALTER TABLE public.screen_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own screen time logs" ON public.screen_time_logs;
CREATE POLICY "Users can view own screen time logs" ON public.screen_time_logs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own screen time logs" ON public.screen_time_logs;
CREATE POLICY "Users can insert own screen time logs" ON public.screen_time_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own screen time logs" ON public.screen_time_logs;
CREATE POLICY "Users can update own screen time logs" ON public.screen_time_logs
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own screen time logs" ON public.screen_time_logs;
CREATE POLICY "Users can delete own screen time logs" ON public.screen_time_logs
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
