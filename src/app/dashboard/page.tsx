

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
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [sessions, setSessions] = useState<StudySession[]>([]);
 const [dailyGoalMinutes, setDailyGoalMinutes] = useState(120);
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

    // Load the user's daily goal
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("daily_goal_minutes")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      return;
    }

    if (profile) {
      setDailyGoalMinutes(profile.daily_goal_minutes);
    } else {
      const { error: insertProfileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          daily_goal_minutes: 120,
        });

      if (insertProfileError) {
        console.error(insertProfileError);
        return;
      }

      setDailyGoalMinutes(120);
    }

    // Load study sessions
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
const saveDailyGoal = async (newGoalMinutes: number) => {
  setDailyGoalMinutes(newGoalMinutes);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      daily_goal_minutes: newGoalMinutes,
    })
    .eq("user_id", user.id)
    .select();

  if (error) {
    alert(`Goal save error: ${error.message}`);
    return;
  }

  console.log("Saved profile:", data);
};

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

const monthSeconds = sessions
  .filter((session) => {
    const sessionDate = new Date(session.created_at);
  

    return (
      sessionDate.getFullYear() === today.getFullYear() &&
      sessionDate.getMonth() === today.getMonth()
    );
  })
  .reduce((total, session) => total + session.duration, 0);
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
const dailyGoalSeconds = dailyGoalMinutes * 60;

const dailyGoalProgress =
  dailyGoalSeconds > 0
    ? Math.min((todaySeconds / dailyGoalSeconds) * 100, 100)
    : 0;
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
  const calendarYear = calendarDate.getFullYear();
const calendarMonth = calendarDate.getMonth();

const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);

const firstDayIndex =
  firstDayOfMonth.getDay() === 0
    ? 6
    : firstDayOfMonth.getDay() - 1;

const calendarStart = new Date(firstDayOfMonth);
calendarStart.setDate(firstDayOfMonth.getDate() - firstDayIndex);

const calendarDays = Array.from({ length: 42 }, (_, index) => {
  const date = new Date(calendarStart);
  date.setDate(calendarStart.getDate() + index);

  const seconds = sessions
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
    date,
    seconds,
    isCurrentMonth: date.getMonth() === calendarMonth,
  };
});

const previousMonth = () => {
  setCalendarDate(
    new Date(calendarYear, calendarMonth - 1, 1)
  );
};

const nextMonth = () => {
  setCalendarDate(
    new Date(calendarYear, calendarMonth + 1, 1)
  );
};

const calendarTitle = calendarDate.toLocaleString("en-US", {
  month: "long",
  year: "numeric",
});
const studiedDays = Array.from(
  new Set(
    sessions.map((session) => {
      const date = new Date(session.created_at);

      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ).getTime();
    })
  )
).sort((a, b) => a - b);

let longestStreak = 0;
let runningStreak = 0;
let previousDay: number | null = null;

studiedDays.forEach((dayTimestamp) => {
  if (
    previousDay !== null &&
    dayTimestamp - previousDay === 24 * 60 * 60 * 1000
  ) {
    runningStreak += 1;
  } else {
    runningStreak = 1;
  }

  longestStreak = Math.max(longestStreak, runningStreak);
  previousDay = dayTimestamp;
});

const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const yesterdayStart = new Date(todayStart);
yesterdayStart.setDate(todayStart.getDate() - 1);

let currentStreak = 0;
let streakCheckDate = new Date(todayStart);

const studiedToday = studiedDays.includes(todayStart.getTime());

if (!studiedToday) {
  streakCheckDate = yesterdayStart;
}

