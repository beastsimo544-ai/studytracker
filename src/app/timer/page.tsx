"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TimerPage() {
  const router = useRouter();

  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const isRunning = startedAt !== null;
  const hasSessionProgress = seconds > 0 || accumulatedMs > 0 || isRunning;

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
            // Backwards compatibility with legacy { seconds, isRunning } format
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

    if (accumulatedMs === 0 && startedAt === null) {
      localStorage.removeItem("studyTimer");
      return;
    }

    const currentMs =
      accumulatedMs +
      (startedAt !== null ? Math.max(0, Date.now() - startedAt) : 0);

    localStorage.setItem(
      "studyTimer",
      JSON.stringify({
        accumulatedMs,
        startedAt,
        isRunning: startedAt !== null,
        seconds: Math.floor(currentMs / 1000),
        selectedSubject,
      })
    );
  }, [accumulatedMs, startedAt, selectedSubject, hasHydrated]);

  // Update displayed seconds from wall-clock elapsed time
  useEffect(() => {
    if (startedAt === null) return;

    const syncElapsed = () => {
      const totalMs = accumulatedMs + Math.max(0, Date.now() - startedAt);
      setSeconds(Math.floor(totalMs / 1000));
    };

    const interval = setInterval(syncElapsed, 250);
    document.addEventListener("visibilitychange", syncElapsed);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", syncElapsed);
    };
  }, [startedAt, accumulatedMs]);

  // Warn user before closing tab with an unsaved session
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasSessionProgress) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasSessionProgress]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return [hours, minutes, secs]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  };

  const startTimer = () => {
    if (!selectedSubject) return;
    setStartedAt(Date.now());
  };

  const pauseTimer = () => {
    if (startedAt === null) return;
    const totalMs = accumulatedMs + Math.max(0, Date.now() - startedAt);
    setAccumulatedMs(totalMs);
    setStartedAt(null);
    setSeconds(Math.floor(totalMs / 1000));
  };

  const resetTimer = () => {
    setStartedAt(null);
    setAccumulatedMs(0);
    setSeconds(0);
    localStorage.removeItem("studyTimer");
  };

  const finishSession = async () => {
    const totalMs =
      accumulatedMs +
      (startedAt !== null ? Math.max(0, Date.now() - startedAt) : 0);
    const finalSeconds = Math.floor(totalMs / 1000);

    if (finalSeconds === 0 || !selectedSubject) return;

    // Block double-clicks / repeated clicks while a save is already in flight
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    // Freeze the timer immediately so the duration can't change mid-save
    setAccumulatedMs(totalMs);
    setStartedAt(null);
    setSeconds(finalSeconds);

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
        alert("Could not save session to database. Your time is kept — try again.");
        return;
      }

      setStartedAt(null);
      setAccumulatedMs(0);
      setSeconds(0);
      localStorage.removeItem("studyTimer");

      alert("Study session saved!");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Browser tab title
  useEffect(() => {
    if (isRunning) {
      document.title = `${formatTime(seconds)} - ${selectedSubject}`;
    } else if (seconds > 0) {
      document.title = `${formatTime(seconds)} - Paused`;
    } else {
      document.title = "StudyTracker";
    }

    return () => {
      document.title = "StudyTracker";
    };
  }, [seconds, isRunning, selectedSubject]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Study Timer</h1>

        <p className="mt-2 text-white/60">
          Choose a subject and start studying.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
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

        <div className="py-16 text-center">
          <p className="font-mono text-6xl font-bold tracking-wider">
            {formatTime(seconds)}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
          {!isRunning ? (
            <button
              onClick={startTimer}
              disabled={!selectedSubject}
              className="rounded-xl bg-white px-8 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {seconds > 0 ? "Resume" : "Start"}
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

          <button
            onClick={finishSession}
            disabled={seconds === 0 || !selectedSubject || isSaving}
            className="rounded-xl border border-white/20 px-8 py-3 font-semibold transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isSaving ? "Saving..." : "Finish Session"}
          </button>
        </div>
      </div>
    </main>
  );
}
