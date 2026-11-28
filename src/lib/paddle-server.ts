import crypto from "node:crypto";

export interface PaddleWebhookItem {
  price?: {
    id?: string | null;
  } | null;
}

export interface PaddleWebhookEventData {
  id?: string | null;
  status?: string | null;
  customer_id?: string | null;
  subscription_id?: string | null;
  custom_data?: Record<string, unknown> | null;
  items?: PaddleWebhookItem[] | null;
  billing_period?: {
    starts_at?: string | null;
    ends_at?: string | null;
  } | null;
  current_billing_period?: {
    starts_at?: string | null;
    ends_at?: string | null;
  } | null;
  scheduled_change?: {
    action?: string | null;
    effective_at?: string | null;
  } | null;
}

export interface PaddleWebhookEvent {
  event_id?: string;
  event_type: string;
  data: PaddleWebhookEventData;
}

interface PaddlePortalApiResponse {
  data?: {
    id?: string;
    urls?: {
      general?: {
        overview?: string | null;
      } | null;
      subscriptions?: Array<{
        id?: string;
        cancel_subscription?: string | null;
        update_subscription_payment_method?: string | null;
      }> | null;
    } | null;
  } | null;
  error?: {
    detail?: string;
    code?: string;
  } | null;
}

export interface PaddlePortalSessionUrls {
  overviewUrl: string;
  cancelUrl: string | null;
  updatePaymentMethodUrl: string | null;
}

export function getPaddleApiBaseUrl(): string {
  const env = (
    process.env.PADDLE_ENV ||
    process.env.NEXT_PUBLIC_PADDLE_ENV ||
    "production"
  )
    .trim()
    .toLowerCase();

  return env === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  let timestampRaw: string | null = null;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(";")) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (key === "ts") {
      timestampRaw = value;
    } else if (key === "h1" && value) {
      signatures.push(value);
    }
  }

  if (!timestampRaw || signatures.length === 0) return false;

  const tsSeconds = Number(timestampRaw);
  if (!Number.isFinite(tsSeconds) || tsSeconds <= 0) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > 300) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(`${timestampRaw}:${rawBody}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHex, "hex");

  for (const candidate of signatures) {
    if (!/^[0-9a-f]+$/i.test(candidate)) continue;
    const candidateBuffer = Buffer.from(candidate, "hex");
    if (candidateBuffer.length !== expectedBuffer.length) continue;
    if (crypto.timingSafeEqual(expectedBuffer, candidateBuffer)) {
      return true;
    }
  }

  return false;
}

export function mapPaddleStatusToPlan(
  status: string | null | undefined
): "free" | "pro" {
  const normalized = (status || "").trim().toLowerCase();
  if (
    normalized === "active" ||
    normalized === "trialing" ||
    normalized === "past_due"
  ) {
    return "pro";
  }
  return "free";
}

export async function createPaddlePortalSession(
  customerId: string,
  subscriptionId?: string | null
): Promise<PaddlePortalSessionUrls> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PADDLE_API_KEY environment variable.");
  }

  const response = await fetch(
    `${getPaddleApiBaseUrl()}/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscription_ids: subscriptionId ? [subscriptionId] : [],
      }),
    }
  );

  const payload = (await response.json()) as PaddlePortalApiResponse;
  if (!response.ok || !payload.data?.urls?.general?.overview) {
    const detail =
      payload.error?.detail ||
      `Paddle portal session request failed (${response.status}).`;
    throw new Error(detail);
  }

  const subUrls = payload.data.urls.subscriptions?.[0];

  return {
    overviewUrl: payload.data.urls.general.overview,
    cancelUrl: subUrls?.cancel_subscription ?? null,
    updatePaymentMethodUrl: subUrls?.update_subscription_payment_method ?? null,
  };
}
