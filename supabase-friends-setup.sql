ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.profiles ALTER COLUMN daily_goal_minutes SET DEFAULT 120;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.friendships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_no_self_chk CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_uidx
  ON public.friendships (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
  );

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = addressee_id
  );

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = requester_id
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Recipients can accept friend requests" ON public.friendships;
CREATE POLICY "Recipients can accept friend requests" ON public.friendships
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = addressee_id)
  WITH CHECK (
    (SELECT auth.uid()) = addressee_id
    AND status = 'accepted'
  );

DROP POLICY IF EXISTS "Users can remove or decline friendships" ON public.friendships;
CREATE POLICY "Users can remove or decline friendships" ON public.friendships
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = addressee_id
  );

DROP POLICY IF EXISTS "Users can view friends study sessions" ON public.study_sessions;
CREATE POLICY "Users can view friends study sessions" ON public.study_sessions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = (SELECT auth.uid()) AND f.addressee_id = public.study_sessions.user_id)
          OR (f.addressee_id = (SELECT auth.uid()) AND f.requester_id = public.study_sessions.user_id)
        )
    )
  );
