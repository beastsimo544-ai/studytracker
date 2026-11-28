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
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
      {/* HERO DOWNLOAD CARD */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/playstore-icon-512.png"
            alt="StudyTracker App Icon"
            className="h-16 w-16 shrink-0 rounded-2xl border border-white/12 object-cover shadow-xl sm:h-20 sm:w-20"
          />

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                Android App · v1.0
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-white/60">
                Android 7.0+ · ~5.3 MB
              </span>
            </div>

            <h1 className="mt-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Download StudyTracker
            </h1>

            <p className="mt-1.5 text-xs leading-relaxed text-white/60 sm:text-sm">
              Install StudyTracker directly on your Android phone for distraction-free
              focus timers, native Pomodoro &amp; exam reminders, live friend
              leaderboards, and instant CSV exports.
            </p>
          </div>
        </div>

        {isNativeApp ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <div>
              <p className="text-xs font-semibold text-emerald-300 sm:text-sm">
                You&apos;re using the StudyTracker Android App ✓
              </p>
              <p className="mt-0.5 text-xs text-white/70">
                Want to invite a friend? Copy the download link below and send
                it to them!
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyDownloadLink}
              className="h-10 rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 sm:text-sm"
            >
              Copy Link for a Friend
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href="/StudyTracker.apk"
              download="StudyTracker.apk"
              onClick={() =>
                toast.info(
                  "Downloading StudyTracker.apk...",
                  "Open the downloaded APK on your Android phone to install."
                )
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/90"
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
              className="h-11 rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-medium transition hover:bg-white/[0.06]"
            >
              Copy Share Link
            </button>

            <Link
              href="/timer"
              className="inline-flex h-10 items-center justify-center px-3 text-xs font-medium text-white/60 transition hover:text-white sm:text-sm"
            >
              Or use in browser →
            </Link>
          </div>
        )}
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
          <p className="text-base">⏱️</p>
          <h2 className="mt-1.5 text-sm font-semibold">Focus &amp; Pomodoro</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            Full-screen Focus Mode, Pomodoro blocks, screen wake-lock, and
            background lock-screen notifications.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
          <p className="text-base">🟢</p>
          <h2 className="mt-1.5 text-sm font-semibold">Live Friends &amp; Streaks</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            See when friends are studying in real time, compare daily &amp;
            weekly leaderboards, and unlock badges.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
          <p className="text-base">📊</p>
          <h2 className="mt-1.5 text-sm font-semibold">Synced Cloud + CSV</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            Your study history syncs automatically between web and Android, and
            exports to Excel-ready CSV anytime.
          </p>
        </div>
      </section>

      {/* 3-STEP INSTALL INSTRUCTIONS */}
      <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-base font-semibold">How to Install on Android</h2>

        <ol className="mt-3.5 space-y-2.5 text-xs leading-relaxed text-white/75 sm:text-sm">
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold text-white">
              1
            </span>
            <span>
              Tap <strong>Download Android APK</strong> above to save{" "}
              <code>StudyTracker.apk</code> to your phone.
            </span>
          </li>

          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold text-white">
              2
            </span>
            <span>
              Open the downloaded file. If prompted by Android, enable{" "}
              <strong>Allow from this source</strong> (and if Play Protect asks,
              tap <strong>More details → Install anyway</strong>).
            </span>
          </li>

          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold text-white">
              3
            </span>
            <span>
              Sign in with your StudyTracker account and enable notifications
              under <strong>Settings</strong>!
            </span>
          </li>
        </ol>
      </section>

      {/* BROWSER EXTENSION DOWNLOAD */}
      <section
        id="extension"
        className="mt-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                Browser Extension · PC &amp; Mac
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-white/60">
                Chrome · Edge · Brave
              </span>
            </div>

            <h2 className="mt-2.5 text-lg font-bold tracking-tight sm:text-xl">
              StudyTracker Screen Time Guard
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/60 sm:text-sm">
              Automatically tracks active website screen time, alerts you when
              distractions cut into study sessions, and syncs directly to your
              Dashboard Green→Red risk meter.
            </p>
          </div>

          <a
            href="/StudyTracker-Extension.zip"
            download="StudyTracker-Extension.zip"
            onClick={() =>
              toast.info(
                "Downloading StudyTracker-Extension.zip...",
                "Unzip it, then load unpacked in chrome://extensions."
              )
            }
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 sm:text-sm"
          >
            Download Extension (.zip)
          </a>
        </div>

        <ol className="mt-4 space-y-2 border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-white/75 sm:text-sm">
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold text-white">
              1
            </span>
            <span>
              Download and extract <code>StudyTracker-Extension.zip</code> to a
              folder on your computer.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold text-white">
              2
            </span>
            <span>
              Open <code>chrome://extensions</code> (or{" "}
              <code>edge://extensions</code>), enable{" "}
              <strong>Developer mode</strong> in the top-right, click{" "}
              <strong>Load unpacked</strong>, and select the extracted folder.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] font-bold text-white">
              3
            </span>
            <span>
              Click the StudyTracker extension icon and sign in once to sync PC
              sites live to your Dashboard.
            </span>
          </li>
        </ol>
      </section>
    </main>
  );
}