while (studiedDays.includes(streakCheckDate.getTime())) {
  currentStreak += 1;
  streakCheckDate.setDate(streakCheckDate.getDate() - 1);
}
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
    label: "This month",
    value: formatDuration(monthSeconds),
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

      <section className="mt-8 grid gap-4 md:grid-cols-4">
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

     <section className="mt-10 grid gap-6 lg:grid-cols-2">
  {/* LEFT — WEEKLY CHART */}
  <section className="mt-8 grid gap-4 md:grid-cols-2">
  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">Current streak</p>

    <p className="mt-3 text-3xl font-bold">
      {currentStreak} {currentStreak === 1 ? "day" : "days"} 🔥
    </p>
  </div>

  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
    <p className="text-sm text-white/50">Longest streak</p>

    <p className="mt-3 text-3xl font-bold">
      {longestStreak} {longestStreak === 1 ? "day" : "days"}
    </p>
  </div>
</section>
  <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p className="text-sm text-white/50">
        Daily study goal
      </p>

      <p className="mt-2 text-2xl font-bold">
        {formatDuration(todaySeconds)} /{" "}
        {formatDuration(dailyGoalSeconds)}
      </p>
    </div>

    <div className="flex items-center gap-3">
      <div>
        <label className="mb-1 block text-xs text-white/50">
          Hours
        </label>

        <input
          type="number"
          min="0"
          value={Math.floor(dailyGoalMinutes / 60)}
          onChange={(e) => {
            const hours = Math.max(0, Number(e.target.value));
            const minutes = dailyGoalMinutes % 60;

          

            const newGoal = hours * 60 + minutes;

saveDailyGoal(newGoal);
            
          }}
          className="w-24 rounded-xl border border-white/10 bg-black px-4 py-3"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50">
          Minutes
        </label>

        <input
          type="number"
          min="0"
          max="59"
          value={dailyGoalMinutes % 60}
          onChange={(e) => {
            const minutes = Math.min(
              59,
              Math.max(0, Number(e.target.value))
            );

            const hours = Math.floor(
              dailyGoalMinutes / 60
            );

            const newGoal = hours * 60 + minutes;

            saveDailyGoal(newGoal);
          }}
          className="w-24 rounded-xl border border-white/10 bg-black px-4 py-3"
        />
      </div>
    </div>
  </div>

  <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
    <div
      className="h-full rounded-full bg-white transition-all"
      style={{
        width: `${dailyGoalProgress}%`,
      }}
    />
  </div>

  <p className="mt-2 text-sm text-white/50">
    {Math.round(dailyGoalProgress)}% complete
  </p>
</section>
  <div>
    <h2 className="text-xl font-semibold">Study this week</h2>

    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex h-64 items-end justify-between gap-4">
        {weekData.map(({ day, seconds }) => {
          const height = (seconds / maxDaySeconds) * 100;

          return (
            <div
              key={day}
              className="flex h-full flex-1 flex-col items-center justify-end gap-3"
            >
              <p className="text-xs text-white/70">
                {seconds > 0 ? formatDuration(seconds) : "0m"}
              </p>

              <div
                className="w-full max-w-10 rounded-t-lg bg-white"
                style={{
                  height:
                    seconds > 0
                      ? `${Math.max(height, 5)}%`
                      : "2px",
                }}
              />

              <span className="text-sm text-white/50">
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </div>

  {/* RIGHT — MONTHLY CALENDAR */}
  <div>
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">
        Study this month
      </h2>

      <div className="flex items-center gap-3">
        <button
          onClick={previousMonth}
          className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"
        >
          ←
        </button>

        <p className="min-w-32 text-center font-semibold">
          {calendarTitle}
        </p>

        <button
          onClick={nextMonth}
          className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"
        >
          →
        </button>
      </div>
    </div>

    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="grid grid-cols-7 text-center text-xs text-white/50">
        {[
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-white/10">
        {calendarDays.map(
          ({ date, seconds, isCurrentMonth }) => (
            <div
              key={date.toISOString()}
              className={`min-h-16 border-b border-r border-white/10 p-2 ${
                isCurrentMonth
                  ? "bg-white/3"
                  : "bg-black/20 text-white/25"
              }`}
            >
              <p className="text-xs font-semibold">
                {date.getDate()}
              </p>

              {seconds > 0 && (
                <div className="mt-2 inline-block rounded-md border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-300">
                  {formatDuration(seconds)}
                </div>
              )}
            </div>
          )
        )}
      </div>
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