ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS champion_quote text;

CREATE TABLE IF NOT EXISTS public.study_groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  champion_quote text,
  champion_quote_author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  champion_quote_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_group_members (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS study_group_members_user_idx
  ON public.study_group_members (user_id);

CREATE INDEX IF NOT EXISTS study_group_members_group_idx
  ON public.study_group_members (group_id);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view study groups" ON public.study_groups;
CREATE POLICY "Authenticated users can view study groups" ON public.study_groups
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create study groups" ON public.study_groups;
CREATE POLICY "Users can create study groups" ON public.study_groups
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Group members can update study groups" ON public.study_groups;
CREATE POLICY "Group members can update study groups" ON public.study_groups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_group_members m
      WHERE m.group_id = public.study_groups.id
        AND m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.study_group_members m
      WHERE m.group_id = public.study_groups.id
        AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Creators can delete study groups" ON public.study_groups;
CREATE POLICY "Creators can delete study groups" ON public.study_groups
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Authenticated users can view group memberships" ON public.study_group_members;
CREATE POLICY "Authenticated users can view group memberships" ON public.study_group_members
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can join study groups" ON public.study_group_members;
CREATE POLICY "Users can join study groups" ON public.study_group_members
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can leave or creators remove group members" ON public.study_group_members;
CREATE POLICY "Users can leave or creators remove group members" ON public.study_group_members
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1
      FROM public.study_groups g
      WHERE g.id = public.study_group_members.group_id
        AND g.created_by = (SELECT auth.uid())
    )
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
    OR EXISTS (
      SELECT 1
      FROM public.study_group_members m1
      JOIN public.study_group_members m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = (SELECT auth.uid())
        AND m2.user_id = public.study_sessions.user_id
    )
  );
