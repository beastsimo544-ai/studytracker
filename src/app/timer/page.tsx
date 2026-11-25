"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

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

export default function TimerPage() {
  const router = useRouter();

  const [timerMode, setTimerMode] = useState<TimerMode>("stopwatch");
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>("focus");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [preset, setPreset] = useState<"25-5" | "50-10" | "custom">("25-5");
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [statusBanner, setStatusBanner] = useState("");

  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isSavingRef = useRef(false);
  const autoCompletingRef = useRef(false);

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

  // Broadcast live "Studying Now" status to public.profiles for Friends page
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
        // Optional columns may not exist yet before running SQL migration
      }
    },
    []
  );

  // Keep phone/laptop screen awake while the timer is actively running
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
        // Ignore if battery saver or background state rejects wakeLock
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

      const { data, error } = await supabase
        .from("subjects")
        .select("name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      const subjectNames = (data || []).map((subject) => subject.name);

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

  // Save active/paused timer state using wall-clock timestamps
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

  // Handle Pomodoro block completion
  const completePomodoroBlock = useCallback(
    async (completedDurationSeconds: number) => {
      if (autoCompletingRef.current) return;
      autoCompletingRef.current = true;

      setStartedAt(null);
      setAccumulatedMs(0);
      setSeconds(0);
      playCompletionChime();
      await broadcastLiveStatus(null);

      if (pomodoroPhase === "focus") {
        setCompletedPomodoros((prev) => prev + 1);
        setPomodoroPhase("break");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && selectedSubject && completedDurationSeconds > 0) {
          const { error } = await supabase.from("study_sessions").insert({
            subject: selectedSubject,
            duration: completedDurationSeconds,
            user_id: user.id,
          });

          if (!error) {
            setStatusBanner(
              `Focus block complete (${focusMinutes}m saved)! Time for a ${breakMinutes}m break.`
            );
          } else {
            setStatusBanner(
              `Focus block complete! Could not auto-save session: ${error.message}`
            );
          }
        } else {
          setStatusBanner(
            `Focus block complete! Sign in to save sessions to your history.`
          );
        }
      } else {
        setPomodoroPhase("focus");
        setStatusBanner("Break finished! Ready for your next focus session.");
      }

      autoCompletingRef.current = false;
    },
    [
      pomodoroPhase,
      selectedSubject,
      focusMinutes,
      breakMinutes,
      broadcastLiveStatus,
    ]
  );

  // Update displayed seconds from wall-clock elapsed time
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

  // Warn user before closing tab with an unsaved focus session
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
    if (pomodoroPhase === "focus" && !selectedSubject && timerMode === "pomodoro")
      return;
    if (timerMode === "stopwatch" && !selectedSubject) return;

    setStatusBanner("");
    const now = Date.now();
    setStartedAt(now);

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
    broadcastLiveStatus(null);
  };

  const skipBreak = () => {
    setStartedAt(null);
    setAccumulatedMs(0);
    setSeconds(0);
    setPomodoroPhase("focus");
    setStatusBanner("");
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
    await broadcastLiveStatus(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        alert(
          "Session paused! Log in or create an account to save your study progress."
        );

        router.push("/login");
        return;
      }

      const { error } = await supabase.from("study_sessions").insert({
        subject: selectedSubject,
        duration: finalSeconds,
        user_id: user.id,
      });

      if (error) {
        console.error(error);
        alert(
          "Could not save session to database. Your time is kept — try again."
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
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Browser tab title
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
  }, [displaySeconds, seconds, isRunning, selectedSubject, timerMode, pomodoroPhase]);

  const isBreakPhase = timerMode === "pomodoro" && pomodoroPhase === "break";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Study Timer</h1>
          <p className="mt-2 text-white/60">
            Track open-ended sessions or focus with Pomodoro blocks.
          </p>
        </div>

        {/* Stopwatch / Pomodoro Switcher */}
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            disabled={hasSessionProgress}
            onClick={() => {
              setTimerMode("stopwatch");
              setStatusBanner("");
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              timerMode === "stopwatch"
                ? "bg-white text-black"
                : "text-white/65 hover:text-white"
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
            className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              timerMode === "pomodoro"
                ? "bg-white text-black"
                : "text-white/65 hover:text-white"
            }`}
          >
            Pomodoro
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-6 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {statusBanner}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
        {/* Pomodoro controls & phase pills */}
        {timerMode === "pomodoro" && (
          <div className="mb-6 space-y-4 border-b border-white/10 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
                <button
                  type="button"
                  disabled={hasSessionProgress}
                  onClick={() => setPomodoroPhase("focus")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
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
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    pomodoroPhase === "break"
                      ? "bg-emerald-400 text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Break ({breakMinutes}m)
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(["25-5", "50-10", "custom"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={hasSessionProgress}
                    onClick={() => applyPreset(option)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                      preset === option
                        ? "border-white/40 bg-white/15 text-white"
                        : "border-white/10 text-white/55 hover:text-white"
                    }`}
                  >
                    {option === "25-5"
                      ? "25 / 5"
                      : option === "50-10"
                        ? "50 / 10"
                        : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            {preset === "custom" && (
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div>
                  <label className="mb-1 block text-xs text-white/50">
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
                    className="w-24 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-white/50">
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
                    className="w-24 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {completedPomodoros > 0 && (
              <p className="text-xs text-white/60">
                Completed focus blocks:{" "}
                <span className="font-semibold text-white">
                  {completedPomodoros} 🍅
                </span>
              </p>
            )}
          </div>
        )}

        {/* Subject Selector */}
        {!isBreakPhase && (
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/60">Subject</label>

              {isLoggedIn && subjects.length === 0 && (
                <Link
                  href="/subject"
                  className="text-sm text-white underline hover:text-white/80"
                >
                  Add a subject first →
                </Link>
              )}
            </div>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={hasSessionProgress || subjects.length === 0}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {subjects.length === 0 ? (
                <option value="">No subjects yet</option>
              ) : (
                subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* Timer Readout */}
        <div className="py-14 text-center">
          {isBreakPhase && (
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-emerald-400">
              Break Time
            </p>
          )}

          <p className="font-mono text-6xl font-bold tracking-wider sm:text-7xl">
            {formatTime(displaySeconds)}
          </p>

          {timerMode === "pomodoro" && (
            <div className="mx-auto mt-6 h-2 max-w-sm overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${
                  isBreakPhase ? "bg-emerald-400" : "bg-white"
                }`}
                style={{ width: `${pomodoroProgressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          {!isRunning ? (
            <button
              onClick={startTimer}
              disabled={!isBreakPhase && !selectedSubject}
              className={`rounded-xl px-8 py-3 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
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
              className="rounded-xl bg-white px-8 py-3 font-semibold text-black transition hover:bg-white/90"
            >
              Pause
            </button>
          )}

          <button
            onClick={resetTimer}
            className="rounded-xl border border-white/20 px-8 py-3 font-semibold transition hover:bg-white/5"
          >
            Reset
          </button>

          {isBreakPhase ? (
            <button
              onClick={skipBreak}
              className="rounded-xl border border-white/20 px-8 py-3 font-semibold transition hover:bg-white/5"
            >
              Skip Break
            </button>
          ) : (
            <button
              onClick={finishSession}
              disabled={seconds === 0 || !selectedSubject || isSaving}
              className="rounded-xl border border-white/20 px-8 py-3 font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isSaving ? "Saving..." : "Finish Session"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
