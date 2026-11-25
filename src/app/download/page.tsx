"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNotifications } from "@/components/notification-provider";

export default function DownloadPage() {
  const { toast } = useNotifications();
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    const detectPlatform = async () => {
      await Promise.resolve();
      setIsNativeApp(Capacitor.isNativePlatform());
    };
    detectPlatform();
  }, []);

  const handleCopyDownloadLink = async () => {
    try {
      const url =
        typeof window !== "undefined" &&
        window.location.origin.startsWith("http") &&
        !window.location.origin.includes("localhost")
          ? `${window.location.origin}/download`
          : "https://studytracker-e2vs.vercel.app/download";

      await navigator.clipboard.writeText(url);
      toast.success("Download link copied!", "Send it to your friends.");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      {/* HERO DOWNLOAD CARD */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/playstore-icon-512.png"
            alt="StudyTracker App Icon"
            className="h-24 w-24 shrink-0 rounded-3xl border border-white/15 object-cover shadow-2xl"
          />

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-300">
                Android App · v1.0
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-white/60">
                Android 7.0+ · ~5.3 MB
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Download StudyTracker
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-white/65 sm:text-base">
              Install StudyTracker directly on your Android phone for distraction-free
              focus timers, native Pomodoro &amp; exam reminders, live friend
              leaderboards, and instant CSV exports.
            </p>
          </div>
        </div>

        {isNativeApp ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                You&apos;re using the StudyTracker Android App ✓
              </p>
              <p className="mt-0.5 text-xs text-white/70">
                Want to invite a friend? Copy the download page link below and
                send it to them!
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyDownloadLink}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Copy Link for a Friend
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/StudyTracker.apk"
              download="StudyTracker.apk"
              onClick={() =>
                toast.info(
                  "Downloading StudyTracker.apk...",
                  "Open the downloaded APK on your Android phone to install."
                )
              }
              className="inline-flex items-center gap-2.5 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download Android APK</span>
            </a>

            <button
              type="button"
              onClick={handleCopyDownloadLink}
              className="rounded-xl border border-white/20 px-5 py-3.5 text-sm font-medium transition hover:bg-white/5"
            >
              Copy Share Link
            </button>

            <Link
              href="/timer"
              className="rounded-xl px-4 py-3.5 text-sm text-white/60 transition hover:text-white"
            >
              Or use in browser →
            </Link>
          </div>
        )}
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-lg">⏱️</p>
          <h2 className="mt-2 font-semibold">Focus &amp; Pomodoro</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Full-screen Focus Mode, Pomodoro blocks, screen wake-lock, and
            background lock-screen notifications.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-lg">🟢</p>
          <h2 className="mt-2 font-semibold">Live Friends &amp; Streaks</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            See when friends are studying in real time, compare daily &amp;
            weekly leaderboards, and unlock badges.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-lg">📊</p>
          <h2 className="mt-2 font-semibold">Synced Cloud + CSV Export</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Your study history syncs automatically between web and Android, and
            exports to Excel-ready CSV anytime.
          </p>
        </div>
      </section>

      {/* 3-STEP INSTALL INSTRUCTIONS */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">How to Install on Android</h2>

        <ol className="mt-4 space-y-3 text-sm text-white/75">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
              1
            </span>
            <span>
              Tap <strong>Download Android APK</strong> above to save{" "}
              <code>StudyTracker.apk</code> to your phone.
            </span>
          </li>

          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
              2
            </span>
            <span>
              Open the downloaded file. If prompted by Android, enable{" "}
              <strong>Allow from this source</strong> (and if Play Protect asks,
              tap <strong>More details → Install anyway</strong>).
            </span>
          </li>

          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
              3
            </span>
            <span>
              Sign in with your StudyTracker account and enable notifications
              under <strong>Settings</strong>!
            </span>
          </li>
        </ol>
      </section>
    </main>
  );
}
