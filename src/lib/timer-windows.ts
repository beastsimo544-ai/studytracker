import { getTodayLocalDateKey } from "@/lib/screen-time";

export type StudyTimerWindow = {
  startMs: number;
  endMs: number | null;
};

export type ClosedTimerWindow = {
  startMs: number;
  endMs: number;
};

export type StudyTimerStatus = {
  active: boolean;
  subject: string | null;
  timerMode: "stopwatch" | "pomodoro";
  startedAt: number | null;
  endsAt: number | null;
  updatedAt: number;
};

const TIMER_STORAGE_KEY = "studyTimer";
const WINDOWS_STORAGE_KEY = "studytracker_timer_windows_v1";

function getStartOfTodayMs(now: number = Date.now()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function parseRawStudyTimer(now: number): {
  status: StudyTimerStatus;
  expiredPomodoroEndsAt: number | null;
} {
  const fallback: StudyTimerStatus = {
    active: false,
    subject: null,
    timerMode: "stopwatch",
    startedAt: null,
    endsAt: null,
    updatedAt: now,
  };

  if (typeof window === "undefined") {
    return { status: fallback, expiredPomodoroEndsAt: null };
  }

  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return { status: fallback, expiredPomodoroEndsAt: null };

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const timerMode: "stopwatch" | "pomodoro" =
      parsed?.timerMode === "pomodoro" ? "pomodoro" : "stopwatch";
    const isFocusPhase =
      timerMode === "stopwatch" || parsed?.pomodoroPhase !== "break";
    const startedAt =
      typeof parsed?.startedAt === "number" ? parsed.startedAt : null;
    const accumulatedMs =
      typeof parsed?.accumulatedMs === "number"
        ? Math.max(0, parsed.accumulatedMs)
        : 0;
    const focusMinutes =
      typeof parsed?.focusMinutes === "number" && parsed.focusMinutes > 0
        ? parsed.focusMinutes
        : 25;
    const isRunning = Boolean(parsed?.isRunning);

    const rawEndsAt =
      timerMode === "pomodoro" &&
      isFocusPhase &&
      isRunning &&
      startedAt !== null
        ? startedAt + Math.max(0, focusMinutes * 60 * 1000 - accumulatedMs)
        : null;

    const expiredPomodoroEndsAt =
      rawEndsAt !== null && now >= rawEndsAt ? rawEndsAt : null;

    const active = Boolean(
      isRunning &&
        startedAt !== null &&
        isFocusPhase &&
        (rawEndsAt === null || now < rawEndsAt)
    );

    const subject =
      typeof parsed?.selectedSubject === "string" && parsed.selectedSubject
        ? parsed.selectedSubject
        : null;

    return {
      status: {
        active,
        subject,
        timerMode,
        startedAt: active ? startedAt : null,
        endsAt: active ? rawEndsAt : null,
        updatedAt: now,
      },
      expiredPomodoroEndsAt,
    };
  } catch {
    return { status: fallback, expiredPomodoroEndsAt: null };
  }
}

export function readActiveTimerStatusFromStorage(
  now: number = Date.now()
): StudyTimerStatus {
  return parseRawStudyTimer(now).status;
}

function loadStoredTodayWindows(now: number = Date.now()): StudyTimerWindow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WINDOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      dateKey?: string;
      windows?: unknown[];
    };
    const todayKey = getTodayLocalDateKey(new Date(now));
    if (parsed?.dateKey !== todayKey || !Array.isArray(parsed.windows)) {
      return [];
    }
    return parsed.windows
      .filter(
        (w): w is StudyTimerWindow =>
          Boolean(w) &&
          typeof w === "object" &&
          typeof (w as StudyTimerWindow).startMs === "number" &&
          ((w as StudyTimerWindow).endMs === null ||
            typeof (w as StudyTimerWindow).endMs === "number")
      )
      .map((w) => ({
        startMs: w.startMs,
        endMs: w.endMs,
      }));
  } catch {
    return [];
  }
}

