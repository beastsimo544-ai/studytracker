import { NextResponse } from "next/server";
import { createPaddlePortalSession } from "@/lib/paddle-server";
import {
  getSupabaseAdmin,
  verifySupabaseAccessToken,
} from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || "";

  if (!token) {
    return NextResponse.json(
      { error: "Missing authorization token." },
      { status: 401 }
    );
  }

  const user = await verifySupabaseAccessToken(token);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired session." },
      { status: 401 }
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `Could not load billing profile: ${error.message}` },
        { status: 500 }
      );
    }

    const customerId =
      typeof profile?.paddle_customer_id === "string"
        ? profile.paddle_customer_id.trim()
        : "";

    if (!customerId) {
      return NextResponse.json(
        { error: "No Paddle billing account found for this user yet." },
        { status: 404 }
      );
    }

    const subscriptionId =
      typeof profile?.paddle_subscription_id === "string"
        ? profile.paddle_subscription_id.trim()
        : null;

    const session = await createPaddlePortalSession(customerId, subscriptionId);

    return NextResponse.json({
      url: session.overviewUrl,
      cancelUrl: session.cancelUrl,
      updatePaymentMethodUrl: session.updatePaymentMethodUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unable to create Paddle customer portal session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
