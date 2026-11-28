import Navbar from "@/components/navbar";
import NotificationProvider from "@/components/notification-provider";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://studytracker-e2vs.vercel.app"
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "StudyTracker — Study Time Tracker, Pomodoro Timer & Friends Leaderboard",
    template: "%s | StudyTracker",
  },
  description:
    "Online study tracker and Android app for students. Track study hours by subject, focus with Pomodoro & Zen timers, guard screen time, count down to exams, and compete with friends on live leaderboards.",
  keywords: [
    "study tracker",
    "study time tracker",
    "free study tracker",
    "study timer",
    "pomodoro study timer",
    "study with friends leaderboard",
    "student productivity app",
    "exam countdown tracker",
    "studytracker android app",
    "suivi temps d'étude",
  ],
  applicationName: "StudyTracker",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "StudyTracker",
    title:
      "StudyTracker — Study Time Tracker, Pomodoro Timer & Friends Leaderboard",
    description:
      "Track study hours by subject, stay consistent with streaks & Pomodoro blocks, and see what your friends are studying live.",
    images: [
      {
        url: "/playstore-icon-512.png",
        width: 512,
        height: 512,
        alt: "StudyTracker App Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title:
      "StudyTracker — Study Time Tracker, Pomodoro Timer & Friends Leaderboard",
    description:
      "Track study hours, focus with Pomodoro & Zen Mode, and compete on daily & weekly study leaderboards with friends.",
    images: ["/playstore-icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-[#09090b] pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-[#f4f4f5] md:pb-0">
        <NotificationProvider>
          <Navbar />
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