function saveStoredTodayWindows(
  windows: StudyTimerWindow[],
  now: number = Date.now()
): void {
  if (typeof window === "undefined") return;
  try {
    const todayKey = getTodayLocalDateKey(new Date(now));
    window.localStorage.setItem(
      WINDOWS_STORAGE_KEY,
      JSON.stringify({ dateKey: todayKey, windows })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function openTimerWindow(
  startMs: number,
  now: number = Date.now()
): void {
  const todayStart = getStartOfTodayMs(now);
  const clampedStart = Math.max(todayStart, Math.min(startMs, now));
  const windows = loadStoredTodayWindows(now);
  if (windows.some((w) => w.endMs === null)) {
    return;
  }
  saveStoredTodayWindows(
    [...windows, { startMs: clampedStart, endMs: null }],
    now
  );
}

export function closeTimerWindow(endMs: number = Date.now()): void {
  const windows = loadStoredTodayWindows(endMs);
  if (!windows.some((w) => w.endMs === null)) {
    return;
  }
  const updated = windows.map((w) =>
    w.endMs === null ? { ...w, endMs: Math.max(w.startMs, endMs) } : w
  );
  saveStoredTodayWindows(updated, endMs);
}

export function getTodayTimerWindows(
  now: number = Date.now()
): ClosedTimerWindow[] {
  const todayStart = getStartOfTodayMs(now);
  const stored = loadStoredTodayWindows(now);
  const { status: timerStatus, expiredPomodoroEndsAt } =
    parseRawStudyTimer(now);

  const closed: ClosedTimerWindow[] = [];
  let dirtyStored = false;
  const cleanedStored: StudyTimerWindow[] = [];

  for (const w of stored) {
    if (w.endMs !== null) {
      cleanedStored.push(w);
      const startMs = Math.max(todayStart, w.startMs);
      const endMs = Math.min(now, w.endMs);
      if (endMs > startMs) {
        closed.push({ startMs, endMs });
      }
    } else if (timerStatus.active) {
      cleanedStored.push(w);
      const startMs = Math.max(todayStart, w.startMs);
      const endMs = timerStatus.endsAt ? Math.min(now, timerStatus.endsAt) : now;
      if (endMs > startMs) {
        closed.push({ startMs, endMs });
      }
    } else if (
      expiredPomodoroEndsAt !== null &&
      expiredPomodoroEndsAt > w.startMs
    ) {
      dirtyStored = true;
      const clampedEnd = Math.min(now, expiredPomodoroEndsAt);
      cleanedStored.push({ startMs: w.startMs, endMs: clampedEnd });
      const startMs = Math.max(todayStart, w.startMs);
      if (clampedEnd > startMs) {
        closed.push({ startMs, endMs: clampedEnd });
      }
    } else {
      dirtyStored = true;
    }
  }

  if (dirtyStored) {
    saveStoredTodayWindows(cleanedStored, now);
  }

  if (timerStatus.active && timerStatus.startedAt !== null) {
    const activeStart = Math.max(todayStart, timerStatus.startedAt);
    const activeEnd = timerStatus.endsAt
      ? Math.min(now, timerStatus.endsAt)
      : now;
    const alreadyCovered = closed.some(
      (c) => c.startMs <= activeStart && c.endMs >= activeEnd
    );
    if (!alreadyCovered && activeEnd > activeStart) {
      closed.push({ startMs: activeStart, endMs: activeEnd });
    }
  }

  if (closed.length === 0) return [];

  closed.sort((a, b) => a.startMs - b.startMs);
  const merged: ClosedTimerWindow[] = [closed[0]];
  for (let i = 1; i < closed.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = closed[i];
    if (curr.startMs <= prev.endMs) {
      prev.endMs = Math.max(prev.endMs, curr.endMs);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

export function broadcastTimerStatusToExtension(
  status: StudyTimerStatus
): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    { type: "STUDYTRACKER_TIMER_STATUS", payload: status },
    window.location.origin
  );
}
