"use client";

import { useMemo, useState } from "react";

type SessionInput = {
  duration: number;
  created_at: string;
};

type TimeRange = "today" | "week" | "month" | "all";

const RANGE_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

const LABELED_HOURS = new Set([0, 3, 6, 9, 12, 15, 18, 21, 23]);

const DAY_PERIODS = [
  { key: "night", label: "Night", range: "00–06", start: 0, end: 6 },
  { key: "morning", label: "Morning", range: "06–12", start: 6, end: 12 },
  { key: "afternoon", label: "Afternoon", range: "12–18", start: 12, end: 18 },
  { key: "evening", label: "Evening", range: "18–24", start: 18, end: 24 },
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHourRange(hour: number): string {
  return `${pad2(hour)}:00 – ${pad2((hour + 1) % 24)}:00`;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe === 0) return "0m";
  if (safe < 60) return `${safe}s`;
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatYTick(seconds: number): string {
  if (seconds <= 0) return "0m";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hrs = seconds / 3600;
  return Number.isInteger(hrs) ? `${hrs}h` : `${hrs.toFixed(1)}h`;
}

function computeNiceAxisMaxSeconds(rawMaxSeconds: number): number {
  if (rawMaxSeconds <= 0) return 3600;
  if (rawMaxSeconds <= 1800) return 1800; // 30m
  if (rawMaxSeconds <= 3600) return 3600; // 1h
  const rawHours = rawMaxSeconds / 3600;
  if (rawHours <= 2) return 2 * 3600;
  if (rawHours <= 4) return 4 * 3600;
  if (rawHours <= 6) return 6 * 3600;
  if (rawHours <= 10) return 10 * 3600;
  if (rawHours <= 16) return 16 * 3600;
  if (rawHours <= 24) return 24 * 3600;
  return Math.ceil(rawHours / 10) * 10 * 3600;
}

export default function StudyHoursByDayChart({
  sessions,
}: {
  sessions: SessionInput[];
}) {
  const [range, setRange] = useState<TimeRange>("all");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const {
    hourlySeconds,
    totalSeconds,
    peakHour,
    axisMaxSeconds,
    periodSummaries,
  } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayStartMs = todayStart.getTime();

    const weekStart = new Date(todayStart);
    const day = todayStart.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    weekStart.setDate(todayStart.getDate() - daysSinceMonday);
    const weekStartMs = weekStart.getTime();

    const monthStartMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();

    const rangeStartMs =
      range === "today"
        ? todayStartMs
        : range === "week"
          ? weekStartMs
          : range === "month"
            ? monthStartMs
            : null;

    const buckets = new Array<number>(24).fill(0);

    for (const s of sessions) {
      if (!s || s.duration <= 0) continue;
      const endMs = new Date(s.created_at).getTime();
      if (Number.isNaN(endMs)) continue;
      if (rangeStartMs !== null && endMs < rangeStartMs) continue;

      const clampedDurMs = Math.min(Number(s.duration) || 0, 86400) * 1000;
      let cursor = endMs - clampedDurMs;
      if (rangeStartMs !== null) {
        cursor = Math.max(rangeStartMs, cursor);
      }

      while (cursor < endMs) {
        const hourDate = new Date(cursor);
        const hour = hourDate.getHours();
        const nextHourBoundary = new Date(
          hourDate.getFullYear(),
          hourDate.getMonth(),
          hourDate.getDate(),
          hour + 1,
          0,
          0,
          0
        ).getTime();
        const segEnd = Math.min(endMs, nextHourBoundary);
        if (segEnd <= cursor) break;
        buckets[hour] += (segEnd - cursor) / 1000;
        cursor = segEnd;
      }
    }

    if (range === "today") {
      for (let h = 0; h < 24; h += 1) {
        buckets[h] = Math.min(3600, buckets[h]);
      }
    }

    const total = buckets.reduce((sum, v) => sum + v, 0);
    let maxHourIdx: number | null = null;
    let maxVal = 0;
    for (let h = 0; h < 24; h += 1) {
      if (buckets[h] > maxVal) {
        maxVal = buckets[h];
        maxHourIdx = h;
      }
    }

    const axisMax =
      range === "today" ? 3600 : computeNiceAxisMaxSeconds(maxVal);

    const periods = DAY_PERIODS.map((p) => {
      let secs = 0;
      for (let h = p.start; h < p.end; h += 1) {
        secs += buckets[h];
      }
      const sharePct = total > 0 ? Math.round((secs / total) * 100) : 0;
      return {
        ...p,
        seconds: secs,
        sharePct,
      };
    });

    const maxPeriodSecs = Math.max(...periods.map((p) => p.seconds), 0);

    return {
      hourlySeconds: buckets,
      totalSeconds: total,
      peakHour: maxHourIdx,
      axisMaxSeconds: axisMax,
      periodSummaries: periods.map((p) => ({
        ...p,
        isTop: maxPeriodSecs > 0 && p.seconds === maxPeriodSecs,
      })),
    };
  }, [sessions, range]);

  const focusedHour = selectedHour ?? peakHour;
  const focusedSeconds = focusedHour !== null ? hourlySeconds[focusedHour] : 0;
  const focusedPct =
    totalSeconds > 0 ? Math.round((focusedSeconds / totalSeconds) * 100) : 0;

  return (
    <section className="mt-4 sm:mt-5">
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        {/* Header + Range Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight text-white">
                Study hours of the day
              </h2>
              {peakHour !== null && (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300 tabular-nums">
                  Peak {formatHourRange(peakHour)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Your focus distribution across all 24 clock hours
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex h-8 items-center rounded-xl border border-white/10 bg-[#09090b] p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setRange(opt.key);
                    setSelectedHour(null);
                  }}
                  className={`h-7 rounded-lg px-2.5 text-xs font-medium transition ${
                    range === opt.key
                      ? "bg-white text-black font-semibold"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Readout Pill */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
          <div
            aria-live="polite"
            className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-[#09090b] px-3 py-1.5 text-xs tabular-nums"
          >
            {focusedHour !== null ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="font-mono font-semibold text-white">
                  {formatHourRange(focusedHour)}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="font-mono font-semibold text-emerald-300">
                  {formatDuration(focusedSeconds)}
                </span>
                <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                  {focusedPct}% of {range === "all" ? "total" : range}
                </span>
              </>
            ) : (
              <span className="text-zinc-400">
                No study sessions recorded for this period yet.
              </span>
            )}
          </div>

          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
            Total · {formatDuration(totalSeconds)}
          </span>
        </div>

        {/* 24-Hour Vertical Bar Chart */}
        <div className="mt-5 flex gap-2.5 sm:gap-3">
          {/* Y-Axis Ticks */}
          <div className="flex h-36 flex-col justify-between pb-5 text-right font-mono text-[10px] text-zinc-500 tabular-nums select-none sm:h-44">
            <span>{formatYTick(axisMaxSeconds)}</span>
            <span>{formatYTick(axisMaxSeconds / 2)}</span>
            <span>0m</span>
          </div>

          {/* Grid + 24 Bars */}
          <div className="relative flex-1">
            {/* Horizontal Guide Lines */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-5 top-0 flex flex-col justify-between"
            >
              <div className="border-t border-dashed border-white/[0.06]" />
              <div className="border-t border-dashed border-white/[0.06]" />
              <div className="border-t border-white/[0.1]" />
            </div>

            <div
              onMouseLeave={() => setSelectedHour(null)}
              className="relative z-10 grid h-36 items-end gap-1 sm:h-44 sm:gap-1.5"
              style={{
                gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
              }}
            >
              {hourlySeconds.map((secs, hour) => {
                const ratio =
                  axisMaxSeconds > 0 ? Math.min(1, secs / axisMaxSeconds) : 0;
                const heightPct = secs > 0 ? Math.max(ratio * 100, 6) : 0;
                const isPeak = peakHour === hour && secs > 0;
                const isFocused = focusedHour === hour;

                return (
                  <button
                    key={hour}
                    type="button"
                    onMouseEnter={() => setSelectedHour(hour)}
                    onFocus={() => setSelectedHour(hour)}
                    onClick={() =>
                      setSelectedHour((prev) => (prev === hour ? null : hour))
                    }
                    aria-label={`${formatHourRange(hour)}: ${formatDuration(secs)}`}
                    title={`${formatHourRange(hour)} — ${formatDuration(secs)}`}
                    className="group flex h-full flex-col items-center justify-end focus:outline-none"
                  >
                    <div className="flex w-full flex-1 items-end justify-center pb-1">
                      {secs > 0 ? (
                        <div
                          className={`w-full max-w-4 rounded-t-sm transition-all duration-150 ${
                            isPeak
                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.35)]"
                              : ratio >= 0.5
                                ? "bg-emerald-500/85"
                                : "bg-emerald-700/80"
                          } ${
                            isFocused
                              ? "brightness-125 ring-1 ring-white/60"
                              : "group-hover:brightness-115"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      ) : (
                        <div
                          className={`h-[2px] w-full max-w-4 rounded-full transition ${
                            isFocused
                              ? "bg-white/35"
                              : "bg-white/[0.08] group-hover:bg-white/20"
                          }`}
                        />
                      )}
                    </div>

                    <span
                      className={`h-4 font-mono text-[9px] leading-none tabular-nums sm:text-[10px] ${
                        isFocused
                          ? "font-semibold text-white"
                          : LABELED_HOURS.has(hour)
                            ? "text-zinc-500"
                            : "text-transparent"
                      }`}
                    >
                      {pad2(hour)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4-Part Time-of-Day Breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
          {periodSummaries.map((period) => (
            <div
              key={period.key}
              className={`rounded-xl border px-3 py-2.5 ${
                period.isTop
                  ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                  : "border-white/[0.07] bg-[#09090b]"
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="font-medium text-white/80">
                  {period.label}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {period.range}
                </span>
              </div>

              <div className="mt-1 flex items-baseline justify-between gap-2 tabular-nums">
                <span className="font-mono text-sm font-bold text-white">
                  {formatDuration(period.seconds)}
                </span>
                <span className="text-[10px] font-medium text-zinc-400">
                  {period.sharePct}%
                </span>
              </div>

              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`h-full rounded-full transition-all ${
                    period.isTop ? "bg-emerald-400" : "bg-emerald-600/75"
                  }`}
                  style={{
                    width: `${
                      period.seconds > 0 ? Math.max(period.sharePct, 4) : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
