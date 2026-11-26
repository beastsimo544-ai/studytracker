ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS listening_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS listening_artist text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS listening_platform text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS listening_url text;
