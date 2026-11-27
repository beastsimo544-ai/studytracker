"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type HeatmapSession = {
  duration: number;
  created_at: string;
};

type StudyHeatmapProps = {
  sessions: HeatmapSession[];
  dailyGoalMinutes: number;
};

type HeatmapCell = {
  key: string;
  date: Date;
  seconds: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
  isToday: boolean;
};

const WEEK_COUNT = 53;
const MONTH_NAMES = [
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

const WEEKDAY_LABELS: Record<number, string> = {
  0: "Mon",
  2: "Wed",
  4: "Fri",
  6: "Sun",
};

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-white/[0.05] border-white/[0.04] hover:border-white/25",
  1: "bg-emerald-950/90 border-emerald-800/45 hover:border-emerald-500/60",
  2: "bg-emerald-800/80 border-emerald-600/45 hover:border-emerald-400/70",
  3: "bg-emerald-600/90 border-emerald-400/45 hover:border-emerald-300/80",
  4: "bg-emerald-400 border-emerald-300/70 hover:border-white/80 shadow-[0_0_8px_rgba(52,211,153,0.22)]",
};

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getLevel(seconds: number, goalSeconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  const ratio = seconds / goalSeconds;
  if (ratio < 0.25) return 1;
  if (ratio < 0.6) return 2;
  if (ratio < 0.95) return 3;
  return 4;
}

