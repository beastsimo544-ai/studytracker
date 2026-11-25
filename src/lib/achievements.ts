export type SessionForAchievements = {
  duration: number;
  created_at: string;
};

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressText: string;
};

function toLocalDayTimestamp(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function computeLongestStreakDays(sessions: SessionForAchievements[]): number {
  if (sessions.length === 0) return 0;

  const uniqueDays = Array.from(
    new Set(sessions.map((s) => toLocalDayTimestamp(s.created_at)))
  ).sort((a, b) => a - b);

  let longest = 0;
  let running = 0;
  let prev: number | null = null;

  uniqueDays.forEach((ts) => {
    if (prev !== null && Math.round((ts - prev) / (24 * 60 * 60 * 1000)) === 1) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > longest) longest = running;
    prev = ts;
  });

  return longest;
}

function computeBestWeekSeconds(sessions: SessionForAchievements[]): number {
  if (sessions.length === 0) return 0;

  const totalsByWeek: Record<string, number> = {};

  sessions.forEach((s) => {
    const d = new Date(s.created_at);
    const day = d.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysSinceMonday);
    const key = `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
    totalsByWeek[key] = (totalsByWeek[key] || 0) + (Number(s.duration) || 0);
  });

  return Math.max(...Object.values(totalsByWeek), 0);
}

export function evaluateAchievements(
  sessions: SessionForAchievements[]
): Achievement[] {
  const count = sessions.length;
  const totalSeconds = sessions.reduce(
    (sum, s) => sum + (Number(s.duration) || 0),
    0
  );
  const longestSessionSeconds = sessions.reduce(
    (max, s) => Math.max(max, Number(s.duration) || 0),
    0
  );
  const longestStreak = computeLongestStreakDays(sessions);
  const bestWeekSeconds = computeBestWeekSeconds(sessions);

  const totalHours = totalSeconds / 3600;
  const bestWeekHours = bestWeekSeconds / 3600;

  return [
    {
      id: "first_session",
      icon: "🎯",
      title: "First Step",
      description: "Complete your first study session",
      unlocked: count >= 1,
      progressText: `${Math.min(count, 1)} / 1 session`,
    },
    {
      id: "deep_focus",
      icon: "⚡",
      title: "Deep Focus",
      description: "Study 1+ hour in a single session",
      unlocked: longestSessionSeconds >= 3600,
      progressText: `${Math.min(60, Math.floor(longestSessionSeconds / 60))} / 60m`,
    },
    {
      id: "streak_3",
      icon: "🔥",
      title: "3-Day Streak",
      description: "Study 3 days in a row",
      unlocked: longestStreak >= 3,
      progressText: `${Math.min(longestStreak, 3)} / 3 days`,
    },
    {
      id: "streak_7",
      icon: "🌟",
      title: "Week Warrior",
      description: "Reach a 7-day study streak",
      unlocked: longestStreak >= 7,
      progressText: `${Math.min(longestStreak, 7)} / 7 days`,
    },
    {
      id: "week_10h",
      icon: "📚",
      title: "10h Week",
      description: "Log 10+ hours in a single week",
      unlocked: bestWeekSeconds >= 10 * 3600,
      progressText: `${Math.min(10, Number(bestWeekHours.toFixed(1)))} / 10h`,
    },
    {
      id: "total_25h",
      icon: "🏅",
      title: "25h Scholar",
      description: "Accumulate 25 total study hours",
      unlocked: totalSeconds >= 25 * 3600,
      progressText: `${Math.min(25, Number(totalHours.toFixed(1)))} / 25h`,
    },
    {
      id: "total_50h",
      icon: "💎",
      title: "50h Club",
      description: "Accumulate 50 total study hours",
      unlocked: totalSeconds >= 50 * 3600,
      progressText: `${Math.min(50, Number(totalHours.toFixed(1)))} / 50h`,
    },
    {
      id: "total_100h",
      icon: "👑",
      title: "100h Master",
      description: "Accumulate 100 total study hours",
      unlocked: totalSeconds >= 100 * 3600,
      progressText: `${Math.min(100, Number(totalHours.toFixed(1)))} / 100h`,
    },
  ];
}
