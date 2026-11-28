-- Optional SQL migration so equipped Discord-style profile effects sync across devices.
-- The app also works without running this by using local storage + highest unlocked achievement.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_effect text;
