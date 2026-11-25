ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS studying_subject text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS studying_started_at timestamptz;

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS 'DELETE FROM auth.users WHERE id = auth.uid()';

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
