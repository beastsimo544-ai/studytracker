import type { Metadata } from "next";
import SiteFooter from "@/components/site-footer";
import {
  LEGAL_LAST_UPDATED,
  SITE_NAME,
  SUPPORT_EMAIL,
} from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${SITE_NAME}, explaining what data we collect, how study tracking and Paddle payment processing work, and how to export or delete your account.`,
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-1 text-xs text-white/45">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>

          <div className="mt-6 space-y-5 text-xs leading-relaxed text-white/75 sm:text-sm">
            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                1. Overview
              </h2>
              <p className="mt-1.5">
                {SITE_NAME} helps students track study sessions, organize
                subjects, minimize distractions, and compare weekly study
                progress with friends. We respect your privacy and only collect
                the minimum data needed to provide these features.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                2. Data We Collect
              </h2>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                <li>
                  <strong>Account Information:</strong> Your email address,
                  encrypted authentication credentials (managed by Supabase
                  Auth), and optional username, profile photo, and profile
                  customization settings.
                </li>
                <li>
                  <strong>Study Activity:</strong> Subjects you create, study
                  session durations and timestamps, daily study goals, exam
                  countdowns, and friend connections you initiate or accept.
                </li>
                <li>
                  <strong>Optional Screen-Time Guard Data:</strong> If you
                  explicitly enable our Chrome browser extension or Android
                  Usage Access tracking, {SITE_NAME} logs active website domains
                  or app usage during active study timer windows to display your
                  focus score on your Dashboard.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                3. Payment Processing (Paddle)
              </h2>
              <p className="mt-1.5">
                Paid subscriptions are processed by <strong>Paddle.com</strong>{" "}
                as our Merchant of Record. When you upgrade to StudyTracker Pro,
                Paddle collects and processes your payment details, billing
                address, and tax information directly under Paddle&apos;s{" "}
                <a
                  href="https://www.paddle.com/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-300 underline hover:text-emerald-200"
                >
                  Privacy Policy
                </a>
                . {SITE_NAME} never sees or stores your full credit card or
                payment credentials; we only store your subscription status, plan
                tier, and Paddle customer/subscription identifiers to unlock Pro
                features on your account.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                4. How Your Data Is Used &amp; Shared
              </h2>
              <p className="mt-1.5">
                Your data is used solely to operate, secure, and sync your study
                progress across devices. If you accept a friend request, your
                chosen username, avatar, profile banner/effects, and study
                session totals are visible to your accepted friends on the
                Friends Leaderboard. We never sell your personal data or share
                it with third-party advertisers.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                5. Data Retention, Security &amp; Account Deletion
              </h2>
              <p className="mt-1.5">
                All data is transmitted over HTTPS and protected by Supabase Row
                Level Security (RLS). We retain your data while your account is
                active. You can export your study history to CSV, delete
                individual study sessions, subjects, and friendships at any time,
                or permanently delete your entire account and all associated data
                directly inside the app under{" "}
                <strong>Settings &rarr; Delete Account</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-white sm:text-base">
                6. Contact Us
              </h2>
              <p className="mt-1.5">
                For privacy questions, data requests, or support, email us at{" "}
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
