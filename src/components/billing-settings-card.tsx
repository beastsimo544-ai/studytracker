"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import {
  DEFAULT_BILLING_PROFILE,
  loadUserBillingProfile,
  openPaddleBillingPortal,
  type BillingProfile,
} from "@/lib/billing";
import { PRICING, SUPPORT_EMAIL } from "@/lib/site-config";

function formatDateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BillingSettingsCard({ userId }: { userId: string }) {
  const { toast } = useNotifications();
  const [billing, setBilling] = useState<BillingProfile>(DEFAULT_BILLING_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    let active = true;
    const timers: number[] = [];

    const init = async () => {
      await Promise.resolve();
      if (!active) return;

      setIsNativeApp(Capacitor.isNativePlatform());

      const params = new URLSearchParams(window.location.search);
      const isSuccess = params.get("checkout") === "success";
      if (isSuccess) {
        setCheckoutSuccess(true);
        toast.success(
          "Payment received!",
          "Syncing your StudyTracker Pro status..."
        );
      }

      const initial = await loadUserBillingProfile(userId);
      if (active) {
        setBilling(initial);
        setIsLoading(false);
      }

      if (isSuccess && !initial.isPro) {
        const refresh = async () => {
          const updated = await loadUserBillingProfile(userId);
          if (active) {
            setBilling(updated);
          }
        };
        timers.push(window.setTimeout(refresh, 2000));
        timers.push(window.setTimeout(refresh, 5000));
      }
    };

    init();

    return () => {
      active = false;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [userId, toast]);

  const handleOpenPortal = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    const result = await openPaddleBillingPortal();
    setOpeningPortal(false);

    if (result.error || !result.url) {
      toast.error(
        "Could not open billing portal",
        result.error || `Please email ${SUPPORT_EMAIL} for billing help.`
      );
      return;
    }

    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const formattedEndDate = formatDateLabel(billing.currentPeriodEnd);

  return (
    <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Plan &amp; Billing</h2>
            {!isLoading && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  billing.isComped || billing.plan === "pro"
                    ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                    : "border-white/15 bg-white/[0.04] text-white/75"
                }`}
              >
                {billing.isComped
                  ? "Pro · Lifetime VIP"
                  : billing.plan === "pro"
                    ? "StudyTracker Pro"
                    : "Free Plan"}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs leading-relaxed text-white/55">
            {isLoading
              ? "Checking your subscription status..."
              : billing.isComped
                ? "Complimentary StudyTracker Pro access enabled — no billing required."
                : billing.plan === "pro"
                  ? billing.subscriptionStatus === "past_due"
                    ? "Your latest renewal needs payment attention. Update your card in the billing portal."
                    : billing.cancelAtPeriodEnd && formattedEndDate
                      ? `Pro remains active until ${formattedEndDate}, when cancellation takes effect.`
                      : formattedEndDate
                        ? `Active subscription · Next renewal on ${formattedEndDate}.`
                        : "Your StudyTracker Pro subscription is active."
                  : `You are on the Free plan. Upgrade anytime to ${PRICING.pro.name} (${PRICING.pro.monthlyPriceLabel}/mo or ${PRICING.pro.yearlyPriceLabel}/yr) on the web.`}
          </p>
        </div>

        {!isNativeApp && !isLoading && (
          <div className="flex flex-wrap items-center gap-2">
            {billing.paddleCustomerId && (
              <button
                type="button"
                disabled={openingPortal}
                onClick={handleOpenPortal}
                className="inline-flex h-9 items-center rounded-xl border border-white/15 bg-[#09090b] px-3.5 text-xs font-semibold text-white/85 transition hover:border-white/30 hover:text-white disabled:opacity-50"
              >
                {openingPortal ? "Opening..." : "Manage / Cancel Subscription"}
              </button>
            )}

            {!billing.isPro && (
              <Link
                href="/pricing"
                className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90"
              >
                Upgrade to Pro
              </Link>
            )}
          </div>
        )}
      </div>

      {checkoutSuccess && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
          {billing.isPro
            ? "Your StudyTracker Pro plan is now active. Thank you for supporting StudyTracker!"
            : "Checkout complete — waiting for Paddle webhook confirmation. Refresh in a few seconds if it has not updated yet."}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-white/45">
        <Link href="/refund" className="hover:text-white">
          14-day Refund Policy
        </Link>
        <Link href="/terms" className="hover:text-white">
          Terms &amp; Conditions
        </Link>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">
          Billing support: {SUPPORT_EMAIL}
        </a>
      </div>
    </section>
  );
}
