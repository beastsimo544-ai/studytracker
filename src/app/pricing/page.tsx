import type { Metadata } from "next";
import Link from "next/link";
import PricingPlans from "@/components/pricing-plans";
import SiteFooter from "@/components/site-footer";
import { PRICING, SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare StudyTracker Free and StudyTracker Pro ($3/month or $30/year). Track study hours, Pomodoro blocks, screen-time guard, and friend leaderboards.",
  alternates: {
    canonical: "/pricing",
  },
};

const BILLING_FAQS = [
  {
    question: "How does billing work?",
    answer: `StudyTracker Pro is available at ${PRICING.pro.monthlyPriceLabel}/month or ${PRICING.pro.yearlyPriceLabel}/year (USD). Payments, receipts, and applicable VAT or sales taxes are processed securely by Paddle.com, our Merchant of Record.`,
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes. You can cancel anytime before your next renewal date through your Paddle receipt link or by emailing our support team. You keep Pro access until the end of your current paid billing period.",
  },
  {
    question: "What is your refund policy?",
    answer:
      "We offer a straightforward 14-day money-back guarantee on StudyTracker Pro purchases and renewals. See our full Refund Policy for details.",
  },
  {
    question: "Does StudyTracker Pro work on both Web and Android?",
    answer:
      "Yes. Your account and Pro features sync automatically across the web app, Chrome Screen Time Guard extension, and the Android APK.",
  },
  {
    question: "Who do I contact for billing or account support?",
    answer: `Email us anytime at ${SUPPORT_EMAIL} and we will respond as quickly as possible.`,
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-14">
        {/* Header */}
        <section className="mx-auto max-w-2xl text-center">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-300">
            Simple, Transparent Pricing
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            StudyTracker Free vs. StudyTracker Pro
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-white/60 sm:text-base">
            Start tracking your study hours for free across web and Android, or
            upgrade to StudyTracker Pro for unlimited subjects, screen-time
            guarding, and advanced analytics.
          </p>
        </section>

        {/* Plans */}
        <section aria-label="Pricing plans" className="mt-8 sm:mt-10">
          <PricingPlans />
        </section>

        {/* Billing, Taxes & Refund Guarantee Info Card */}
        <section
          aria-labelledby="billing-assurance-heading"
          className="mx-auto mt-10 max-w-4xl rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7"
        >
          <h2
            id="billing-assurance-heading"
            className="text-base font-bold tracking-tight text-white sm:text-lg"
          >
            Billing, Taxes &amp; 14-Day Refund Guarantee
          </h2>
          <div className="mt-4 grid gap-4 text-xs leading-relaxed text-white/65 sm:grid-cols-3 sm:text-sm">
            <div>
              <h3 className="font-semibold text-white">Merchant of Record</h3>
              <p className="mt-1">
                All StudyTracker Pro orders are processed by{" "}
                <strong className="text-white/90">Paddle.com</strong>, which
                handles checkout, invoicing, and global VAT/sales tax
                compliance automatically.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">Payment Methods</h3>
              <p className="mt-1">
                Pay securely via major credit/debit cards, Apple Pay, Google
                Pay, or PayPal (depending on your region) with instant PDF tax
                invoices.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">14-Day Refunds</h3>
              <p className="mt-1">
                Not satisfied? Request a full refund within 14 days of purchase
                under our{" "}
                <Link
                  href="/refund"
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  Refund Policy
                </Link>{" "}
                or email{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Billing FAQ */}
        <section
          aria-labelledby="pricing-faq-heading"
          className="mx-auto mt-10 max-w-3xl sm:mt-12"
        >
          <h2
            id="pricing-faq-heading"
            className="text-center text-xl font-bold tracking-tight sm:text-2xl"
          >
            Pricing &amp; Billing FAQ
          </h2>
          <div className="mt-5 space-y-3">
            {BILLING_FAQS.map((item) => (
              <div
                key={item.question}
                className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5"
              >
                <h3 className="text-sm font-semibold text-white sm:text-base">
                  {item.question}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/60 sm:text-sm">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
