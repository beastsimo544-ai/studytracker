export const SITE_NAME = "StudyTracker";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://studytracker-e2vs.vercel.app"
).replace(/\/+$/, "");

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "beastsimo544@gmail.com";

export const OPERATOR_NAME =
  process.env.NEXT_PUBLIC_BUSINESS_NAME || "StudyTracker";

export const LEGAL_LAST_UPDATED = "November 28, 2026";

export const PADDLE_ENV =
  process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production";

export const PADDLE_CLIENT_TOKEN =
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";

export const PADDLE_PRICE_MONTHLY =
  process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY || "";

export const PADDLE_PRICE_YEARLY =
  process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY || "";

export const PRICING = {
  currency: "USD",
  free: {
    name: "Free",
    badge: "Starter",
    priceLabel: "$0",
    cadenceLabel: "forever",
    description:
      "Core focus tools, streaks, and friends leaderboards across web and Android.",
    features: [
      "Stopwatch, Pomodoro (25/5, 50/10, custom) & Focus Mode",
      "Up to 5 color-coded subjects & exam countdowns",
      "Daily study streaks & weekly stacked bar charts",
      "Friends leaderboard & live studying status",
      "Cloud sync across Web & Android APK",
    ],
  },
  pro: {
    name: "StudyTracker Pro",
    badge: "Most Popular",
    monthlyPrice: 3,
    monthlyPriceLabel: "$3",
    yearlyPrice: 30,
    yearlyPriceLabel: "$30",
    yearlyMonthlyEquivalent: "2.50",
    yearlySavingsPercent: 17,
    description:
      "Full analytics, distraction & screen-time guard, profile customization, and unlimited planning.",
    features: [
      "Everything in Free",
      "Unlimited subjects, exam countdowns & session notes",
      "Advanced analytics: monthly trend & 24-hour study charts",
      "Screen Time Guard (Chrome extension + Android app sync)",
      "Custom profile GIF banners, animated effects & themes",
      "Full Excel-ready CSV export & priority email support",
    ],
  },
} as const;