function formatDurationCompact(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded === 0) return "0m";
  if (rounded < 60) return `${rounded}s`;
  const totalMinutes = Math.floor(rounded / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatCellDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function StudyHeatmap({
  sessions,
  dailyGoalMinutes,
}: StudyHeatmapProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const {
    weeks,
    monthLabels,
    cellsByKey,
    todayKey,
    todayCell,
    activeDaysCount,
    totalYearSeconds,
    goalSeconds,
  } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    const currentKey = toLocalDateKey(today);

    // Monday = 0, ..., Sunday = 6
    const todayWeekdayIndex = (today.getDay() + 6) % 7;
    const currentWeekMonday = addDays(today, -todayWeekdayIndex);
    const gridStartMonday = addDays(currentWeekMonday, -(WEEK_COUNT - 1) * 7);

    const secondsByDay = new Map<string, number>();
    for (const session of sessions) {
      if (!session || session.duration <= 0) continue;
      const parsed = new Date(session.created_at);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = toLocalDateKey(parsed);
      secondsByDay.set(key, (secondsByDay.get(key) ?? 0) + session.duration);
    }

    const effectiveGoalSeconds = Math.max(dailyGoalMinutes * 60, 1800);
    const weekColumns: HeatmapCell[][] = [];
    const lookup = new Map<string, HeatmapCell>();
    const labels = new Map<number, string>();

    let lastLabelCol = -10;
    let activeDays = 0;
    let totalSeconds = 0;
    let fallbackTodayCell: HeatmapCell | null = null;

    for (let col = 0; col < WEEK_COUNT; col += 1) {
      const columnCells: HeatmapCell[] = [];
      let monthTransitionDay: Date | null = null;

      for (let row = 0; row < 7; row += 1) {
        const cellDate = addDays(gridStartMonday, col * 7 + row);
        const key = toLocalDateKey(cellDate);
        const isFuture = cellDate.getTime() > today.getTime();
        const seconds = isFuture ? 0 : (secondsByDay.get(key) ?? 0);
        const level = isFuture ? 0 : getLevel(seconds, effectiveGoalSeconds);
        const isToday = key === currentKey;

        const cell: HeatmapCell = {
          key,
          date: cellDate,
          seconds,
          level,
          isFuture,
          isToday,
        };

        columnCells.push(cell);

        if (!isFuture) {
          lookup.set(key, cell);
          totalSeconds += seconds;
          if (seconds > 0) {
            activeDays += 1;
          }
          if (isToday) {
            fallbackTodayCell = cell;
          }
          if (cellDate.getDate() === 1) {
            monthTransitionDay = cellDate;
          }
        }
      }

      if (col === 0) {
        labels.set(col, MONTH_NAMES[columnCells[0].date.getMonth()]);
        lastLabelCol = col;
      } else if (monthTransitionDay && col - lastLabelCol >= 3) {
        labels.set(col, MONTH_NAMES[monthTransitionDay.getMonth()]);
        lastLabelCol = col;
      }

      weekColumns.push(columnCells);
    }

    return {
      weeks: weekColumns,
      monthLabels: labels,
      cellsByKey: lookup,
      todayKey: currentKey,
      todayCell:
        fallbackTodayCell ?? {
          key: currentKey,
          date: today,
          seconds: 0,
          level: 0 as const,
          isFuture: false,
          isToday: true,
        },
      activeDaysCount: activeDays,
      totalYearSeconds: totalSeconds,
      goalSeconds: effectiveGoalSeconds,
    };
  }, [sessions, dailyGoalMinutes]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollLeft = container.scrollWidth;
  }, []);

  const activeCell =
    (selectedKey ? cellsByKey.get(selectedKey) : undefined) ?? todayCell;
  const activeGoalPct = Math.min(
    999,
    Math.round((activeCell.seconds / goalSeconds) * 100)
  );

  return (
    <section className="mt-4 sm:mt-5">
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight text-white">
                Study consistency
              </h2>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 tabular-nums">
                52 weeks
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400 tabular-nums">
              {activeDaysCount} active {activeDaysCount === 1 ? "day" : "days"} ·{" "}
              {formatDurationCompact(totalYearSeconds)} total studied
            </p>
          </div>

          <div
            aria-live="polite"
            className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-[#09090b] px-3 py-2 text-xs"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-[3px] border ${LEVEL_CLASSES[activeCell.level]}`}
            />
            <span className="font-semibold text-white tabular-nums">
              {activeCell.seconds > 0
                ? formatDurationCompact(activeCell.seconds)
                : "No study"}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-300">
              {activeCell.isToday ? "Today, " : ""}
              {formatCellDate(activeCell.date)}
            </span>
            {activeCell.seconds > 0 && (
              <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 tabular-nums">
                {activeGoalPct}% goal
              </span>
            )}
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          onMouseLeave={() => setSelectedKey(null)}
          className="mt-5 overflow-x-auto pb-1 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]"
        >
          <div
            className="grid min-w-[740px] gap-x-[4px] gap-y-[4px]"
            style={{
              gridTemplateColumns: `28px repeat(${WEEK_COUNT}, minmax(11px, 1fr))`,
            }}
          >
            {/* Month header row */}
            <div aria-hidden="true" />
            {weeks.map((week, colIndex) => {
              const label = monthLabels.get(colIndex);
              return (
                <div
                  key={`month-${week[0]?.key ?? colIndex}`}
                  className="relative h-4 select-none"
                >
                  {label && (
                    <span className="absolute left-0 top-0 whitespace-nowrap text-[11px] font-medium text-zinc-400">
                      {label}
                    </span>
                  )}
                </div>
              );
            })}

            {/* 7 weekday rows x 53 week columns */}
            {Array.from({ length: 7 }, (_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="contents">
                <div className="flex items-center pr-1 text-[11px] font-medium text-zinc-500 select-none">
                  {WEEKDAY_LABELS[rowIndex] ?? ""}
                </div>
                {weeks.map((week, colIndex) => {
                  const cell = week[rowIndex];
                  if (!cell || cell.isFuture) {
                    return (
                      <div
                        key={`empty-${colIndex}-${rowIndex}`}
                        aria-hidden="true"
                        className="aspect-square w-full"
                      />
                    );
                  }

                  const isSelected =
                    selectedKey === cell.key ||
                    (!selectedKey && cell.key === todayKey);

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onMouseEnter={() => setSelectedKey(cell.key)}
                      onFocus={() => setSelectedKey(cell.key)}
                      onClick={() => setSelectedKey(cell.key)}
                      aria-label={`${formatCellDate(cell.date)}: ${
                        cell.seconds > 0
                          ? formatDurationCompact(cell.seconds)
                          : "No study recorded"
                      }`}
                      title={`${formatCellDate(cell.date)} — ${
                        cell.seconds > 0
                          ? formatDurationCompact(cell.seconds)
                          : "0m"
                      }`}
                      className={`aspect-square w-full rounded-[3px] border transition-all duration-150 focus:outline-none ${
                        LEVEL_CLASSES[cell.level]
                      } ${
                        isSelected
                          ? "ring-1 ring-white/70 ring-offset-1 ring-offset-[#111113]"
                          : ""
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
          <span className="tabular-nums">
            Scaled to {Math.round(goalSeconds / 60)}m daily goal
          </span>

          <div className="flex items-center gap-1.5">
            <span>Less</span>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <span
                key={level}
                aria-hidden="true"
                className={`h-3 w-3 rounded-[3px] border ${LEVEL_CLASSES[level]}`}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </section>
  );
}
