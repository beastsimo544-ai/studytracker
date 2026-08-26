

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StudySession = {
  id: number;
  subject: string;
  duration: number;
  created_at: string;
};

export default function Dashboard() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
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
   const today = new Date();

const todaySeconds = sessions
  .filter((session) => {
    const sessionDate = new Date(session.created_at);

    return (
      sessionDate.getFullYear() === today.getFullYear() &&
      sessionDate.getMonth() === today.getMonth() &&
      sessionDate.getDate() === today.getDate()
    );
  })
  .reduce((total, session) => total + session.duration, 0);

const startOfWeek = new Date(today);
const day = today.getDay();

const daysSinceMonday = day === 0 ? 6 : day - 1;

startOfWeek.setDate(today.getDate() - daysSinceMonday);
startOfWeek.setHours(0, 0, 0, 0);
const endOfToday = new Date(today);
endOfToday.setHours(23, 59, 59, 999);

const weekSeconds = sessions
  .filter((session) => {
    const sessionDate = new Date(session.created_at);

    return sessionDate >= startOfWeek && sessionDate <= endOfToday;
  })
  .reduce((total, session) => total + session.duration, 0);
  const daysElapsedThisWeek = daysSinceMonday + 1;

const dailyAverageSeconds =
  daysElapsedThisWeek > 0
    ? Math.floor(weekSeconds / daysElapsedThisWeek)
    : 0;
    const weekData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
  (dayLabel, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);

    const totalSeconds = sessions
      .filter((session) => {
        const sessionDate = new Date(session.created_at);

        return (
          sessionDate.getFullYear() === date.getFullYear() &&
          sessionDate.getMonth() === date.getMonth() &&
          sessionDate.getDate() === date.getDate()
        );
      })
      .reduce((total, session) => total + session.duration, 0);

    return {
      day: dayLabel,
      seconds: totalSeconds,
    };
  }
);

const maxDaySeconds = Math.max(
  ...weekData.map((day) => day.seconds),
  1
);

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${totalSeconds}s`;
};
const subjectTotals = sessions.reduce<Record<string, number>>(
  (totals, session) => {
    totals[session.subject] =
      (totals[session.subject] || 0) + session.duration;

    return totals;
  },
  {}
);

const subjectData = Object.entries(subjectTotals)
  .map(([subject, seconds]) => ({
    subject,
    seconds,
  }))
  .sort((a, b) => b.seconds - a.seconds);
const stats = [
  {
    label: "Today",
    value: formatDuration(todaySeconds),
  },
  {
    label: "This week",
    value: formatDuration(weekSeconds),
  },
  {
    label: "Daily average",
    value: formatDuration(dailyAverageSeconds),
  },
];
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <section className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold">Dashboard</h1>

    <p className="mt-2 text-white/60">
      Here&apos;s your study progress.
    </p>
  </div>

  <Link
    href="/timer"
    className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90"
  >
    Start Studying
  </Link>
</section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <p className="text-sm text-white/50">{stat.label}</p>

            <p className="mt-3 text-3xl font-bold">{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Study this week</h2>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex h-56 items-end justify-between gap-4">
           {weekData.map(({ day, seconds }) => {
  const height = (seconds / maxDaySeconds) * 100;

  return (
              <div
                key={day}
                className="flex h-full flex-1 flex-col items-center justify-end gap-3"
              >
                <div
                  className="w-full max-w-12 rounded-t-lg bg-white"
                  style={{ height: `${height}%` }}
                />

                <span className="text-sm text-white/50">{day}</span>
              </div>
           );
})}
          </div>
        </div>
      </section>
<section className="mt-10">
  <h2 className="text-xl font-semibold">Study by subject</h2>

  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
    {subjectData.length === 0 ? (
      <div className="bg-white/5 px-6 py-6 text-white/50">
        No study data yet.
      </div>
    ) : (
      subjectData.map(({ subject, seconds }) => (
        <div
          key={subject}
          className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 last:border-b-0"
        >
          <p className="font-medium">{subject}</p>

          <p className="font-semibold">
            {formatDuration(seconds)}
          </p>
        </div>
      ))
    )}
  </div>
</section>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent sessions</h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
         {sessions
  .slice()
  .sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
new Date(a.created_at).getTime()
  )
  .slice(0, 5)
  .map((session) => (
            <div
             key={session.id}
              className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 last:border-b-0"
            >
              <div>
                <p className="font-medium">{session.subject}</p>
                <p className="mt-1 text-sm text-white/50">{new Date(session.created_at).toLocaleString()}</p>
              </div>

              <p className="font-semibold">
  {formatDuration(session.duration)}
</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}