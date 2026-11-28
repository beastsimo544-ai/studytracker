"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import {
  isAndroidNative,
  syncAndroidUsageToSupabase,
} from "@/lib/android-screen-time";
import {
  cancelPomodoroFinishNotification,
  clearOngoingTimerNotification,
  requestNotificationPermissions,
  schedulePomodoroFinishNotification,
  sendInstantSystemNotification,
  showOngoingTimerNotification,
} from "@/lib/notifications";
import { resolveSubjectColor } from "@/lib/subject-colors";
import { supabase } from "@/lib/supabase";
import {
  broadcastTimerStatusToExtension,
  closeTimerWindow,
  openTimerWindow,
} from "@/lib/timer-windows";

type TimerMode = "stopwatch" | "pomodoro";
type PomodoroPhase = "focus" | "break";
type StudyTask = {
  id: string;
  text: string;
  done: boolean;
};
type StoredTaskState = {
  tasks: StudyTask[];
  activeTaskId: string | null;
  updatedAt: number;
};

const MAX_SYNCED_TASKS = 80;

function sanitizeTasks(raw: unknown): StudyTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is StudyTask =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as StudyTask).id === "string" &&
        typeof (item as StudyTask).text === "string" &&
        typeof (item as StudyTask).done === "boolean"
    )
    .map((item) => ({
      id: item.id,
      text: item.text.slice(0, 140),
      done: item.done,
    }))
    .slice(0, MAX_SYNCED_TASKS);
}

function getTasksStorageKey(userId: string | null) {
  return userId ? `studyTimerTasks_${userId}` : "studyTimerTasks";
}

function readLocalTasks(userId: string | null): {
  state: StoredTaskState;
  hasStoredData: boolean;
} {
  if (typeof window === "undefined") {
    return {
      state: { tasks: [], activeTaskId: null, updatedAt: 0 },
      hasStoredData: false,
    };
  }

  const primaryKey = getTasksStorageKey(userId);
  let raw = localStorage.getItem(primaryKey);
  if (!raw && userId) {
    raw = localStorage.getItem("studyTimerTasks");
  }
  if (!raw) {
    return {
      state: { tasks: [], activeTaskId: null, updatedAt: 0 },
      hasStoredData: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      tasks?: unknown;
      activeTaskId?: unknown;
      updatedAt?: unknown;
    };
    const tasks = sanitizeTasks(parsed?.tasks);
    const activeTaskId =
      typeof parsed?.activeTaskId === "string" ? parsed.activeTaskId : null;
    const updatedAt =
      typeof parsed?.updatedAt === "number" ? parsed.updatedAt : 0;

    return {
      state: { tasks, activeTaskId, updatedAt },
      hasStoredData: Array.isArray(parsed?.tasks),
    };
  } catch {
    localStorage.removeItem(primaryKey);
    return {
      state: { tasks: [], activeTaskId: null, updatedAt: 0 },
      hasStoredData: false,
    };
  }
}

function writeLocalTasks(userId: string | null, state: StoredTaskState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getTasksStorageKey(userId), JSON.stringify(state));
}

function playCompletionChime() {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + index * 0.14;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch {
    // Ignore audio errors if blocked by browser autoplay policy
  }
}

async function insertSessionWithOptionalNote(payload: {
  user_id: string;
  subject: string;
  duration: number;
  note: string | null;
}) {
  if (payload.note) {
    const withNote = await supabase.from("study_sessions").insert(payload);
    if (!withNote.error) return { error: null };
    if (!withNote.error.message.includes("note")) {
      return { error: withNote.error };
    }
  }

  const withoutNote = await supabase.from("study_sessions").insert({
    user_id: payload.user_id,
    subject: payload.subject,
    duration: payload.duration,
  });

  return { error: withoutNote.error };
}

