import { supabase } from "@/lib/supabase";

export interface BillingProfile {
  plan: "free" | "pro";
  subscriptionStatus: string | null;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isComped: boolean;
  isPro: boolean;
}

export const DEFAULT_BILLING_PROFILE: BillingProfile = {
  plan: "free",
  subscriptionStatus: null,
  paddleCustomerId: null,
  paddleSubscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  isComped: false,
  isPro: false,
};

export async function loadUserBillingProfile(
  userId: string
): Promise<BillingProfile> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "plan, subscription_status, paddle_customer_id, paddle_subscription_id, current_period_end, cancel_at_period_end, is_comped"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_BILLING_PROFILE;
    }

    const plan = data.plan === "pro" ? "pro" : "free";
    const isComped = Boolean(data.is_comped);

    return {
      plan,
      subscriptionStatus:
        typeof data.subscription_status === "string"
          ? data.subscription_status
          : null,
      paddleCustomerId:
        typeof data.paddle_customer_id === "string"
          ? data.paddle_customer_id
          : null,
      paddleSubscriptionId:
        typeof data.paddle_subscription_id === "string"
          ? data.paddle_subscription_id
          : null,
      currentPeriodEnd:
        typeof data.current_period_end === "string"
          ? data.current_period_end
          : null,
      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
      isComped,
      isPro: plan === "pro" || isComped,
    };
  } catch {
    return DEFAULT_BILLING_PROFILE;
  }
}

export async function openPaddleBillingPortal(): Promise<{
  url?: string;
  error?: string;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;
    if (!accessToken) {
      return { error: "Please sign in again to manage billing." };
    }

    const res = await fetch("/api/paddle/portal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !body.url) {
      return {
        error: body.error || "Unable to open Paddle billing portal right now.",
      };
    }

    return { url: body.url };
  } catch {
    return { error: "Network error while opening Paddle billing portal." };
  }
}
