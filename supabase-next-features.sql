ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';

CREATE TABLE IF NOT EXISTS public.exams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text,
  exam_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exams" ON public.exams;
CREATE POLICY "Users can view own exams" ON public.exams
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own exams" ON public.exams;
CREATE POLICY "Users can insert own exams" ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own exams" ON public.exams;
CREATE POLICY "Users can update own exams" ON public.exams
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own exams" ON public.exams;
CREATE POLICY "Users can delete own exams" ON public.exams
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
