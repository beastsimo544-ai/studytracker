"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import {
  isAndroidNative,
  openAndroidUsageSettings,
  syncAndroidUsageToSupabase,
} from "@/lib/android-screen-time";
import { sendInstantSystemNotification } from "@/lib/notifications";
import {
  evaluateScreenTimeRisk,
  formatScreenDuration,
  getTodayLocalDateKey,
  loadCategoryOverrides,
  recomputeTotalsWithOverrides,
  saveCategoryOverride,
  type ScreenTimeCategory,
  type ScreenTimeLogRow,
  type TrackedAppEntry,
} from "@/lib/screen-time";
import { supabase } from "@/lib/supabase";

const CATEGORY_CYCLE: Record<ScreenTimeCategory, ScreenTimeCategory> = {
  distracting: "study",
  study: "neutral",
  neutral: "distracting",
};

const CATEGORY_BADGE: Record<
  ScreenTimeCategory,
  { label: string; className: string }
> = {
  distracting: {
    label: "Distracting",
    className: "border-red-500/35 bg-red-500/15 text-red-300",
  },
  study: {
    label: "Study",
    className: "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
  },
  neutral: {
    label: "Neutral",
    className: "border-white/15 bg-white/[0.06] text-white/75",
  },
};

export default function ScreenTimeCard({
  userId,
  todayStudySeconds,
  dailyGoalSeconds,
}: {
  userId: string | null;
  todayStudySeconds: number;
  dailyGoalSeconds: number;
}) {
  const { toast } = useNotifications();
  const [isAndroid, setIsAndroid] = useState(false);
  const [androidPermissionGranted, setAndroidPermissionGranted] =
    useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "android" | "extension"
  >("all");
  const [overrides, setOverrides] = useState<
    Record<string, ScreenTimeCategory>
  >({});

  const [androidApps, setAndroidApps] = useState<TrackedAppEntry[]>([]);
  const [extensionApps, setExtensionApps] = useState<TrackedAppEntry[]>([]);
  const [hasExtensionData, setHasExtensionData] = useState(false);

  const loadAllUsage = useCallback(async () => {
    if (!userId) return;
    setIsRefreshing(true);

    const nativeAndroid = isAndroidNative();
    setIsAndroid(nativeAndroid);
    const localOverrides = loadCategoryOverrides();
    setOverrides(localOverrides);

    let nextAndroidApps: TrackedAppEntry[] = [];
    let tableMissing = false;

    if (nativeAndroid) {
      const nativeRes = await syncAndroidUsageToSupabase(userId);
      setAndroidPermissionGranted(nativeRes.granted);
      if (nativeRes.setupRequired) tableMissing = true;
      if (nativeRes.granted) {
        nextAndroidApps = nativeRes.apps;
      }
    }

    const todayKey = getTodayLocalDateKey();
    const { data, error } = await supabase
      .from("screen_time_logs")
      .select(
        "source, log_date, total_seconds, distracting_seconds, study_seconds, apps"
      )
      .eq("user_id", userId)
      .eq("log_date", todayKey);

    if (error) {
      if (
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message.includes("screen_time_logs")
      ) {
        tableMissing = true;
      }
    } else if (data) {
      const rows = data as ScreenTimeLogRow[];
      const extRow = rows.find((r) => r.source === "extension");
      const andRow = rows.find((r) => r.source === "android");

      if (extRow && Array.isArray(extRow.apps)) {
        setHasExtensionData(true);
        setExtensionApps(
          extRow.apps.map((a) => ({
            ...a,
            source: "extension",
          }))
        );
      } else {
        setHasExtensionData(false);
        setExtensionApps([]);
      }

      if (!nativeAndroid && andRow && Array.isArray(andRow.apps)) {
        nextAndroidApps = andRow.apps.map((a) => ({
          ...a,
          source: "android",
        }));
      }
    }

    setAndroidApps(nextAndroidApps);
    setSetupRequired(tableMissing);
    setIsRefreshing(false);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAllUsage();
    }, 0);

    const handleResume = () => {
      loadAllUsage();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadAllUsage();
      }
    };

    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadAllUsage]);

  const combined = useMemo(() => {
    const merged = recomputeTotalsWithOverrides(
      [...androidApps, ...extensionApps],
      overrides
    );
    const filteredApps =
      sourceFilter === "all"
        ? merged.apps
        : merged.apps.filter((a) => a.source === sourceFilter);

    const risk = evaluateScreenTimeRisk({
      distractingSeconds: merged.distractingSeconds,
      totalScreenSeconds: merged.totalSeconds,
      studySecondsToday: todayStudySeconds,
      dailyGoalSeconds,
    });

    return {
      ...merged,
      filteredApps,
      risk,
    };
  }, [
    androidApps,
    extensionApps,
    overrides,
    sourceFilter,
    todayStudySeconds,
    dailyGoalSeconds,
  ]);

  // Throttled daily alert when Screen Time reaches Dangerous or Extremely Dangerous
  useEffect(() => {
    if (
      combined.totalSeconds === 0 ||
      (combined.risk.level !== "danger" && combined.risk.level !== "critical")
    ) {
      return;
    }
    const todayKey = getTodayLocalDateKey();
    const alertKey = `studytracker_screentime_alert_${todayKey}`;
    try {
      if (window.localStorage.getItem(alertKey) === combined.risk.level) {
        return;
      }
      window.localStorage.setItem(alertKey, combined.risk.level);
    } catch {
      return;
    }

    toast.error(
      `Screen Time Alert: ${combined.risk.label}`,
      `${formatScreenDuration(combined.distractingSeconds)} of distracting apps/sites today is hurting your study goal.`
    );

    sendInstantSystemNotification({
      title: `StudyTracker: ${combined.risk.label} Screen Time`,
      body: `${formatScreenDuration(combined.distractingSeconds)} distracted today — open your Focus Timer to protect your streak.`,
    });
  }, [
    combined.totalSeconds,
    combined.distractingSeconds,
    combined.risk.level,
    combined.risk.label,
    toast,
  ]);

  const handleToggleCategory = async (app: TrackedAppEntry) => {
    const nextCat = CATEGORY_CYCLE[app.category];
    const nextOverrides = saveCategoryOverride(app.id, nextCat);
    setOverrides(nextOverrides);

    if (!userId) return;

    const sourceList =
      app.source === "android"
        ? recomputeTotalsWithOverrides(androidApps, nextOverrides)
        : recomputeTotalsWithOverrides(extensionApps, nextOverrides);

    await supabase.from("screen_time_logs").upsert(
      {
        user_id: userId,
        log_date: getTodayLocalDateKey(),
        source: app.source,
        total_seconds: sourceList.totalSeconds,
        distracting_seconds: sourceList.distractingSeconds,
        study_seconds: sourceList.studySeconds,
        apps: sourceList.apps.slice(0, 20),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,log_date,source" }
    );
  };

  const hasAnyData = combined.apps.length > 0;

  return (
    <section className="mt-6 sm:mt-8">
      <div
        className={`rounded-2xl border bg-[#111113] p-5 transition sm:p-6 ${combined.risk.borderClass}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold sm:text-lg">
                Screen Time &amp; Study Impact
              </h2>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${combined.risk.badgeClass}`}
              >
                {combined.risk.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/60">
              {combined.risk.headline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(combined.risk.level === "warning" ||
              combined.risk.level === "danger" ||
              combined.risk.level === "critical") && (
              <Link
                href="/timer"
                className="inline-flex h-8 items-center rounded-xl bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90"
              >
                Start Focus Timer →
              </Link>
            )}

            <button
              type="button"
              disabled={isRefreshing}
              onClick={loadAllUsage}
              className="h-8 rounded-xl border border-white/15 bg-[#09090b] px-3 text-xs font-medium text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-50"
            >
              {isRefreshing ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Green -> Red Danger Meter */}
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#09090b] p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-white/70">
              Distraction Risk Level
            </span>
            <span
              className="font-mono font-bold tabular-nums"
              style={{ color: combined.risk.barColor }}
            >
              {combined.risk.score} / 100
            </span>
          </div>

          <div className="relative mt-2.5 h-2.5 w-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-500 via-orange-500 to-rose-600">
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#09090b] bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)] transition-all duration-300"
              style={{ left: `${combined.risk.score}%` }}
            />
          </div>

          <div className="mt-1.5 flex justify-between text-[10px] text-white/45">
            <span>Safe</span>
            <span>Moderate</span>
            <span>High Risk</span>
            <span>Dangerous</span>
            <span>Critical</span>
          </div>

          <p className="mt-2.5 text-xs text-white/65">{combined.risk.advice}</p>
        </div>

        {/* 3 Summary Metrics */}
        <div className="mt-3.5 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-[#09090b] p-3">
            <p className="text-[11px] text-white/50">Distracting Time</p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums sm:text-lg">
              {formatScreenDuration(combined.distractingSeconds)}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#09090b] p-3">
            <p className="text-[11px] text-white/50">Tracked Screen</p>
            <p className="mt-1 font-mono text-base font-bold tabular-nums sm:text-lg">
              {formatScreenDuration(combined.totalSeconds)}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#09090b] p-3">
            <p className="text-[11px] text-white/50">Studied Today</p>
            <p className="mt-1 font-mono text-base font-bold text-emerald-300 tabular-nums sm:text-lg">
              {formatScreenDuration(todayStudySeconds)}
            </p>
          </div>
        </div>

        {/* Source Setup Prompts */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {isAndroid && !androidPermissionGranted && (
            <button
              type="button"
              onClick={openAndroidUsageSettings}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20"
            >
              📱 Enable Android App Usage Access
            </button>
          )}

          {isAndroid && androidPermissionGranted && (
            <span className="inline-flex h-7 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-300">
              📱 Phone apps active
            </span>
          )}

          {hasExtensionData ? (
            <span className="inline-flex h-7 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-300">
              💻 Browser extension synced
            </span>
          ) : (
            <Link
              href="/download#extension"
              className="inline-flex h-7 items-center rounded-full border border-white/15 bg-[#09090b] px-3 text-[11px] font-medium text-white/75 transition hover:border-white/30 hover:text-white"
            >
              💻 Connect Browser Extension →
            </Link>
          )}
        </div>

        {setupRequired && (
          <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-200">
            Run <code>supabase-screen-time-setup.sql</code> in your{" "}
            <strong>Supabase Dashboard → SQL Editor</strong> to sync screen time
            between the browser extension, Android app, and web dashboard.
          </div>
        )}

        {/* Apps & Websites Breakdown */}
        {hasAnyData && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-white/80">
                Top Apps &amp; Sites Today{" "}
                <span className="font-normal text-white/45">
                  · tap pill to reclassify
                </span>
              </p>

              <div className="inline-flex h-7 items-center rounded-lg border border-white/10 bg-[#09090b] p-0.5 text-[11px]">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "android", label: "📱 Phone" },
                    { key: "extension", label: "💻 Browser" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSourceFilter(tab.key)}
                    className={`rounded-md px-2 py-0.5 font-medium transition ${
                      sourceFilter === tab.key
                        ? "bg-white text-black"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090b]">
              {combined.filteredApps.slice(0, 8).map((app) => {
                const catStyle = CATEGORY_BADGE[app.category];
                return (
                  <div
                    key={`${app.source}-${app.id}`}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true">
                        {app.source === "android" ? "📱" : "💻"}
                      </span>
                      <span className="truncate font-medium text-white">
                        {app.name}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono font-semibold text-white/85 tabular-nums">
                        {formatScreenDuration(app.seconds)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleCategory(app)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-85 ${catStyle.className}`}
                      >
                        {catStyle.label}
                      </button>
                    </div>
                  </div>
                );
              })}

              {combined.filteredApps.length === 0 && (
                <p className="px-3.5 py-4 text-center text-xs text-white/45">
                  No usage recorded from this source yet today.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
