import Link from "next/link";
import MobileAppEntry from "@/components/mobile-app-entry";
import PricingPlans from "@/components/pricing-plans";
import SiteFooter from "@/components/site-footer";
import { PRICING, SITE_URL } from "@/lib/site-config";

const FAQS = [
  {
    question: "Is StudyTracker free to use?",
    answer: `Yes! StudyTracker's Free plan lets you track study time, run Pomodoro and Focus Mode timers, build daily streaks, and join friend leaderboards at no cost. You can optionally upgrade to StudyTracker Pro (${PRICING.pro.monthlyPriceLabel}/month or ${PRICING.pro.yearlyPriceLabel}/year) for unlimited subjects, advanced analytics, Screen Time Guard, and custom profile effects.`,
  },
  {
    question: "Does StudyTracker include a Pomodoro timer and Focus Mode?",
    answer:
      "Yes. Switch between an open-ended Stopwatch, customizable Pomodoro focus/break blocks (25/5, 50/10, or custom), and a pure black full-screen Focus Mode.",
  },
  {
    question: "Can I track study hours with my friends?",
    answer:
      "Yes! Pick a unique @username, add friends, see a live indicator when friends are studying right now, and compare daily and weekly study leaderboards.",
  },
  {
    question: "How do billing, taxes, and refunds work?",
    answer:
      "Payments, invoices, and applicable VAT/sales taxes are securely handled by Paddle.com as our Merchant of Record. You can cancel anytime, and all Pro purchases are backed by our 14-day money-back Refund Policy.",
  },
  {
    question: "Can I export my study history to Excel or Google Sheets?",
    answer:
      "Yes. Export your study sessions, subjects, durations, and notes to a clean UTF-8 CSV file anytime from History or Settings.",
  },
];

export default function Home() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "StudyTracker",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web, Android",
    url: SITE_URL,
    downloadUrl: `${SITE_URL}/StudyTracker.apk`,
    description:
      "Study time tracker with Pomodoro timer, color-coded subjects, daily study streaks, exam countdowns, screen-time guard, CSV export, and live friends leaderboards.",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "StudyTracker Pro",
        price: PRICING.pro.monthlyPrice.toFixed(2),
        priceCurrency: "USD",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <MobileAppEntry
      webFallback={
        <div className="flex flex-1 flex-col">
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify([softwareSchema, faqSchema]),
              }}
            />

            {/* HERO SECTION */}
            <section className="flex flex-col items-center justify-center py-12 text-center sm:py-20">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-300">
                Web &amp; Android Study App
              </span>

              <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl sm:leading-[1.12]">
                Study Tracker Built for Deep Focus &amp; Consistency
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
                Track study hours by subject, stay focused with Pomodoro &amp;
                Zen timers, count down to exams, and stay motivated on live
                leaderboards with friends.
              </p>

              <div className="mt-7 flex w-full max-w-xs flex-col items-center justify-center gap-2.5 sm:w-auto sm:max-w-none sm:flex-row sm:gap-3">
                <Link
                  href="/timer"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/90 sm:w-auto"
                >
                  Start Studying
                </Link>

                <Link
                  href="/download"
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 text-sm font-semibold text-white transition hover:bg-white/[0.08] sm:w-auto"
                >
                  Download Android App
                </Link>
              </div>

              <Link
                href="/pricing"
                className="mt-4 text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:underline sm:text-sm"
              >
                See Free vs. Pro pricing &rarr;
              </Link>
            </section>

            {/* CORE FEATURES GRID */}
            <section aria-labelledby="features-heading" className="py-8 sm:py-12">
              <div className="text-center">
                <h2
                  id="features-heading"
                  className="text-xl font-bold tracking-tight sm:text-2xl"
                >
                  Everything You Need to Track Your Study Time
                </h2>
                <p className="mt-1.5 text-xs text-white/50 sm:text-sm">
                  Simple enough for instant focus, powerful enough for an entire
                  semester.
                </p>
              </div>

              <div className="mt-7 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: "⏱️",
                    title: "Stopwatch, Pomodoro & Focus Mode",
                    desc: "Open-ended timing, 25/5 or 50/10 Pomodoro blocks with background notifications, or 1-click full-screen Focus Mode.",
                  },
                  {
                    icon: "🟢",
                    title: "Study With Friends & Live Status",
                    desc: "Add classmates by @username, see a live badge when friends are studying right now, and compare daily & weekly totals.",
                  },
                  {
                    icon: "🎨",
                    title: "Color-Coded Subjects & Analytics",
                    desc: "Organize courses by color and visualize progress across weekly stacked charts, monthly trends, and 24-hour study charts.",
                  },
                  {
                    icon: "🔥",
                    title: "Streaks, Reminders & Badges",
                    desc: "Build daily study habits with automatic streak tracking, evening streak-saver alerts, and 8 unlockable badges.",
                  },
                  {
                    icon: "📅",
                    title: "Exam Countdowns & Session Notes",
                    desc: "Pin upcoming exam dates to your dashboard, attach notes to sessions, and log past offline study hours anytime.",
                  },
                  {
                    icon: "📊",
                    title: "Screen Time Guard & CSV Export",
                    desc: "Monitor distracting apps or websites during focus timers and export your full study history to Excel-ready CSV.",
                  },
                ].map((f) => (
                  <article
                    key={f.title}
                    className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm">
                        {f.icon}
                      </span>
                      <h3 className="text-sm font-semibold sm:text-base">
                        {f.title}
                      </h3>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-white/60 sm:text-sm">
                      {f.desc}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {/* PRICING SECTION */}
            <section
              id="pricing"
              aria-labelledby="pricing-heading"
              className="py-8 sm:py-12"
            >
              <div className="text-center">
                <h2
                  id="pricing-heading"
                  className="text-xl font-bold tracking-tight sm:text-2xl"
                >
                  Simple Pricing for Every Student
                </h2>
                <p className="mt-1.5 text-xs text-white/50 sm:text-sm">
                  Start free forever, or unlock unlimited subjects, analytics,
                  and Screen Time Guard with StudyTracker Pro.
                </p>
              </div>

              <div className="mt-6">
                <PricingPlans compact />
              </div>

              <div className="mt-4 text-center">
                <Link
                  href="/pricing"
                  className="text-xs font-medium text-white/65 hover:text-white hover:underline"
                >
                  Full pricing details &amp; billing FAQ &rarr;
                </Link>
              </div>
            </section>

            {/* FAQ SECTION */}
            <section
              aria-labelledby="faq-heading"
              className="mx-auto w-full max-w-3xl py-8 sm:py-12"
            >
              <h2
                id="faq-heading"
                className="text-center text-xl font-bold tracking-tight sm:text-2xl"
              >
                Frequently Asked Questions
              </h2>

              <div className="mt-6 space-y-3">
                {FAQS.map((faq) => (
                  <div
                    key={faq.question}
                    className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5"
                  >
                    <h3 className="text-sm font-semibold sm:text-base">
                      {faq.question}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/60 sm:text-sm">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <SiteFooter />
        </div>
      }
    />
  );
}
