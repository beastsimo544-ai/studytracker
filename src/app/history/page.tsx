"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StudySession = {
  id: number;
  subject: string;
  duration: number;
  created_at: string;
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("All");

  const router = useRouter();

  useEffect(() => {
    const fetchSessions = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("study_sessions")
        .select("id, subject, duration, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setSessions(data || []);
    };

    fetchSessions();
  }, [router]);

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

  // Get unique subjects from study history
  const subjects = Array.from(
    new Set(sessions.map((session) => session.subject))
  );

  const today = new Date();

  const filteredSessions = sessions.filter((session) => {
    // SUBJECT FILTER
    const matchesSubject =
      selectedSubject === "All" ||
      session.subject === selectedSubject;

    if (!matchesSubject) {
      return false;
    }

    // DATE FILTER
    if (selectedPeriod === "All") {
      return true;
    }

    const sessionDate = new Date(session.created_at);

    if (selectedPeriod === "Today") {
      return (
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth() &&
        sessionDate.getDate() === today.getDate()
      );
    }

    if (selectedPeriod === "Week") {
      const startOfWeek = new Date(today);

      const day = today.getDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;

      startOfWeek.setDate(today.getDate() - daysSinceMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      return sessionDate >= startOfWeek;
    }

    if (selectedPeriod === "Month") {
      return (
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth()
      );
    }

    return true;
  });
  const filteredTotalSeconds = filteredSessions.reduce(
  (total, session) => total + session.duration,
  0
);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Study History</h1>

        <p className="mt-2 text-white/60">
          Review your previous study sessions.
        </p>
      </div>

      {/* FILTERS */}
      <div className="mt-8 flex flex-wrap gap-4">
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="rounded-xl border border-white/10 bg-black px-4 py-3"
        >
          <option value="All">All subjects</option>

          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>

        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="rounded-xl border border-white/10 bg-black px-4 py-3"
        >
          <option value="All">All time</option>
          <option value="Today">Today</option>
          <option value="Week">This week</option>
          <option value="Month">This month</option>
        </select>
      </div>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
  <p className="text-sm text-white/50">
    Total study time
  </p>

  <p className="mt-2 font-mono text-2xl font-bold">
    {formatDuration(filteredTotalSeconds)}
  </p>
</div>

      {/* HISTORY */}
      <div className="mt-6">
        {filteredSessions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/60">
              No study sessions match these filters.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-5 last:border-b-0"
              >
                <div>
                  <p className="text-lg font-semibold">
                    {session.subject}
                  </p>

                  <p className="mt-1 text-sm text-white/50">
                    {formatDate(session.created_at)}
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