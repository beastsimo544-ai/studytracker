import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import {
  LEGAL_LAST_UPDATED,
  PRICING,
  SITE_NAME,
  SUPPORT_EMAIL,
} from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: `14-day Refund Policy for ${SITE_NAME} Pro subscriptions processed via Paddle.`,
  alternates: {
    canonical: "/refund",
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Refund Policy
          </h1>
          <p className="mt-1 text-xs text-white/45">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>

          <div className="mt-6 space-y-5 text-xs leading-relaxed text-white/75 sm:text-sm">
            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                1. 14-Day Money-Back Guarantee
              </h2>
              <p className="mt-1.5">
                We want you to be completely satisfied with{" "}
                <strong>{PRICING.pro.name}</strong>. You may request a full
                refund within <strong>14 calendar days</strong> of your initial
                purchase or subscription renewal, no questions asked.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                2. Merchant of Record (Paddle.com)
              </h2>
              <p className="mt-1.5">
                All {SITE_NAME} payments are processed by{" "}
                <strong>Paddle.com</strong>, our Merchant of Record. Approved
                refunds are issued by Paddle directly back to the original
                payment method used at checkout and typically appear on your
                statement within <strong>5 to 10 business days</strong>,
                depending on your bank or card issuer.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                3. How to Request a Refund
              </h2>
              <p className="mt-1.5">
                You can request a refund within 14 days using either option
                below:
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                <li>
                  Use Paddle&apos;s buyer support portal at{" "}
                  <a
                    href="https://paddle.net"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300 underline hover:text-emerald-200"
                  >
                    paddle.net
                  </a>{" "}
                  or the receipt link emailed to you when you subscribed.
                </li>
                <li>
                  Email us directly at{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-medium text-emerald-300 underline hover:text-emerald-200"
                  >
                    {SUPPORT_EMAIL}
                  </a>{" "}
                  with your account email address and Paddle order/transaction
                  ID, and we will process your refund promptly.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                4. Canceling Your Subscription
              </h2>
              <p className="mt-1.5">
                You can cancel auto-renewal at any time before your next billing
                date to prevent future charges. After canceling, your{" "}
                {PRICING.pro.name} benefits remain active until the end of your
                current paid billing period, after which your account smoothly
                reverts to the{" "}
                <Link
                  href="/pricing"
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  Free plan
                </Link>{" "}
                without losing your study history.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                5. Questions &amp; Support
              </h2>
              <p className="mt-1.5">
                Need help with a charge, duplicate order, or cancellation?
                Contact{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-emerald-300 underline hover:text-emerald-200"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                and we will be happy to assist.
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
