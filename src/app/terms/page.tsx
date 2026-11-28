import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import {
  LEGAL_LAST_UPDATED,
  OPERATOR_NAME,
  PRICING,
  SITE_NAME,
  SUPPORT_EMAIL,
} from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and Conditions governing the use of ${SITE_NAME} web, browser extension, and Android apps, including StudyTracker Pro subscriptions billed via Paddle.`,
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-1 text-xs text-white/45">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>

          <div className="mt-6 space-y-5 text-xs leading-relaxed text-white/75 sm:text-sm">
            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                1. Agreement &amp; Service Description
              </h2>
              <p className="mt-1.5">
                By accessing or using {SITE_NAME} (operated by {OPERATOR_NAME}),
                including our web application, browser extension, and Android
                app, you agree to be bound by these Terms &amp; Conditions.{" "}
                {SITE_NAME} provides study timers, subject tracking, analytics,
                exam countdowns, friend leaderboards, and optional distraction &amp;
                screen-time tracking tools.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                2. Accounts, Eligibility &amp; Acceptable Use
              </h2>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                <li>
                  You are responsible for maintaining the confidentiality of your
                  account credentials and all activity under your account.
                </li>
                <li>
                  You must provide accurate information and be at least 13 years
                  old (or the minimum legal age in your jurisdiction) to create an
                  account.
                </li>
                <li>
                  You agree not to abuse, reverse-engineer, scrape, spam friends
                  with inappropriate content, or attempt to bypass access
                  controls or rate limits.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                3. Subscriptions, Pricing &amp; Merchant of Record (Paddle)
              </h2>
              <p className="mt-1.5">
                {SITE_NAME} offers a Free plan and paid{" "}
                <strong>{PRICING.pro.name}</strong> subscriptions (currently{" "}
                {PRICING.pro.monthlyPriceLabel}/month or{" "}
                {PRICING.pro.yearlyPriceLabel}/year USD, as displayed on our{" "}
                <Link
                  href="/pricing"
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  Pricing page
                </Link>
                ).
              </p>
              <p className="mt-2">
                Our order process is conducted by our online reseller{" "}
                <strong>Paddle.com</strong>. Paddle.com is the Merchant of
                Record for all our orders. Paddle handles all payment
                processing, invoicing, applicable VAT/sales taxes, and customer
                billing inquiries on our behalf.
              </p>
              <p className="mt-2">
                Paid subscriptions renew automatically at the end of each monthly
                or annual billing cycle unless canceled prior to the renewal date.
                You may cancel anytime via the link in your Paddle receipt or by
                contacting support; cancellation stops future renewals while
                preserving Pro access until the end of the current paid period.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                4. Refunds
              </h2>
              <p className="mt-1.5">
                All {PRICING.pro.name} purchases and renewals are covered by our
                14-day refund guarantee. Please review our full{" "}
                <Link
                  href="/refund"
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  Refund Policy
                </Link>{" "}
                for eligibility and instructions on requesting a refund.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                5. User Content &amp; Intellectual Property
              </h2>
              <p className="mt-1.5">
                You retain ownership of your study logs, subject names, notes,
                and uploaded profile content. By uploading avatars, banners, or
                quotes, you confirm you have the right to use that content. The{" "}
                {SITE_NAME} software, design, branding, and code remain the
                intellectual property of {OPERATOR_NAME}.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                6. Service Availability &amp; Account Termination
              </h2>
              <p className="mt-1.5">
                We strive for high uptime, but the service is provided on an
                &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. You may
                delete your account and associated data at any time via{" "}
                <strong>Settings &rarr; Delete Account</strong>. We reserve the
                right to suspend accounts that violate these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                7. Limitation of Liability
              </h2>
              <p className="mt-1.5">
                To the maximum extent permitted by applicable law, {OPERATOR_NAME}{" "}
                shall not be liable for any indirect, incidental, special, or
                consequential damages arising from your use of {SITE_NAME}.
                Nothing in these Terms limits consumer rights that cannot
                lawfully be excluded.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                8. Contact Information
              </h2>
              <p className="mt-1.5">
                If you have questions about these Terms, billing, or your
                account, contact us at{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-emerald-300 underline hover:text-emerald-200"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
