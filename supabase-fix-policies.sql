-- StudyTracker: fix missing DELETE / UPDATE permissions (RLS policies)
-- Paste this whole file into Supabase Dashboard -> SQL Editor and click "Run".
-- Safe to run more than once.

-- study_sessions: allow users to delete and edit THEIR OWN sessions
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.study_sessions;
CREATE POLICY "Users can delete own sessions" ON public.study_sessions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.study_sessions;
CREATE POLICY "Users can update own sessions" ON public.study_sessions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- subjects: same fix (this is why deleted subjects used to come back)
DROP POLICY IF EXISTS "Users can delete own subjects" ON public.subjects;
CREATE POLICY "Users can delete own subjects" ON public.subjects
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own subjects" ON public.subjects;
CREATE POLICY "Users can update own subjects" ON public.subjects
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Verify: you should now see DELETE and UPDATE rows for both tables
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('study_sessions', 'subjects')
ORDER BY tablename, cmd;
