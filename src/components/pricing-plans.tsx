"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import {
  PADDLE_CLIENT_TOKEN,
  PADDLE_ENV,
  PADDLE_PRICE_MONTHLY,
  PADDLE_PRICE_YEARLY,
  PRICING,
  SUPPORT_EMAIL,
} from "@/lib/site-config";
import { supabase } from "@/lib/supabase";

interface PaddleCheckoutOptions {
  items: Array<{ priceId: string; quantity: number }>;
  customer?: { email?: string };
  customData?: Record<string, string>;
  settings?: {
    displayMode?: "overlay" | "inline";
    theme?: "light" | "dark";
    successUrl?: string;
  };
}

interface PaddleInstance {
  Environment?: {
    set: (env: "sandbox" | "production") => void;
  };
  Initialize: (options: { token: string }) => void;
  Checkout: {
    open: (options: PaddleCheckoutOptions) => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleInstance;
  }
}

let paddleScriptPromise: Promise<PaddleInstance> | null = null;
let paddleInitialized = false;

function loadPaddleSdk(): Promise<PaddleInstance> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable"));
  }

  if (window.Paddle) {
    if (!paddleInitialized && PADDLE_CLIENT_TOKEN) {
      if (PADDLE_ENV === "sandbox") {
        window.Paddle.Environment?.set("sandbox");
      }
      window.Paddle.Initialize({ token: PADDLE_CLIENT_TOKEN });
      paddleInitialized = true;
    }
    return Promise.resolve(window.Paddle);
  }

  if (paddleScriptPromise) {
    return paddleScriptPromise;
  }

  paddleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => {
      if (!window.Paddle) {
        paddleScriptPromise = null;
        reject(new Error("Paddle SDK failed to attach"));
        return;
      }
      if (!paddleInitialized && PADDLE_CLIENT_TOKEN) {
        if (PADDLE_ENV === "sandbox") {
          window.Paddle.Environment?.set("sandbox");
        }
        window.Paddle.Initialize({ token: PADDLE_CLIENT_TOKEN });
        paddleInitialized = true;
      }
      resolve(window.Paddle);
    };
    script.onerror = () => {
      paddleScriptPromise = null;
      reject(new Error("Failed to load Paddle checkout script"));
    };
    document.head.appendChild(script);
  });

  return paddleScriptPromise;
}

