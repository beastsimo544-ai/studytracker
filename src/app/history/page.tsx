"use client";

import { useEffect, useState } from "react";

type StudySession = {
  id: string;
  subject: string;
  duration: number;
  date: string;
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    const savedSessions = JSON.parse(
      localStorage.getItem("studySessions") || "[]"
    );

    setSessions(savedSessions);
  }, []);

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Study History</h1>

        <p className="mt-2 text-white/60">
          Review your previous study sessions.
        </p>
      </div>

      <div className="mt-10">
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/60">
              You haven&apos;t completed any study sessions yet.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-5 last:border-b-0"
              >
                <div>
                  <p className="text-lg font-semibold">
                    {session.subject}
                  </p>

                  <p className="mt-1 text-sm text-white/50">
                    {formatDate(session.date)}
                  </p>
                </div>

                <p className="font-mono text-lg font-semibold">
                  {formatDuration(session.duration)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}