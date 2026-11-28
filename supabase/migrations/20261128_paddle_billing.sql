-- StudyTracker Paddle Billing Migration
-- Run once in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS paddle_price_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_comped boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_paddle_customer_id_idx
  ON public.profiles (paddle_customer_id)
  WHERE paddle_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_paddle_subscription_id_idx
  ON public.profiles (paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;

-- Prevent normal authenticated clients from editing their own billing/VIP fields.
-- Only service_role (Paddle webhook) and postgres/dashboard SQL can modify them.
CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'free';
      NEW.subscription_status := NULL;
      NEW.paddle_customer_id := NULL;
      NEW.paddle_subscription_id := NULL;
      NEW.paddle_price_id := NULL;
      NEW.current_period_end := NULL;
      NEW.cancel_at_period_end := false;
      NEW.is_comped := false;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.plan := OLD.plan;
      NEW.subscription_status := OLD.subscription_status;
      NEW.paddle_customer_id := OLD.paddle_customer_id;
      NEW.paddle_subscription_id := OLD.paddle_subscription_id;
      NEW.paddle_price_id := OLD.paddle_price_id;
      NEW.current_period_end := OLD.current_period_end;
      NEW.cancel_at_period_end := OLD.cancel_at_period_end;
      NEW.is_comped := OLD.is_comped;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_billing_columns_trigger ON public.profiles;

CREATE TRIGGER protect_profile_billing_columns_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_billing_columns();

-- Grant permanent free Pro (Lifetime VIP) to yourself and friends by username:
-- UPDATE public.profiles
-- SET is_comped = true, plan = 'pro'
-- WHERE username IN ('simo', 'KAIZEN');
