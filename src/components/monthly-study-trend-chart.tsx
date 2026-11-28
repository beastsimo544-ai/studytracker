"use client";

import { useId, useMemo, useState } from "react";

type MonthlySession = {
  duration: number;
  created_at: string;
};

type MonthPoint = {
  index: number;
  label: string;
  seconds: number;
  isForecast: boolean;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function computeNiceMaxHours(rawMaxHours: number): number {
  const safe = Math.max(1, rawMaxHours);
  if (safe <= 4) return 4;
  if (safe <= 8) return 8;
  if (safe <= 12) return 12;
  if (safe <= 20) return 20;
  if (safe <= 40) return 40;
  if (safe <= 60) return 60;
  if (safe <= 80) return 80;
  if (safe <= 100) return 100;
  return Math.ceil(safe / 40) * 40;
}

function formatDurationShort(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe === 0) return "0h";
  if (safe < 60) return `${safe}s`;
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default function MonthlyStudyTrendChart({
  sessions,
}: {
  sessions: MonthlySession[];
}) {
  const gradientId = useId();
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  const { year, currentMonth, points, niceMaxHours, yTicks } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const curMonth = now.getMonth();

    const actualByMonth = Array.from({ length: 12 }, () => 0);
    for (const s of sessions) {
      if (!s || s.duration <= 0) continue;
      const d = new Date(s.created_at);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() === currentYear) {
        actualByMonth[d.getMonth()] += Number(s.duration) || 0;
      }
    }

    const activeMonthsUpToNow = actualByMonth
      .slice(0, curMonth + 1)
      .filter((secs) => secs > 0);
    const avgActiveSeconds =
      activeMonthsUpToNow.length > 0
        ? Math.round(
            activeMonthsUpToNow.reduce((sum, v) => sum + v, 0) /
              activeMonthsUpToNow.length
          )
        : 0;

    const monthPoints: MonthPoint[] = MONTH_LABELS.map((label, idx) => {
      const isForecast = idx > curMonth;
      return {
        index: idx,
        label,
        seconds: isForecast ? avgActiveSeconds : actualByMonth[idx],
        isForecast,
      };
    });

    const maxSec = Math.max(...monthPoints.map((p) => p.seconds), 0);
    const maxHours = computeNiceMaxHours(maxSec / 3600);
    const step = maxHours / 4;
    const ticks = [0, step, step * 2, step * 3, maxHours];

    return {
      year: currentYear,
      currentMonth: curMonth,
      points: monthPoints,
      niceMaxHours: maxHours,
      yTicks: ticks,
    };
  }, [sessions]);

  const width = 520;
  const height = 164;
  const padLeft = 34;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const maxSeconds = niceMaxHours * 3600;

  const coords = points.map((p, idx) => {
    const x = padLeft + (idx / 11) * plotW;
    const ratio = maxSeconds > 0 ? Math.min(1, p.seconds / maxSeconds) : 0;
    const y = padTop + plotH - ratio * plotH;
    return { ...p, x, y };
  });

  const actualCoords = coords.slice(0, currentMonth + 1);
  const actualPath = actualCoords
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  const baselineY = padTop + plotH;
  const areaPath =
    actualCoords.length > 0
      ? `${actualPath} L ${actualCoords[actualCoords.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${actualCoords[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`
      : "";

  const forecastCoords =
    currentMonth < 11 ? coords.slice(currentMonth) : ([] as typeof coords);
  const forecastPath = forecastCoords
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  const focusedIdx = activeMonth ?? currentMonth;
  const focusedPoint = coords[focusedIdx] ?? coords[currentMonth];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Monthly study</h3>
          <span className="rounded-md border border-white/10 bg-[#09090b] px-1.5 py-0.5 font-mono text-[10px] text-white/50 tabular-nums">
            {year}
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#09090b] px-2.5 py-1 text-[11px] tabular-nums">
          <span className="font-medium text-white/65">{focusedPoint.label}</span>
          <span className="text-white/30">·</span>
          <span className="font-mono font-semibold text-emerald-300">
            {formatDurationShort(focusedPoint.seconds)}
          </span>
          {focusedPoint.isForecast && (
            <span className="rounded bg-white/[0.06] px-1 py-0.2 text-[9px] uppercase tracking-wider text-white/50">
              Pace
            </span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={() => setActiveMonth(null)}
        className="mt-3 h-auto w-full overflow-visible select-none"
        role="img"
        aria-label={`Monthly study trend for ${year}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines & Y-axis labels */}
        {yTicks.map((tickHours) => {
          const y = padTop + plotH - (tickHours / niceMaxHours) * plotH;
          return (
            <g key={tickHours}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={
                  tickHours === 0
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.06)"
                }
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                fill="#71717a"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {tickHours}h
              </text>
            </g>
          );
        })}

        {/* Divider separating Actual vs Pace */}
        {currentMonth < 11 && (
          <line
            x1={(coords[currentMonth].x + coords[currentMonth + 1].x) / 2}
            y1={padTop}
            x2={(coords[currentMonth].x + coords[currentMonth + 1].x) / 2}
            y2={baselineY}
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        )}

        {/* Actual area fill */}
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

        {/* Forecast dashed line */}
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke="#34d399"
            strokeOpacity="0.55"
            strokeDasharray="4 4"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Actual solid line */}
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Month points, hit targets, and X-axis labels */}
        {coords.map((pt) => {
          const isFocused = pt.index === focusedIdx;
          return (
            <g key={pt.label}>
              <text
                x={pt.x}
                y={height - 6}
                textAnchor="middle"
                fill={isFocused ? "#ffffff" : "#71717a"}
                fontSize="10"
                fontWeight={isFocused ? "600" : "400"}
              >
                {pt.label}
              </text>

              {isFocused && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="6"
                  fill="rgba(16,185,129,0.22)"
                />
              )}

              <circle
                cx={pt.x}
                cy={pt.y}
                r={isFocused ? "4" : "3"}
                fill={pt.isForecast ? "#111113" : "#10b981"}
                stroke={pt.isForecast ? "#34d399" : "#111113"}
                strokeWidth="1.75"
              />

              <circle
                cx={pt.x}
                cy={pt.y}
                r="14"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setActiveMonth(pt.index)}
                onClick={() => setActiveMonth(pt.index)}
              />
            </g>
          );
        })}
      </svg>

      {currentMonth < 11 && (
        <div className="mt-1.5 flex items-center justify-end gap-4 text-[10px] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Actual</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-emerald-400 bg-[#111113]" />
            <span>Projected pace</span>
          </span>
        </div>
      )}
    </div>
  );
}
