import { NextResponse } from "next/server";
import {
  mapPaddleStatusToPlan,
  verifyPaddleWebhookSignature,
  type PaddleWebhookEvent,
  type PaddleWebhookEventData,
} from "@/lib/paddle-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProfileBillingPatch {
  plan?: "free" | "pro";
  subscription_status?: string | null;
  paddle_customer_id?: string | null;
  paddle_subscription_id?: string | null;
  paddle_price_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

function getFirstPriceId(data: PaddleWebhookEventData): string | null {
  const firstId = data.items?.[0]?.price?.id;
  return typeof firstId === "string" && firstId.trim() ? firstId.trim() : null;
}

async function resolveUserId(
  data: PaddleWebhookEventData,
  subscriptionId: string | null
): Promise<string | null> {
  const rawUserId = data.custom_data?.userId;
  if (typeof rawUserId === "string" && rawUserId.trim()) {
    return rawUserId.trim();
  }

  const admin = getSupabaseAdmin();

  if (subscriptionId) {
    const bySub = await admin
      .from("profiles")
      .select("user_id")
      .eq("paddle_subscription_id", subscriptionId)
      .maybeSingle();

    if (bySub.data?.user_id) {
      return bySub.data.user_id as string;
    }
  }

  const customerId =
    typeof data.customer_id === "string" ? data.customer_id.trim() : null;

  if (customerId) {
    const byCustomer = await admin
      .from("profiles")
      .select("user_id")
      .eq("paddle_customer_id", customerId)
      .maybeSingle();

    if (byCustomer.data?.user_id) {
      return byCustomer.data.user_id as string;
    }
  }

  return null;
}

async function upsertProfileBilling(
  userId: string,
  patch: ProfileBillingPatch
): Promise<void> {
  const admin = getSupabaseAdmin();
  const existing = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Profile lookup failed: ${existing.error.message}`);
  }

  if (existing.data) {
    const updated = await admin
      .from("profiles")
      .update(patch)
      .eq("user_id", userId);
    if (updated.error) {
      throw new Error(`Profile update failed: ${updated.error.message}`);
    }
    return;
  }

  const inserted = await admin.from("profiles").insert({
    user_id: userId,
    daily_goal_minutes: 120,
    ...patch,
  });

  if (inserted.error) {
    throw new Error(`Profile insert failed: ${inserted.error.message}`);
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "studytracker-paddle-webhook",
  });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "PADDLE_WEBHOOK_SECRET is not configured." },
      { status: 500 }
    );
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("paddle-signature");

  if (!verifyPaddleWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    return NextResponse.json(
      { error: "Invalid Paddle webhook signature." },
      { status: 401 }
    );
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!event || typeof event.event_type !== "string" || !event.data) {
    return NextResponse.json(
      { error: "Malformed Paddle event payload." },
      { status: 400 }
    );
  }

  const { event_type: eventType, data } = event;
  const isTransactionEvent = eventType.startsWith("transaction.");
  const subscriptionId = isTransactionEvent
    ? typeof data.subscription_id === "string"
      ? data.subscription_id
      : null
    : typeof data.id === "string"
      ? data.id
      : null;

  const customerId =
    typeof data.customer_id === "string" ? data.customer_id : null;
  const priceId = getFirstPriceId(data);

  try {
    const userId = await resolveUserId(data, subscriptionId);
    if (!userId) {
      return NextResponse.json({
        received: true,
        eventType,
        matched: false,
      });
    }

    if (eventType === "transaction.completed") {
      const txStatus = (data.status || "").trim().toLowerCase();
      if (
        txStatus === "completed" ||
        txStatus === "billed" ||
        txStatus === "paid"
      ) {
        const patch: ProfileBillingPatch = {
          plan: "pro",
          subscription_status: "active",
          cancel_at_period_end: false,
        };
        if (customerId) patch.paddle_customer_id = customerId;
        if (subscriptionId) patch.paddle_subscription_id = subscriptionId;
        if (priceId) patch.paddle_price_id = priceId;
        if (data.billing_period?.ends_at) {
          patch.current_period_end = data.billing_period.ends_at;
        }
        await upsertProfileBilling(userId, patch);
      }
    } else if (
      eventType === "subscription.created" ||
      eventType === "subscription.activated" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.trialing" ||
      eventType === "subscription.resumed" ||
      eventType === "subscription.past_due"
    ) {
      const patch: ProfileBillingPatch = {
        plan: mapPaddleStatusToPlan(data.status),
        subscription_status: data.status ?? null,
        current_period_end: data.current_billing_period?.ends_at ?? null,
        cancel_at_period_end: data.scheduled_change?.action === "cancel",
      };
      if (customerId) patch.paddle_customer_id = customerId;
      if (subscriptionId) patch.paddle_subscription_id = subscriptionId;
      if (priceId) patch.paddle_price_id = priceId;
      await upsertProfileBilling(userId, patch);
    } else if (
      eventType === "subscription.canceled" ||
      eventType === "subscription.paused"
    ) {
      const patch: ProfileBillingPatch = {
        plan: "free",
        subscription_status: data.status ?? "canceled",
        current_period_end: data.current_billing_period?.ends_at ?? null,
        cancel_at_period_end: false,
      };
      if (customerId) patch.paddle_customer_id = customerId;
      if (subscriptionId) patch.paddle_subscription_id = subscriptionId;
      await upsertProfileBilling(userId, patch);
    }

    return NextResponse.json({
      received: true,
      eventType,
      matched: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process Paddle webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
