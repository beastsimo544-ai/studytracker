"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
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

type TimerMode = "stopwatch" | "pomodoro";
type PomodoroPhase = "focus" | "break";

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
  const [sessionNote, setSessionNote] = useState("");
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

  const isSavingRef = useRef(false);
  const autoCompletingRef = useRef(false);
  const noteInputRef = useRef<HTMLInputElement | null>(null);

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
          if (typeof parsedTimer.sessionNote === "string") {
            setSessionNote(parsedTimer.sessionNote);
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

      setHasHydrated(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(Boolean(user));

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
  }, []);

  // Save active/paused timer state
  useEffect(() => {
    if (!hasHydrated) return;

    if (
      accumulatedMs === 0 &&
      startedAt === null &&
      timerMode === "stopwatch" &&
      !sessionNote.trim()
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
        sessionNote,
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
    sessionNote,
    accumulatedMs,
    startedAt,
    selectedSubject,
    hasHydrated,
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
          const cleanedNote = sessionNote.trim() || null;
          const { error } = await insertSessionWithOptionalNote({
            subject: selectedSubject,
            duration: completedDurationSeconds,
            user_id: user.id,
            note: cleanedNote,
          });

          if (!error) {
            setSessionNote("");
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
      sessionNote,
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
    if (timerMode === "stopwatch") {
      localStorage.removeItem("studyTimer");
    }
    clearOngoingTimerNotification();
    cancelPomodoroFinishNotification();
    broadcastLiveStatus(null);
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

      const cleanedNote = sessionNote.trim() || null;
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
      setSessionNote("");
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

          <p className="my-10 font-mono text-5xl font-bold tracking-tight tabular-nums sm:my-14 sm:text-7xl">
            {formatTime(seconds)}
          </p>

          <div className="mx-auto grid max-w-sm grid-cols-[1fr_1.35fr_1fr] gap-2.5">
            <button
              onClick={resetTimer}
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

              {/* Right Segment: Session Note */}
              <div
                onClick={() => noteInputRef.current?.focus()}
                className="cursor-text px-4 py-2.5 transition hover:bg-white/[0.02] focus-within:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-white/40">
                    Session Note
                  </span>
                  <span className="text-[10px] tabular-nums text-white/30">
                    {sessionNote.length > 0
                      ? `${sessionNote.length}/140`
                      : "Optional"}
                  </span>
                </div>

                <div className="relative mt-1 flex h-6 items-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="mr-2 h-3.5 w-3.5 shrink-0 text-white/35"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>

                  <input
                    ref={noteInputRef}
                    type="text"
                    value={sessionNote}
                    onChange={(e) => setSessionNote(e.target.value)}
                    maxLength={140}
                    placeholder="What are you working on?"
                    aria-label="Session Note"
                    className="h-6 w-full bg-transparent pr-6 text-sm text-white placeholder:text-white/30 outline-none"
                  />

                  {sessionNote.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionNote("");
                        noteInputRef.current?.focus();
                      }}
                      aria-label="Clear note"
                      className="absolute right-0 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
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
            onClick={resetTimer}
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
    </main>
  );
}
