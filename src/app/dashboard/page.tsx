"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { evaluateAchievements } from "@/lib/achievements";
import { resolveSubjectColor } from "@/lib/subject-colors";
import { supabase } from "@/lib/supabase";

type StudySession = {
  id: number;
  subject: string;
  duration: number;
  created_at: string;
  note?: string | null;
};

type ExamItem = {
  id: number;
  title: string;
  subject: string | null;
  exam_date: string;
};

function getExamDaysRemaining(examDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = examDateStr.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  target.setHours(0, 0, 0, 0);

  return Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
}

export default function Dashboard() {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [colorBySubject, setColorBySubject] = useState<
    Record<string, string | null>
  >({});
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(120);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Upcoming Exams state
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [examsUseLocalFallback, setExamsUseLocalFallback] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [isSavingExam, setIsSavingExam] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      // 1. Load daily goal
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("daily_goal_minutes")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
      } else if (profile) {
        setDailyGoalMinutes(profile.daily_goal_minutes);
      } else {
        await supabase.from("profiles").upsert(
          {
            user_id: user.id,
            daily_goal_minutes: 120,
          },
          { onConflict: "user_id" }
        );
        setDailyGoalMinutes(120);
      }

      // 2. Load subjects + colors
      const fullSubjectRes = await supabase
        .from("subjects")
        .select("name, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      let subjectRows: { name: string; color?: string | null }[] = [];
      if (
        fullSubjectRes.error &&
        fullSubjectRes.error.message.includes("color")
      ) {
        const fallbackSubjectRes = await supabase
          .from("subjects")
          .select("name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        subjectRows = fallbackSubjectRes.data || [];
      } else if (!fullSubjectRes.error) {
        subjectRows = fullSubjectRes.data || [];
      }

      const colors: Record<string, string | null> = {};
      subjectRows.forEach((s) => {
        colors[s.name] = s.color ?? null;
      });
      setColorBySubject(colors);
      setAvailableSubjects(subjectRows.map((s) => s.name));

      // 3. Load study sessions (+ optional note)
      const fullSessionsRes = await supabase
        .from("study_sessions")
        .select("id, subject, duration, created_at, note")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (
        fullSessionsRes.error &&
        fullSessionsRes.error.message.includes("note")
      ) {
        const fallbackSessionsRes = await supabase
          .from("study_sessions")
          .select("id, subject, duration, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setSessions((fallbackSessionsRes.data || []) as StudySession[]);
      } else if (!fullSessionsRes.error) {
        setSessions((fullSessionsRes.data || []) as StudySession[]);
      }

      // 4. Load upcoming exams (with seamless localStorage fallback before SQL setup)
      const examsRes = await supabase
        .from("exams")
        .select("id, title, subject, exam_date")
        .eq("user_id", user.id)
        .order("exam_date", { ascending: true });

      if (examsRes.error) {
        setExamsUseLocalFallback(true);
        const savedLocal = localStorage.getItem(`studyExams_${user.id}`);
        if (savedLocal) {
          try {
            setExams(JSON.parse(savedLocal) as ExamItem[]);
          } catch {
            setExams([]);
          }
        }
      } else {
        setExamsUseLocalFallback(false);
        setExams((examsRes.data || []) as ExamItem[]);
      }

      setIsLoading(false);
    };

    fetchDashboardData();
  }, [router]);

  const saveDailyGoal = async (newGoalMinutes: number) => {
    setDailyGoalMinutes(newGoalMinutes);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        daily_goal_minutes: newGoalMinutes,
      })
      .eq("user_id", user.id);

    if (error) {
      alert(`Goal save error: ${error.message}`);
    }
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || isSavingExam) return;

    const cleanedTitle = examTitle.trim();
    if (!cleanedTitle || !examDate) return;

    setIsSavingExam(true);

    if (examsUseLocalFallback) {
      const localItem: ExamItem = {
        id: Date.now(),
        title: cleanedTitle,
        subject: examSubject || null,
        exam_date: examDate,
      };
      const updated = [...exams, localItem].sort((a, b) =>
        a.exam_date.localeCompare(b.exam_date)
      );
      setExams(updated);
      localStorage.setItem(
        `studyExams_${currentUserId}`,
        JSON.stringify(updated)
      );
      setExamTitle("");
      setExamDate("");
      setShowAddExam(false);
      setIsSavingExam(false);
      return;
    }

    const { data, error } = await supabase
      .from("exams")
      .insert({
        user_id: currentUserId,
        title: cleanedTitle,
        subject: examSubject || null,
        exam_date: examDate,
      })
      .select("id, title, subject, exam_date")
      .single();

    setIsSavingExam(false);

    if (error) {
      alert(`Could not add exam: ${error.message}`);
      return;
    }

    const updated = [...exams, data as ExamItem].sort((a, b) =>
      a.exam_date.localeCompare(b.exam_date)
    );
    setExams(updated);
    setExamTitle("");
    setExamDate("");
    setShowAddExam(false);
  };

  const handleDeleteExam = async (examId: number) => {
    if (!currentUserId) return;

    if (examsUseLocalFallback) {
      const updated = exams.filter((ex) => ex.id !== examId);
      setExams(updated);
      localStorage.setItem(
        `studyExams_${currentUserId}`,
        JSON.stringify(updated)
      );
      return;
    }

    const { error } = await supabase
      .from("exams")
      .delete()
      .eq("id", examId)
      .eq("user_id", currentUserId);

    if (error) {
      alert("Could not remove exam.");
      return;
    }

    setExams((prev) => prev.filter((ex) => ex.id !== examId));
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

  const monthSeconds = sessions
    .filter((session) => {
      const sessionDate = new Date(session.created_at);
      return (
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth()
      );
    })
    .reduce((total, session) => total + session.duration, 0);

  const studiedDaysThisWeek = new Set(
    sessions
      .filter((session) => {
        const sessionDate = new Date(session.created_at);
        return sessionDate >= startOfWeek && sessionDate <= endOfToday;
      })
      .map((session) => {
        const sessionDate = new Date(session.created_at);
        return `${sessionDate.getFullYear()}-${sessionDate.getMonth()}-${sessionDate.getDate()}`;
      })
  ).size;

  const dailyAverageSeconds =
    studiedDaysThisWeek > 0 ? Math.floor(weekSeconds / studiedDaysThisWeek) : 0;

  const weekData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
    (dayLabel, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);

      const daySessions = sessions.filter((session) => {
        const sessionDate = new Date(session.created_at);
        return (
          sessionDate.getFullYear() === date.getFullYear() &&
          sessionDate.getMonth() === date.getMonth() &&
          sessionDate.getDate() === date.getDate()
        );
      });

      const totalSeconds = daySessions.reduce(
        (total, session) => total + session.duration,
        0
      );

      const perSubject: Record<string, number> = {};
      daySessions.forEach((s) => {
        perSubject[s.subject] = (perSubject[s.subject] || 0) + s.duration;
      });

      const segments = Object.entries(perSubject)
        .map(([subject, secs]) => ({
          subject,
          seconds: secs,
          color: resolveSubjectColor(subject, colorBySubject),
        }))
        .sort((a, b) => b.seconds - a.seconds);

      return {
        day: dayLabel,
        seconds: totalSeconds,
        segments,
      };
    }
  );

  const maxDaySeconds = Math.max(...weekData.map((d) => d.seconds), 1);

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

  const totalAllTimeSeconds = sessions.reduce(
    (sum, s) => sum + s.duration,
    0
  );

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
      color: resolveSubjectColor(subject, colorBySubject),
      sharePercent:
        totalAllTimeSeconds > 0
          ? Math.round((seconds / totalAllTimeSeconds) * 100)
          : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
  const firstDayIndex =
    firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
  const calendarStart = new Date(firstDayOfMonth);
  calendarStart.setDate(firstDayOfMonth.getDate() - firstDayIndex);

  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    const daySessions = sessions.filter((session) => {
      const sessionDate = new Date(session.created_at);
      return (
        sessionDate.getFullYear() === date.getFullYear() &&
        sessionDate.getMonth() === date.getMonth() &&
        sessionDate.getDate() === date.getDate()
      );
    });

    const seconds = daySessions.reduce((t, s) => t + s.duration, 0);
    const topColor =
      daySessions.length > 0
        ? resolveSubjectColor(daySessions[0].subject, colorBySubject)
        : null;

    return {
      date,
      seconds,
      topColor,
      isCurrentMonth: date.getMonth() === calendarMonth,
    };
  });

  const previousMonth = () => {
    setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));
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
      Math.round((dayTimestamp - previousDay) / (24 * 60 * 60 * 1000)) === 1
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

  const achievements = evaluateAchievements(sessions);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const stats = [
    { label: "Today", value: formatDuration(todaySeconds) },
    { label: "This week", value: formatDuration(weekSeconds) },
    { label: "This month", value: formatDuration(monthSeconds) },
    { label: "Daily average", value: formatDuration(dailyAverageSeconds) },
  ];

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-white/60">Here&apos;s your study progress.</p>
        </div>

        <Link
          href="/timer"
          className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90"
        >
          Start Studying
        </Link>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
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

      {/* STREAKS & DAILY GOAL */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-white/50">Daily study goal</p>
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
                    saveDailyGoal(hours * 60 + minutes);
                  }}
                  className="w-20 rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm"
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
                    const hours = Math.floor(dailyGoalMinutes / 60);
                    saveDailyGoal(hours * 60 + minutes);
                  }}
                  className="w-20 rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${dailyGoalProgress}%` }}
            />
          </div>

          <p className="mt-2 text-sm text-white/50">
            {Math.round(dailyGoalProgress)}% complete
          </p>
        </div>
      </section>

      {/* UPCOMING EXAMS COUNTDOWN WIDGET */}
      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Upcoming Exams</h2>
            <p className="mt-1 text-sm text-white/50">
              Pin exam dates to keep your countdown in sight.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddExam((prev) => !prev)}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium transition hover:bg-white/5"
          >
            {showAddExam ? "Cancel" : "+ Add Exam"}
          </button>
        </div>

        {showAddExam && (
          <form
            onSubmit={handleAddExam}
            className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-4"
          >
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Exam title (e.g. Midterm)"
              required
              maxLength={80}
              className="rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm outline-none"
            />

            <select
              value={examSubject}
              onChange={(e) => setExamSubject(e.target.value)}
              className="rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm outline-none"
            >
              <option value="">Subject (optional)</option>
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              required
              className="rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm outline-none"
            />

            <button
              type="submit"
              disabled={isSavingExam}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {isSavingExam ? "Saving..." : "Save Exam"}
            </button>
          </form>
        )}

        <div className="mt-5">
          {exams.length === 0 ? (
            <p className="text-sm text-white/45">
              No upcoming exams pinned yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {exams.map((exam) => {
                const daysLeft = getExamDaysRemaining(exam.exam_date);
                const subjectDot = exam.subject
                  ? resolveSubjectColor(exam.subject, colorBySubject)
                  : null;

                let badgeText = `${daysLeft} days left`;
                let badgeClass =
                  "border-white/15 bg-white/10 text-white/90";

                if (daysLeft < 0) {
                  badgeText = "Passed";
                  badgeClass = "border-white/10 bg-black/40 text-white/45";
                } else if (daysLeft === 0) {
                  badgeText = "Today!";
                  badgeClass =
                    "border-rose-500/40 bg-rose-500/15 text-rose-300";
                } else if (daysLeft === 1) {
                  badgeText = "Tomorrow";
                  badgeClass =
                    "border-amber-500/40 bg-amber-500/15 text-amber-300";
                } else if (daysLeft <= 7) {
                  badgeClass =
                    "border-amber-500/35 bg-amber-500/10 text-amber-200";
                }

                return (
                  <div
                    key={exam.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/40 p-4"
                  >
                    <div>
                      <p className="font-semibold">{exam.title}</p>
                      {exam.subject && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-white/65">
                          {subjectDot && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: subjectDot }}
                            />
                          )}
                          <span>{exam.subject}</span>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-white/40">
                        {exam.exam_date}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                      >
                        {badgeText}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteExam(exam.id)}
                        className="text-xs text-white/40 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* WEEKLY CHART & MONTHLY CALENDAR */}
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Study this week</h2>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex h-64 items-end justify-between gap-4">
              {weekData.map(({ day: dayLabel, seconds, segments }) => {
                const height = (seconds / maxDaySeconds) * 100;

                return (
                  <div
                    key={dayLabel}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                  >
                    <p className="text-xs text-white/70">
                      {seconds > 0 ? formatDuration(seconds) : "0m"}
                    </p>

                    {seconds > 0 ? (
                      <div
                        className="flex w-full max-w-10 flex-col overflow-hidden rounded-t-lg"
                        style={{ height: `${Math.max(height, 6)}%` }}
                      >
                        {segments.map((seg) => (
                          <div
                            key={seg.subject}
                            title={`${seg.subject}: ${formatDuration(seg.seconds)}`}
                            style={{
                              height: `${(seg.seconds / seconds) * 100}%`,
                              backgroundColor: seg.color,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className="w-full max-w-10 rounded-t-lg bg-white/15"
                        style={{ height: "2px" }}
                      />
                    )}

                    <span className="text-sm text-white/50">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Study this month</h2>

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
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-white/10">
              {calendarDays.map(
                ({ date, seconds, topColor, isCurrentMonth }) => (
                  <div
                    key={date.toISOString()}
                    className={`min-h-16 border-b border-r border-white/10 p-2 ${
                      isCurrentMonth
                        ? "bg-white/3"
                        : "bg-black/20 text-white/25"
                    }`}
                  >
                    <p className="text-xs font-semibold">{date.getDate()}</p>

                    {seconds > 0 && (
                      <div
                        className="mt-2 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{
                          borderColor: `${topColor || "#f97316"}66`,
                          backgroundColor: `${topColor || "#f97316"}26`,
                        }}
                      >
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

      {/* COLOR-CODED STUDY BY SUBJECT */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Study by subject</h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          {subjectData.length === 0 ? (
            <div className="bg-white/5 px-6 py-6 text-white/50">
              No study data yet.
            </div>
          ) : (
            subjectData.map(({ subject, seconds, color, sharePercent }) => (
              <div
                key={subject}
                className="border-b border-white/10 bg-white/5 px-6 py-4 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <p className="font-medium">{subject}</p>
                  </div>

                  <p className="font-semibold">
                    {formatDuration(seconds)}{" "}
                    <span className="ml-1 text-xs font-normal text-white/45">
                      ({sharePercent}%)
                    </span>
                  </p>
                </div>

                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(sharePercent, 3)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ACHIEVEMENTS & BADGES */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Achievements 🏆</h2>
          <p className="text-sm text-white/50">
            {unlockedCount} / {achievements.length} unlocked
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {achievements.map((badge) => (
            <div
              key={badge.id}
              className={`rounded-2xl border p-5 transition ${
                badge.unlocked
                  ? "border-amber-500/35 bg-amber-500/10"
                  : "border-white/10 bg-white/5 opacity-55"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{badge.icon}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    badge.unlocked
                      ? "bg-amber-400/20 text-amber-200"
                      : "bg-white/10 text-white/55"
                  }`}
                >
                  {badge.unlocked ? "Unlocked" : badge.progressText}
                </span>
              </div>

              <p className="mt-3 font-semibold">{badge.title}</p>
              <p className="mt-1 text-xs text-white/65">{badge.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RECENT SESSIONS */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent sessions</h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          {sessions.length === 0 ? (
            <div className="bg-white/5 px-6 py-6 text-white/50">
              No study sessions yet.
            </div>
          ) : (
            sessions.slice(0, 5).map((session) => {
              const dotColor = resolveSubjectColor(
                session.subject,
                colorBySubject
              );

              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 last:border-b-0"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <p className="font-medium">{session.subject}</p>
                    </div>
                    {session.note && (
                      <p className="mt-1 text-xs text-white/70">
                        {session.note}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-white/45">
                      {new Date(session.created_at).toLocaleString()}
                    </p>
                  </div>

                  <p className="font-semibold">
                    {formatDuration(session.duration)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