export default function PricingPlans({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useNotifications();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted || !data.user) return;
        setUserId(data.user.id);
        setUserEmail(data.user.email ?? null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPriceId =
    billingCycle === "monthly" ? PADDLE_PRICE_MONTHLY : PADDLE_PRICE_YEARLY;
  const isPaddleReady = Boolean(PADDLE_CLIENT_TOKEN && selectedPriceId);

  const handleProClick = async () => {
    setCheckoutNotice(null);

    if (!isPaddleReady) {
      if (!userId) {
        router.push(`/register?plan=pro-${billingCycle}`);
        return;
      }
      const message = `StudyTracker Pro checkout is activating soon. Need early access? Email ${SUPPORT_EMAIL}.`;
      setCheckoutNotice(message);
      toast.info("Pro checkout activating soon", `Questions? Email ${SUPPORT_EMAIL}`);
      return;
    }

    setOpeningCheckout(true);
    try {
      const paddle = await loadPaddleSdk();
      paddle.Checkout.open({
        items: [{ priceId: selectedPriceId, quantity: 1 }],
        customer: userEmail ? { email: userEmail } : undefined,
        customData: userId ? { userId } : undefined,
        settings: {
          displayMode: "overlay",
          theme: "dark",
        },
      });
    } catch {
      toast.error(
        "Unable to open checkout",
        `Please try again or contact ${SUPPORT_EMAIL}.`
      );
    } finally {
      setOpeningCheckout(false);
    }
  };

  return (
    <div className="w-full">
      {/* Billing interval toggle */}
      <div className="flex flex-col items-center justify-center gap-2">
        <div
          role="group"
          aria-label="Billing interval"
          className="inline-flex items-center rounded-full border border-white/[0.1] bg-[#111113] p-1"
        >
          <button
            type="button"
            aria-pressed={billingCycle === "monthly"}
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition sm:text-sm ${
              billingCycle === "monthly"
                ? "bg-white text-black shadow-sm"
                : "text-white/65 hover:text-white"
            }`}
          >
            Monthly
          </button>

          <button
            type="button"
            aria-pressed={billingCycle === "yearly"}
            onClick={() => setBillingCycle("yearly")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition sm:text-sm ${
              billingCycle === "yearly"
                ? "bg-white text-black shadow-sm"
                : "text-white/65 hover:text-white"
            }`}
          >
            <span>Yearly</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                billingCycle === "yearly"
                  ? "bg-emerald-500/20 text-emerald-800"
                  : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              Save {PRICING.pro.yearlySavingsPercent}%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div
        className={`mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2 ${
          compact ? "" : "sm:gap-6"
        }`}
      >
        {/* Free Tier */}
        <article className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold tracking-tight text-white">
              {PRICING.free.name}
            </h3>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-white/65">
              {PRICING.free.badge}
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-white/60 sm:text-sm">
            {PRICING.free.description}
          </p>

          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {PRICING.free.priceLabel}
            </span>
            <span className="text-xs text-white/50 sm:text-sm">
              / {PRICING.free.cadenceLabel}
            </span>
          </div>

          <ul className="mt-6 flex-1 space-y-2.5 text-xs text-white/75 sm:text-sm">
            {PRICING.free.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-emerald-400" aria-hidden="true">
                  &#10003;
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Link
            href={userId ? "/dashboard" : "/register"}
            className="mt-7 flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            {userId ? "Go to Dashboard" : "Get Started Free"}
          </Link>
        </article>

        {/* Pro Tier */}
        <article className="flex flex-col rounded-2xl border border-emerald-500/35 bg-[#111113] p-5 shadow-[0_0_40px_-18px_rgba(16,185,129,0.35)] sm:p-7">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold tracking-tight text-white">
              {PRICING.pro.name}
            </h3>
            <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              {PRICING.pro.badge}
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-white/60 sm:text-sm">
            {PRICING.pro.description}
          </p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {billingCycle === "monthly"
                ? PRICING.pro.monthlyPriceLabel
                : PRICING.pro.yearlyPriceLabel}
            </span>
            <span className="text-xs text-white/50 sm:text-sm">
              / {billingCycle === "monthly" ? "month" : "year"}
            </span>
            {billingCycle === "yearly" && (
              <span className="text-xs font-medium text-emerald-300">
                (${PRICING.pro.yearlyMonthlyEquivalent}/mo billed annually)
              </span>
            )}
          </div>

          <ul className="mt-6 flex-1 space-y-2.5 text-xs text-white/80 sm:text-sm">
            {PRICING.pro.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-emerald-400" aria-hidden="true">
                  &#10003;
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={openingCheckout}
            onClick={handleProClick}
            className="mt-7 flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {openingCheckout
              ? "Opening Checkout..."
              : billingCycle === "monthly"
              ? `Upgrade to Pro — ${PRICING.pro.monthlyPriceLabel}/mo`
              : `Upgrade to Pro — ${PRICING.pro.yearlyPriceLabel}/yr`}
          </button>

          {checkoutNotice && (
            <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-200">
              {checkoutNotice}
            </p>
          )}
        </article>
      </div>

      {/* Billing & refund clarity line */}
      <p className="mt-5 text-center text-xs text-white/50">
        Cancel anytime. Covered by our{" "}
        <Link href="/refund" className="text-white/75 underline hover:text-white">
          14-day Refund Policy
        </Link>
        . Secure checkout powered by Paddle &middot;{" "}
        <Link href="/terms" className="text-white/75 underline hover:text-white">
          Terms &amp; Conditions
        </Link>
        .
      </p>
    </div>
  );
}
