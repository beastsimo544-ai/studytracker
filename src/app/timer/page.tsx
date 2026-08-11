"use client";

import { useEffect, useState } from "react";
type StudySession = {
  id: string;
  subject: string;
  duration: number;
  date: string;
};
export default function TimerPage() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);
   const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return [hours, minutes, secs]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  };
  const finishSession = () => {
  if (seconds === 0) return;

  const newSession: StudySession = {
    id: crypto.randomUUID(),
    subject: selectedSubject,
    duration: seconds,
    date: new Date().toISOString(),
  };

  const existingSessions = JSON.parse(
    localStorage.getItem("studySessions") || "[]"
  );

  const updatedSessions = [newSession, ...existingSessions];

  localStorage.setItem(
    "studySessions",
    JSON.stringify(updatedSessions)
  );

  setIsRunning(false);
  setSeconds(0);

  alert("Study session saved!");
};
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

 

  const resetTimer = () => {
    setIsRunning(false);
    setSeconds(0);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Study Timer</h1>
        <p className="mt-2 text-white/60">
          Choose a subject and start studying.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
        <label className="text-sm text-white/60">
          Subject
        </label>

        <select
  value={selectedSubject}
  onChange={(e) => setSelectedSubject(e.target.value)}
  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
>
          <option>Mathematics</option>
          <option>Programming</option>
          <option>German</option>
        </select>

        <div className="py-16 text-center">
          <p className="font-mono text-6xl font-bold tracking-wider">
            {formatTime(seconds)}
          </p>
        </div>

        <div className="flex justify-center gap-4">
  {!isRunning ? (
    <button
      onClick={() => setIsRunning(true)}
      className="rounded-xl bg-white px-8 py-3 font-semibold text-black"
    >
      Start
    </button>
  ) : (
    <button
      onClick={() => setIsRunning(false)}
      className="rounded-xl bg-white px-8 py-3 font-semibold text-black"
    >
      Pause
    </button>
  )}

  <button
    onClick={resetTimer}
    className="rounded-xl border border-white/20 px-8 py-3 font-semibold"
  >
    Reset
  </button>

  <button
    onClick={finishSession}
    disabled={seconds === 0}
    className="rounded-xl border border-white/20 px-8 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-30"
  >
    Finish Session
  </button>
</div>
      </div>
    </main>
  );
}