export default function TimerPage() {
  const router = useRouter();
  const { toast, checkNewAchievements } = useNotifications();

  const [timerMode, setTimerMode] = useState<TimerMode>("stopwatch");
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>("focus");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [preset, setPreset] = useState<"25-5" | "50-10" | "custom">("25-5");
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [statusBanner, setStatusBanner] = useState("");
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isTodoOpen, setIsTodoOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [taskSyncStatus, setTaskSyncStatus] = useState<
    "idle" | "syncing" | "synced" | "error"
  >("idle");
  const [isMinimalFocus, setIsMinimalFocus] = useState(false);

  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [colorBySubject, setColorBySubject] = useState<
    Record<string, string | null>
  >({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const isSavingRef = useRef(false);
  const autoCompletingRef = useRef(false);
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const tasksRef = useRef<StudyTask[]>([]);
  const activeTaskIdRef = useRef<string | null>(null);
  const tasksUpdatedAtRef = useRef<number>(0);
  const isSyncingCloudRef = useRef(false);
  const pendingCloudPayloadRef = useRef<StoredTaskState | null>(null);
  const lastPullAtRef = useRef<number>(0);
  const wasFocusRunningRef = useRef(false);

  const activeTask =
    tasks.find((task) => task.id === activeTaskId && !task.done) ??
    tasks.find((task) => !task.done) ??
    null;
  const remainingTasksCount = tasks.filter((task) => !task.done).length;
  const completedTasksCount = tasks.length - remainingTasksCount;

  const isRunning = startedAt !== null;
  const hasSessionProgress = seconds > 0 || accumulatedMs > 0 || isRunning;

  const targetPomodoroSeconds =
    (pomodoroPhase === "focus" ? focusMinutes : breakMinutes) * 60;

  const displaySeconds =
    timerMode === "pomodoro"
      ? Math.max(0, targetPomodoroSeconds - seconds)
      : seconds;

  const pomodoroProgressPercent =
    timerMode === "pomodoro" && targetPomodoroSeconds > 0
      ? Math.min(100, (seconds / targetPomodoroSeconds) * 100)
      : 0;

  const selectedColor = selectedSubject
    ? resolveSubjectColor(selectedSubject, colorBySubject)
    : "#ffffff";

  const broadcastLiveStatus = useCallback(
    async (activeSubject: string | null, sessionStartMs?: number) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase
          .from("profiles")
          .update({
            studying_subject: activeSubject,
            studying_started_at:
              activeSubject && sessionStartMs
                ? new Date(sessionStartMs).toISOString()
                : null,
          })
          .eq("user_id", user.id);
      } catch {
        // Optional columns may not exist yet
      }
    },
    []
  );

  // Keep screen awake while running
  useEffect(() => {
    if (!isRunning) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let wakeLockSentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
        } else {
          wakeLockSentinel = sentinel;
        }
      } catch {
        // Ignore if rejected
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [isRunning]);

  const flushCloudTaskSync = useCallback(async () => {
    if (
      isSyncingCloudRef.current ||
      !pendingCloudPayloadRef.current ||
      !currentUserIdRef.current
    ) {
      return;
    }

    isSyncingCloudRef.current = true;
    setTaskSyncStatus("syncing");

    try {
      while (pendingCloudPayloadRef.current && currentUserIdRef.current) {
        const payload = pendingCloudPayloadRef.current;
        pendingCloudPayloadRef.current = null;

        const { error } = await supabase.auth.updateUser({
          data: {
            timer_tasks: payload.tasks,
            timer_active_task_id: payload.activeTaskId,
            timer_tasks_updated_at: payload.updatedAt,
          },
        });

        if (error) {
          console.error("Could not sync timer tasks:", error);
          setTaskSyncStatus("error");
          break;
        }

        if (!pendingCloudPayloadRef.current) {
          setTaskSyncStatus("synced");
        }
      }
    } finally {
      isSyncingCloudRef.current = false;
    }
  }, []);

  const queueCloudTaskSync = useCallback(
    (state: StoredTaskState) => {
      if (!currentUserIdRef.current) return;
      pendingCloudPayloadRef.current = state;
      void flushCloudTaskSync();
    },
    [flushCloudTaskSync]
  );

  const applyTaskState = useCallback(
    (
      nextTasks: StudyTask[],
      nextActiveTaskId: string | null,
      opts?: { updatedAt?: number; syncToCloud?: boolean }
    ) => {
      const updatedAt = opts?.updatedAt ?? Date.now();
      tasksRef.current = nextTasks;
      activeTaskIdRef.current = nextActiveTaskId;
      tasksUpdatedAtRef.current = updatedAt;
      setTasks(nextTasks);
      setActiveTaskId(nextActiveTaskId);
      writeLocalTasks(currentUserIdRef.current, {
        tasks: nextTasks,
        activeTaskId: nextActiveTaskId,
        updatedAt,
      });

      if (opts?.syncToCloud !== false) {
        queueCloudTaskSync({
          tasks: nextTasks,
          activeTaskId: nextActiveTaskId,
          updatedAt,
        });
      }
    },
    [queueCloudTaskSync]
  );

  const reconcileTasksWithUser = useCallback(
    (user: { id: string; user_metadata?: Record<string, unknown> }) => {
      if (isSyncingCloudRef.current || pendingCloudPayloadRef.current) {
        return;
      }

      const { state: localState, hasStoredData } = readLocalTasks(user.id);
      const meta = user.user_metadata ?? {};
      const hasCloudTasks = Array.isArray(meta.timer_tasks);
      const cloudTasks = hasCloudTasks ? sanitizeTasks(meta.timer_tasks) : [];
      const cloudActiveTaskId =
        typeof meta.timer_active_task_id === "string"
          ? meta.timer_active_task_id
          : null;
      const cloudUpdatedAt =
        typeof meta.timer_tasks_updated_at === "number"
          ? meta.timer_tasks_updated_at
          : 0;

      if (
        hasCloudTasks &&
        (!hasStoredData || cloudUpdatedAt >= localState.updatedAt)
      ) {
        applyTaskState(cloudTasks, cloudActiveTaskId, {
          updatedAt: cloudUpdatedAt || Date.now(),
          syncToCloud: false,
        });
        setTaskSyncStatus("synced");
      } else if (
        hasStoredData &&
        (localState.tasks.length > 0 || localState.updatedAt > cloudUpdatedAt)
      ) {
        const migratedAt = localState.updatedAt || Date.now();
        applyTaskState(localState.tasks, localState.activeTaskId, {
          updatedAt: migratedAt,
          syncToCloud: true,
        });
      } else {
        applyTaskState([], null, { updatedAt: 0, syncToCloud: false });
        setTaskSyncStatus("synced");
      }
    },
    [applyTaskState]
  );

  // Restore unfinished timer and load subjects on mount
  useEffect(() => {
    const initTimerAndSubjects = async () => {
      await Promise.resolve();

      let savedSubject = "";
      let hasSavedProgress = false;

      const savedTimer = localStorage.getItem("studyTimer");

      if (savedTimer) {
        try {
          const parsedTimer = JSON.parse(savedTimer);
          savedSubject = parsedTimer.selectedSubject ?? "";

          if (
            parsedTimer.timerMode === "pomodoro" ||
            parsedTimer.timerMode === "stopwatch"
          ) {
            setTimerMode(parsedTimer.timerMode);
          }
          if (
            parsedTimer.pomodoroPhase === "focus" ||
            parsedTimer.pomodoroPhase === "break"
          ) {
            setPomodoroPhase(parsedTimer.pomodoroPhase);
          }
          if (typeof parsedTimer.focusMinutes === "number") {
            setFocusMinutes(parsedTimer.focusMinutes);
          }
          if (typeof parsedTimer.breakMinutes === "number") {
            setBreakMinutes(parsedTimer.breakMinutes);
          }
          if (
            parsedTimer.preset === "25-5" ||
            parsedTimer.preset === "50-10" ||
            parsedTimer.preset === "custom"
          ) {
            setPreset(parsedTimer.preset);
          }
          if (typeof parsedTimer.completedPomodoros === "number") {
            setCompletedPomodoros(parsedTimer.completedPomodoros);
          }

          if (typeof parsedTimer.accumulatedMs === "number") {
            const restoredAcc = Math.max(0, parsedTimer.accumulatedMs);
            const restoredStart =
              parsedTimer.isRunning &&
              typeof parsedTimer.startedAt === "number"
                ? parsedTimer.startedAt
                : null;
            const totalMs =
              restoredAcc +
              (restoredStart ? Math.max(0, Date.now() - restoredStart) : 0);

            hasSavedProgress = Boolean(restoredStart) || restoredAcc > 0;
            setAccumulatedMs(restoredAcc);
            setStartedAt(restoredStart);
            setSeconds(Math.floor(totalMs / 1000));
          } else {
            const legacyMs = Math.max(0, (parsedTimer.seconds ?? 0) * 1000);
            const restoredStart = parsedTimer.isRunning ? Date.now() : null;

            hasSavedProgress = Boolean(restoredStart) || legacyMs > 0;
            setAccumulatedMs(legacyMs);
            setStartedAt(restoredStart);
            setSeconds(Math.floor(legacyMs / 1000));
          }

          if (savedSubject) {
            setSelectedSubject(savedSubject);
          }
        } catch (error) {
          console.error("Could not restore timer:", error);
          localStorage.removeItem("studyTimer");
        }
      }

      // Restore initial local timer to-do list before cloud check
      const initialLocal = readLocalTasks(null);
      if (initialLocal.hasStoredData) {
        applyTaskState(
          initialLocal.state.tasks,
          initialLocal.state.activeTaskId,
          {
            updatedAt: initialLocal.state.updatedAt,
            syncToCloud: false,
          }
        );
      }

      setHasHydrated(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      currentUserIdRef.current = user?.id ?? null;
      setIsLoggedIn(Boolean(user));

      if (user) {
        reconcileTasksWithUser(user);
      }

      if (!user) {
        const publicSubjects = ["Study", "Deep Work", "Reading", "Other"];
        setSubjects(publicSubjects);

        if (savedSubject && publicSubjects.includes(savedSubject)) {
          setSelectedSubject(savedSubject);
        } else {
          setSelectedSubject(publicSubjects[0]);
        }

        return;
      }

      const fullRes = await supabase
        .from("subjects")
        .select("name, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      let subjectRows: { name: string; color?: string | null }[] = [];

      if (fullRes.error && fullRes.error.message.includes("color")) {
        const fallbackRes = await supabase
          .from("subjects")
          .select("name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (fallbackRes.error) {
          console.error(fallbackRes.error);
          return;
        }
        subjectRows = fallbackRes.data || [];
      } else if (fullRes.error) {
        console.error(fullRes.error);
        return;
      } else {
        subjectRows = fullRes.data || [];
      }

      const colors: Record<string, string | null> = {};
      subjectRows.forEach((row) => {
        colors[row.name] = row.color ?? null;
      });
      setColorBySubject(colors);

      const subjectNames = subjectRows.map((subject) => subject.name);

      if (
        hasSavedProgress &&
        savedSubject &&
        !subjectNames.includes(savedSubject)
      ) {
        const mergedSubjects = [savedSubject, ...subjectNames];
        setSubjects(mergedSubjects);
        setSelectedSubject(savedSubject);
        return;
      }

      setSubjects(subjectNames);

      if (savedSubject && subjectNames.includes(savedSubject)) {
        setSelectedSubject(savedSubject);
      } else if (subjectNames.length > 0) {
        setSelectedSubject(subjectNames[0]);
      } else {
        setSelectedSubject("");
      }
    };

    initTimerAndSubjects();
  }, [applyTaskState, reconcileTasksWithUser]);

  // Pull fresh tasks when returning to tab or resuming mobile app
  useEffect(() => {
    const pullLatestTasks = async () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastPullAtRef.current < 3000) return;
      lastPullAtRef.current = now;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      currentUserIdRef.current = user?.id ?? null;
      setIsLoggedIn(Boolean(user));

      if (user) {
        reconcileTasksWithUser(user);
        if (wasFocusRunningRef.current && isAndroidNative()) {
          void syncAndroidUsageToSupabase(user.id);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pullLatestTasks();
      }
    };

    const handleWindowFocus = () => {
      void pullLatestTasks();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [reconcileTasksWithUser]);

  // Save active/paused timer state
  useEffect(() => {
    if (!hasHydrated) return;

    if (
      accumulatedMs === 0 &&
      startedAt === null &&
      timerMode === "stopwatch"
    ) {
      localStorage.removeItem("studyTimer");
      return;
    }

    const currentMs =
      accumulatedMs +
      (startedAt !== null ? Math.max(0, Date.now() - startedAt) : 0);

    localStorage.setItem(
      "studyTimer",
      JSON.stringify({
        timerMode,
        pomodoroPhase,
        focusMinutes,
        breakMinutes,
        preset,
        completedPomodoros,
        accumulatedMs,
        startedAt,
        isRunning: startedAt !== null,
        seconds: Math.floor(currentMs / 1000),
        selectedSubject,
      })
    );
  }, [
    timerMode,
    pomodoroPhase,
    focusMinutes,
    breakMinutes,
    preset,
    completedPomodoros,
    accumulatedMs,
    startedAt,
    selectedSubject,
    hasHydrated,
  ]);

  // Track active focus-timer windows for screen time gating (PC extension + Android)
  useEffect(() => {
    if (!hasHydrated) return;

    const isFocusRunning =
      startedAt !== null &&
      (timerMode === "stopwatch" || pomodoroPhase === "focus");
    const now = Date.now();
    const endsAt =
      isFocusRunning && timerMode === "pomodoro"
        ? startedAt + Math.max(0, focusMinutes * 60 * 1000 - accumulatedMs)
        : null;

    if (isFocusRunning) {
      openTimerWindow(startedAt, now);
    } else {
      closeTimerWindow(now);
    }

    broadcastTimerStatusToExtension({
      active: isFocusRunning,
      subject: selectedSubject || null,
      timerMode,
      startedAt: isFocusRunning ? startedAt : null,
      endsAt,
      updatedAt: now,
    });

    if (
      wasFocusRunningRef.current &&
      !isFocusRunning &&
      isAndroidNative() &&
      currentUserIdRef.current
    ) {
      void syncAndroidUsageToSupabase(currentUserIdRef.current);
    }

    wasFocusRunningRef.current = isFocusRunning;
  }, [
    hasHydrated,
    startedAt,
    accumulatedMs,
    timerMode,
    pomodoroPhase,
    focusMinutes,
    selectedSubject,
  ]);

  const completePomodoroBlock = useCallback(
    async (completedDurationSeconds: number) => {
      if (autoCompletingRef.current) return;
      autoCompletingRef.current = true;

      setStartedAt(null);
      setAccumulatedMs(0);
      setSeconds(0);
      playCompletionChime();
      await clearOngoingTimerNotification();
      await cancelPomodoroFinishNotification();
      await broadcastLiveStatus(null);

      if (pomodoroPhase === "focus") {
        setCompletedPomodoros((prev) => prev + 1);
        setPomodoroPhase("break");

        if (typeof document !== "undefined" && document.hidden) {
          sendInstantSystemNotification({
            title: `Focus Complete (${focusMinutes}m)! 🍅`,
            body: `Time for a ${breakMinutes}m break.`,
          });
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && selectedSubject && completedDurationSeconds > 0) {
          const cleanedNote = activeTask?.text.trim() || null;
          const { error } = await insertSessionWithOptionalNote({
            subject: selectedSubject,
            duration: completedDurationSeconds,
            user_id: user.id,
            note: cleanedNote,
          });

          if (!error) {
            const msg = `Focus block complete (${focusMinutes}m saved)! Time for a ${breakMinutes}m break.`;
            setStatusBanner(msg);
            toast.success(
              "🍅 Focus Block Saved!",
              `Take a ${breakMinutes}m break.`
            );
            await checkNewAchievements();
          } else {
            setStatusBanner(
              `Focus block complete! Could not auto-save session: ${error.message}`
            );
            toast.error("Could not auto-save session", error.message);
          }
        } else {
          setStatusBanner(
            `Focus block complete! Sign in to save sessions to your history.`
          );
        }
      } else {
        setPomodoroPhase("focus");
        setStatusBanner("Break finished! Ready for your next focus session.");
        toast.info("⏰ Break Finished!", "Ready for your next focus session.");
        if (typeof document !== "undefined" && document.hidden) {
          sendInstantSystemNotification({
            title: "Break Finished! ⏰",
            body: "Ready for your next focus session?",
          });
        }
      }

      autoCompletingRef.current = false;
    },
    [
      pomodoroPhase,
      selectedSubject,
      activeTask,
      focusMinutes,
      breakMinutes,
      broadcastLiveStatus,
      toast,
      checkNewAchievements,
    ]
  );

  useEffect(() => {
    if (startedAt === null) return;

    const syncElapsed = () => {
      const totalMs = accumulatedMs + Math.max(0, Date.now() - startedAt);
      const elapsedSecs = Math.floor(totalMs / 1000);

      if (timerMode === "pomodoro" && elapsedSecs >= targetPomodoroSeconds) {
        completePomodoroBlock(targetPomodoroSeconds);
        return;
      }

      setSeconds(elapsedSecs);
    };

    const interval = setInterval(syncElapsed, 250);
    document.addEventListener("visibilitychange", syncElapsed);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", syncElapsed);
    };
  }, [
    startedAt,
    accumulatedMs,
    timerMode,
    targetPomodoroSeconds,
    completePomodoroBlock,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const isFocusProgress =
        hasSessionProgress &&
        (timerMode === "stopwatch" || pomodoroPhase === "focus");
      if (isFocusProgress) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasSessionProgress, timerMode, pomodoroPhase]);

  useEffect(() => {
    if (!isResetConfirmOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsResetConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isResetConfirmOpen]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (timerMode === "pomodoro" && hours === 0) {
      return [minutes, secs]
        .map((value) => value.toString().padStart(2, "0"))
        .join(":");
    }

    return [hours, minutes, secs]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  };

  const startTimer = () => {
    if (
      pomodoroPhase === "focus" &&
      !selectedSubject &&
      timerMode === "pomodoro"
    )
      return;
    if (timerMode === "stopwatch" && !selectedSubject) return;

    setStatusBanner("");
    const now = Date.now();
    setStartedAt(now);

    requestNotificationPermissions().then(() => {
      const isStudyingFocus =
        timerMode === "stopwatch" || pomodoroPhase === "focus";
      if (isStudyingFocus && selectedSubject) {
        showOngoingTimerNotification(
          selectedSubject,
          timerMode === "pomodoro" ? "Pomodoro" : "Study"
        );
      }
      if (timerMode === "pomodoro") {
        const remainingMs = Math.max(
          0,
          targetPomodoroSeconds * 1000 - accumulatedMs
        );
        schedulePomodoroFinishNotification({
          endTimestampMs: now + remainingMs,
          isBreak: pomodoroPhase === "break",
          subject: selectedSubject || "Study",
          durationMinutes:
            pomodoroPhase === "break" ? breakMinutes : focusMinutes,
        });
      }
    });

    const isStudyingFocus =
      timerMode === "stopwatch" || pomodoroPhase === "focus";
    if (isStudyingFocus && selectedSubject) {
      broadcastLiveStatus(selectedSubject, now - accumulatedMs);
    }
  };

  const pauseTimer = () => {
    if (startedAt === null) return;
    const totalMs = accumulatedMs + Math.max(0, Date.now() - startedAt);
    setAccumulatedMs(totalMs);
    setStartedAt(null);
    setSeconds(Math.floor(totalMs / 1000));
    clearOngoingTimerNotification();
    cancelPomodoroFinishNotification();
    broadcastLiveStatus(null);
  };

  const resetTimer = () => {
    setStartedAt(null);
    setAccumulatedMs(0);
    setSeconds(0);
    setStatusBanner("");
    setIsResetConfirmOpen(false);
    if (timerMode === "stopwatch") {
      localStorage.removeItem("studyTimer");
    }
    clearOngoingTimerNotification();
    cancelPomodoroFinishNotification();
    broadcastLiveStatus(null);
  };

  const requestResetTimer = () => {
    if (!hasSessionProgress) {
      resetTimer();
      return;
    }
    setIsResetConfirmOpen(true);
  };

  const confirmResetTimer = () => {
    resetTimer();
  };

  const skipBreak = () => {
    setStartedAt(null);
    setAccumulatedMs(0);
    setSeconds(0);
    setPomodoroPhase("focus");
    setStatusBanner("");
    clearOngoingTimerNotification();
    cancelPomodoroFinishNotification();
  };

  const applyPreset = (nextPreset: "25-5" | "50-10" | "custom") => {
    if (hasSessionProgress) return;
    setPreset(nextPreset);
    if (nextPreset === "25-5") {
      setFocusMinutes(25);
      setBreakMinutes(5);
    } else if (nextPreset === "50-10") {
      setFocusMinutes(50);
      setBreakMinutes(10);
    }
  };

  const finishSession = async () => {
    const totalMs =
      accumulatedMs +
      (startedAt !== null ? Math.max(0, Date.now() - startedAt) : 0);
    const finalSeconds = Math.floor(totalMs / 1000);

    if (finalSeconds === 0 || !selectedSubject) return;
    if (timerMode === "pomodoro" && pomodoroPhase === "break") {
      skipBreak();
      return;
    }

    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    setAccumulatedMs(totalMs);
    setStartedAt(null);
    setSeconds(finalSeconds);
    await clearOngoingTimerNotification();
    await cancelPomodoroFinishNotification();
    await broadcastLiveStatus(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.info(
          "Session paused!",
          "Sign in or create an account to save your study progress."
        );

        router.push("/login");
        return;
      }

      const cleanedNote = activeTask?.text.trim() || null;
      const { error } = await insertSessionWithOptionalNote({
        subject: selectedSubject,
        duration: finalSeconds,
        user_id: user.id,
        note: cleanedNote,
      });

      if (error) {
        console.error(error);
        toast.error(
          "Could not save session",
          "Your elapsed time is kept — please try again."
        );
        return;
      }

      setStartedAt(null);
      setAccumulatedMs(0);
      setSeconds(0);
      if (timerMode === "stopwatch") {
        localStorage.removeItem("studyTimer");
      }

      setStatusBanner("Study session saved!");
      toast.success(
        "Study session saved!",
        `${selectedSubject} · ${formatTime(finalSeconds)}`
      );
      await checkNewAchievements();
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const label =
      timerMode === "pomodoro" && pomodoroPhase === "break"
        ? "Break"
        : selectedSubject || "Study";

    if (isRunning) {
      document.title = `${formatTime(displaySeconds)} - ${label}`;
    } else if (seconds > 0) {
      document.title = `${formatTime(displaySeconds)} - Paused`;
    } else {
      document.title = "StudyTracker";
    }

    return () => {
      document.title = "StudyTracker";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displaySeconds,
    seconds,
    isRunning,
    selectedSubject,
    timerMode,
    pomodoroPhase,
  ]);

  useEffect(() => {
    if (!isMinimalFocus) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMinimalFocus(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMinimalFocus]);

  const toggleTodoDrawer = () => {
    setIsTodoOpen((prev) => {
      const next = !prev;
      if (next && tasks.length === 0) {
        setTimeout(() => {
          newTaskInputRef.current?.focus();
        }, 0);
      }
      return next;
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim().slice(0, 140);
    if (!text) return;

    const newTask: StudyTask = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      done: false,
    };

    const prevTasks = tasksRef.current;
    const nextTasks = [...prevTasks, newTask].slice(-MAX_SYNCED_TASKS);
    const currentActive =
      prevTasks.find((t) => t.id === activeTaskIdRef.current && !t.done) ??
      prevTasks.find((t) => !t.done) ??
      null;
    const nextActiveId = currentActive ? currentActive.id : newTask.id;

    applyTaskState(nextTasks, nextActiveId);
    setNewTaskText("");
    newTaskInputRef.current?.focus();
  };

  const toggleTaskDone = (taskId: string) => {
    const prevTasks = tasksRef.current;
    const target = prevTasks.find((t) => t.id === taskId);
    if (!target) return;

    const currentActive =
      prevTasks.find((t) => t.id === activeTaskIdRef.current && !t.done) ??
      prevTasks.find((t) => !t.done) ??
      null;
    const willMarkDone = !target.done;
    const nextTasks = prevTasks.map((task) =>
      task.id === taskId ? { ...task, done: !task.done } : task
    );

    applyTaskState(nextTasks, activeTaskIdRef.current);

    if (willMarkDone && currentActive?.id === taskId) {
      toast.success("Task completed!", target.text);
    }
  };

  const selectActiveTask = (taskId: string) => {
    const nextTasks = tasksRef.current.map((task) =>
      task.id === taskId && task.done ? { ...task, done: false } : task
    );
    applyTaskState(nextTasks, taskId);
    setIsTodoOpen(false);
  };

  const deleteTask = (taskId: string) => {
    const nextTasks = tasksRef.current.filter((task) => task.id !== taskId);
    const nextActiveId =
      activeTaskIdRef.current === taskId ? null : activeTaskIdRef.current;
    applyTaskState(nextTasks, nextActiveId);
  };

  const clearCompletedTasks = () => {
    const nextTasks = tasksRef.current.filter((task) => !task.done);
    applyTaskState(nextTasks, activeTaskIdRef.current);
  };

  const enterMinimalFocus = () => {
    if (timerMode === "pomodoro" && pomodoroPhase === "break") {
      setStartedAt(null);
      setAccumulatedMs(0);
      setSeconds(0);
    }
    setTimerMode("stopwatch");
    setPomodoroPhase("focus");
    setStatusBanner("");
    setIsMinimalFocus(true);
  };

  const isBreakPhase = timerMode === "pomodoro" && pomodoroPhase === "break";

  const resetConfirmModal = isResetConfirmOpen ? (
    <div
      onClick={() => setIsResetConfirmOpen(false)}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-timer-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111113] p-5 text-left shadow-2xl"
      >
        <h2
          id="reset-timer-confirm-title"
          className="text-base font-semibold text-white"
        >
          Reset timer?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {isBreakPhase ? (
            "This will reset your current break timer back to the start."
          ) : seconds > 0 ? (
            <>
              You&apos;ll lose{" "}
              <span className="font-mono font-semibold text-white tabular-nums">
                {formatTime(seconds)}
              </span>{" "}
              of unsaved progress
              {selectedSubject ? (
                <>
                  {" "}
                  in <span className="font-medium text-white">{selectedSubject}</span>
                </>
              ) : null}
              . This cannot be undone.
            </>
          ) : (
            "This will stop and reset your current study session."
          )}
        </p>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(false)}
            className="h-9 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white transition hover:bg-white/10 sm:text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmResetTimer}
            className="h-9 rounded-xl bg-red-500 px-4 text-xs font-semibold text-white transition hover:bg-red-400 sm:text-sm"
          >
            Reset timer
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Distraction-free Minimal Focus Mode
  if (isMinimalFocus) {
    return (
      <main className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b] px-5">
        <button
          type="button"
          onClick={() => setIsMinimalFocus(false)}
          className="fixed right-5 top-[max(1.25rem,env(safe-area-inset-top))] rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/30 hover:text-white"
        >
          Exit Focus
        </button>

        <div className="w-full max-w-md text-center">
          {hasSessionProgress ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111113] px-3.5 py-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selectedColor }}
              />
              <span className="text-xs font-medium text-white/80">
                {selectedSubject || "Study"}
              </span>
            </div>
          ) : (
            <div className="relative mx-auto inline-flex h-10 min-w-[200px] max-w-[260px] items-center rounded-full border border-white/12 bg-[#111113] px-4 transition hover:border-white/25">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: selectedColor,
                  boxShadow: selectedSubject
                    ? `0 0 8px ${selectedColor}66`
                    : undefined,
                }}
              />
              <span className="mx-2.5 flex-1 truncate text-left text-sm font-medium text-white/90">
                {selectedSubject || "No subjects yet"}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-white/45"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={subjects.length === 0}
                aria-label="Subject"
                className="absolute inset-0 h-full w-full cursor-pointer rounded-full bg-[#111113] text-white opacity-0 disabled:cursor-not-allowed"
              >
                {subjects.length === 0 ? (
                  <option value="" className="bg-[#111113] text-white">
                    No subjects yet
                  </option>
                ) : (
                  subjects.map((subject) => (
                    <option
                      key={subject}
                      value={subject}
                      className="bg-[#111113] text-white"
                    >
                      {subject}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {activeTask && (
            <div className="mt-4 flex justify-center">
              <div className="inline-flex max-w-xs items-center gap-2 rounded-full border border-white/10 bg-[#111113] px-3.5 py-1.5">
                <button
                  type="button"
                  onClick={() => toggleTaskDone(activeTask.id)}
                  aria-label="Complete current task"
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/40 transition hover:border-emerald-400 hover:bg-emerald-400/20"
                />
                <span className="truncate text-xs font-medium text-white/85">
                  {activeTask.text}
                </span>
              </div>
            </div>
          )}

          <p className="my-10 font-mono text-5xl font-bold tracking-tight tabular-nums sm:my-14 sm:text-7xl">
            {formatTime(seconds)}
          </p>

          <div className="mx-auto grid max-w-sm grid-cols-[1fr_1.35fr_1fr] gap-2.5">
            <button
              type="button"
              onClick={requestResetTimer}
              className="h-11 rounded-xl border border-white/15 text-xs font-semibold text-white/80 transition hover:bg-white/5 sm:text-sm"
            >
              Reset
            </button>

            {!isRunning ? (
              <button
                onClick={startTimer}
                disabled={!selectedSubject}
                className="h-11 rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {seconds > 0 ? "Resume" : "Start"}
              </button>
            ) : (
              <button
                onClick={pauseTimer}
                className="h-11 rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Pause
              </button>
            )}

            <button
              onClick={finishSession}
              disabled={seconds === 0 || !selectedSubject || isSaving}
              className="h-11 rounded-xl border border-white/15 text-xs font-semibold text-white/90 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30 sm:text-sm"
            >
              {isSaving ? "..." : "Finish"}
            </button>
          </div>
        </div>
        {resetConfirmModal}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6 sm:py-10">
      {/* Compact Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Study Timer
          </h1>
          <p className="mt-0.5 text-xs text-white/55 sm:text-sm">
            Open-ended stopwatch or structured Pomodoro focus.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={enterMinimalFocus}
            className="h-9 rounded-xl border border-white/12 bg-[#111113] px-3 text-xs font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            Focus Mode
          </button>

          <div className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-[#111113] p-1">
            <button
              type="button"
              disabled={hasSessionProgress}
              onClick={() => {
                setTimerMode("stopwatch");
                setStatusBanner("");
              }}
              className={`h-7 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                timerMode === "stopwatch"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Stopwatch
            </button>
            <button
              type="button"
              disabled={hasSessionProgress}
              onClick={() => {
                setTimerMode("pomodoro");
                setPomodoroPhase("focus");
                setStatusBanner("");
              }}
              className={`h-7 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                timerMode === "pomodoro"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Pomodoro
            </button>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          {statusBanner}
        </div>
      )}

      {/* Main Timer Card (Fits cleanly on 1 mobile screen without scrolling) */}
      <div className="mt-5 rounded-3xl border border-white/[0.08] bg-[#111113] p-4 sm:mt-6 sm:p-8">
        {timerMode === "pomodoro" && (
          <div className="mx-auto mb-5 max-w-lg space-y-3 border-b border-white/[0.08] pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-xl border border-white/10 bg-[#09090b] p-1">
                <button
                  type="button"
                  disabled={hasSessionProgress}
                  onClick={() => setPomodoroPhase("focus")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                    pomodoroPhase === "focus"
                      ? "bg-white text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Focus ({focusMinutes}m)
                </button>
                <button
                  type="button"
                  disabled={hasSessionProgress}
                  onClick={() => setPomodoroPhase("break")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                    pomodoroPhase === "break"
                      ? "bg-emerald-400 text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Break ({breakMinutes}m)
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {(["25-5", "50-10", "custom"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={hasSessionProgress}
                    onClick={() => applyPreset(option)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                      preset === option
                        ? "border-white/35 bg-white/12 text-white"
                        : "border-white/10 text-white/55 hover:text-white"
                    }`}
                  >
                    {option === "25-5"
                      ? "25/5"
                      : option === "50-10"
                        ? "50/10"
                        : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-1 sm:w-64">
                <div>
                  <label className="mb-1 block text-[11px] text-white/50">
                    Focus (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    disabled={hasSessionProgress}
                    value={focusMinutes}
                    onChange={(e) =>
                      setFocusMinutes(
                        Math.min(180, Math.max(1, Number(e.target.value) || 1))
                      )
                    }
                    className="h-9 w-full rounded-xl border border-white/10 bg-[#09090b] px-3 text-sm outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-white/50">
                    Break (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    disabled={hasSessionProgress}
                    value={breakMinutes}
                    onChange={(e) =>
                      setBreakMinutes(
                        Math.min(60, Math.max(1, Number(e.target.value) || 1))
                      )
                    }
                    className="h-9 w-full rounded-xl border border-white/10 bg-[#09090b] px-3 text-sm outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {completedPomodoros > 0 && (
              <p className="text-[11px] text-white/55">
                Completed focus blocks:{" "}
                <span className="font-semibold text-white">
                  {completedPomodoros} 🍅
                </span>
              </p>
            )}
          </div>
        )}

        {/* Unified Subject + Session Note Pod */}
        {!isBreakPhase && (
          <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus-within:border-white/20">
            <div className="grid grid-cols-1 divide-y divide-white/[0.08] sm:grid-cols-[210px_1fr] sm:divide-x sm:divide-y-0">
              {/* Left Segment: Subject Selector */}
              <div
                className={`relative px-4 py-2.5 transition ${
                  hasSessionProgress
                    ? "opacity-65"
                    : "hover:bg-white/[0.025] focus-within:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-white/40">
                    Subject
                  </span>
                  {hasSessionProgress && (
                    <span className="text-[10px] font-medium text-white/35">
                      Locked
                    </span>
                  )}
                </div>

                {isLoggedIn && subjects.length === 0 ? (
                  <div className="mt-1 flex h-6 items-center">
                    <Link
                      href="/subject"
                      className="text-sm font-medium text-emerald-400 hover:underline"
                    >
                      + Add subject →
                    </Link>
                  </div>
                ) : (
                  <div className="mt-1 flex h-6 items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
                        style={{
                          backgroundColor: selectedColor,
                          boxShadow: selectedSubject
                            ? `0 0 10px ${selectedColor}66`
                            : undefined,
                        }}
                      />
                      <span className="truncate text-sm font-medium text-white">
                        {selectedSubject || "No subjects yet"}
                      </span>
                    </div>

                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-white/40"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>

                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      disabled={hasSessionProgress || subjects.length === 0}
                      aria-label="Subject"
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-[#111113] text-white opacity-0 disabled:cursor-not-allowed"
                    >
                      {subjects.length === 0 ? (
                        <option value="" className="bg-[#111113] text-white">
                          No subjects yet
                        </option>
                      ) : (
                        subjects.map((subject) => (
                          <option
                            key={subject}
                            value={subject}
                            className="bg-[#111113] text-white"
                          >
                            {subject}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Right Segment: Current Task & Hidden To-Do Trigger */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isTodoOpen}
                onClick={toggleTodoDrawer}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleTodoDrawer();
                  }
                }}
                className="cursor-pointer px-4 py-2.5 transition hover:bg-white/[0.025] focus-visible:bg-white/[0.03] focus-visible:outline-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-white/40">
                    Current Task
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] tabular-nums text-white/35">
                    <span>
                      {tasks.length === 0
                        ? "To-do"
                        : remainingTasksCount === 0
                          ? "All done"
                          : `${remainingTasksCount} left`}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`h-3 w-3 transition-transform ${
                        isTodoOpen ? "rotate-180" : ""
                      }`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div className="mt-1 flex h-6 items-center justify-between gap-2">
                  {activeTask ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskDone(activeTask.id);
                        }}
                        aria-label="Complete current task"
                        className="h-4 w-4 shrink-0 rounded-full border border-white/35 transition hover:border-emerald-400 hover:bg-emerald-400/20"
                      />
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-white">
                        {activeTask.text}
                      </span>
                      {remainingTasksCount > 1 && (
                        <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/55">
                          +{remainingTasksCount - 1}
                        </span>
                      )}
                    </>
                  ) : tasks.length > 0 ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-emerald-400"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span className="truncate text-sm font-medium text-emerald-400">
                        All tasks completed
                      </span>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2 text-white/35">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      >
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <span className="truncate text-sm">Add a task...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible Hidden To-Do List Drawer */}
            {isTodoOpen && (
              <div className="border-t border-white/[0.08] bg-[#0c0c0e] p-3.5">
                <form
                  onSubmit={handleAddTask}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={newTaskInputRef}
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    maxLength={140}
                    placeholder="Add a task to your to-do list..."
                    aria-label="New task"
                    className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#09090b] px-3 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/25 sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!newTaskText.trim()}
                    className="h-9 shrink-0 rounded-xl bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
                  >
                    Add
                  </button>
                </form>

                <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto">
                  {tasks.length === 0 ? (
                    <p className="py-2 text-center text-xs text-white/40">
                      Add tasks above — only the one you&apos;re working on will
                      show while the timer runs.
                    </p>
                  ) : (
                    tasks.map((task) => {
                      const isActive = activeTask?.id === task.id;
                      return (
                        <div
                          key={task.id}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
                            isActive
                              ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                              : "border-white/[0.06] bg-[#09090b]/80 hover:border-white/15"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleTaskDone(task.id)}
                            aria-label={
                              task.done
                                ? `Mark "${task.text}" incomplete`
                                : `Mark "${task.text}" complete`
                            }
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                              task.done
                                ? "border-emerald-400 bg-emerald-400 text-black"
                                : "border-white/35 hover:border-emerald-400"
                            }`}
                          >
                            {task.done && (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                className="h-2.5 w-2.5"
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => selectActiveTask(task.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span
                              className={`block truncate text-xs sm:text-sm ${
                                task.done
                                  ? "text-white/35 line-through"
                                  : isActive
                                    ? "font-medium text-white"
                                    : "text-white/80"
                              }`}
                            >
                              {task.text}
                            </span>
                          </button>

                          {isActive ? (
                            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Working on
                            </span>
                          ) : (
                            !task.done && (
                              <button
                                type="button"
                                onClick={() => selectActiveTask(task.id)}
                                className="shrink-0 text-[10px] font-medium text-white/35 transition hover:text-white/75"
                              >
                                Focus
                              </button>
                            )
                          )}

                          <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            aria-label={`Delete task "${task.text}"`}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] text-white/30 transition hover:bg-white/10 hover:text-rose-300"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-white/40">
                      {completedTasksCount}/{tasks.length} done
                    </span>
                    <span
                      className={
                        !isLoggedIn
                          ? "text-white/35"
                          : taskSyncStatus === "syncing"
                            ? "text-white/45"
                            : taskSyncStatus === "error"
                              ? "text-rose-400"
                              : "text-emerald-400/80"
                      }
                    >
                      ·{" "}
                      {!isLoggedIn
                        ? "Local only"
                        : taskSyncStatus === "syncing"
                          ? "Syncing..."
                          : taskSyncStatus === "error"
                            ? "Sync error"
                            : "Synced"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {completedTasksCount > 0 && (
                      <button
                        type="button"
                        onClick={clearCompletedTasks}
                        className="text-white/45 transition hover:text-white"
                      >
                        Clear done
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTodoOpen(false)}
                      className="font-medium text-white/65 transition hover:text-white"
                    >
                      Hide list
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Proportioned Timer Readout */}
        <div className="py-9 text-center sm:py-12">
          {isBreakPhase && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Break Time
            </p>
          )}

          <p className="font-mono text-5xl font-bold tracking-tight tabular-nums sm:text-7xl">
            {formatTime(displaySeconds)}
          </p>

          {timerMode === "pomodoro" && (
            <div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pomodoroProgressPercent}%`,
                  backgroundColor: isBreakPhase ? "#34d399" : selectedColor,
                }}
              />
            </div>
          )}
        </div>

        {/* Single-Row Balanced Controls (Aligned with Session Pod) */}
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_1.35fr_1fr] gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={requestResetTimer}
            className="h-11 rounded-xl border border-white/15 text-xs font-semibold text-white/80 transition hover:bg-white/5 sm:text-sm"
          >
            Reset
          </button>

          {!isRunning ? (
            <button
              onClick={startTimer}
              disabled={!isBreakPhase && !selectedSubject}
              className={`h-11 rounded-xl text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                isBreakPhase
                  ? "bg-emerald-400 hover:bg-emerald-300"
                  : "bg-white hover:bg-white/90"
              }`}
            >
              {seconds > 0
                ? "Resume"
                : isBreakPhase
                  ? "Start Break"
                  : "Start"}
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="h-11 rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Pause
            </button>
          )}

          {isBreakPhase ? (
            <button
              onClick={skipBreak}
              className="h-11 rounded-xl border border-white/15 text-xs font-semibold text-white/85 transition hover:bg-white/5 sm:text-sm"
            >
              Skip
            </button>
          ) : (
            <button
              onClick={finishSession}
              disabled={seconds === 0 || !selectedSubject || isSaving}
              className="h-11 rounded-xl border border-white/15 text-xs font-semibold text-white/90 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30 sm:text-sm"
            >
              {isSaving ? "Saving..." : "Finish"}
            </button>
          )}
        </div>
      </div>
      {resetConfirmModal}
    </main>
  );
}
