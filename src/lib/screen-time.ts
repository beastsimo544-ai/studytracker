export type ScreenTimeCategory = "distracting" | "study" | "neutral";
export type ScreenTimeSource = "android" | "extension";
export type ScreenTimeRiskLevel =
  | "safe"
  | "caution"
  | "warning"
  | "danger"
  | "critical";

export type TrackedAppEntry = {
  id: string;
  name: string;
  seconds: number;
  category: ScreenTimeCategory;
  source: ScreenTimeSource;
};

export type ScreenTimeLogRow = {
  id?: number;
  user_id?: string;
  log_date: string;
  source: ScreenTimeSource;
  total_seconds: number;
  distracting_seconds: number;
  study_seconds: number;
  apps: TrackedAppEntry[];
  updated_at?: string;
};

export type ScreenTimeRiskSummary = {
  level: ScreenTimeRiskLevel;
  score: number;
  label: string;
  badgeClass: string;
  barColor: string;
  borderClass: string;
  headline: string;
  advice: string;
};

const OVERRIDES_STORAGE_KEY = "studytracker_screentime_overrides";

const DISTRACTING_KEYWORDS = [
  "tiktok",
  "musically",
  "instagram",
  "youtube",
  "snapchat",
  "facebook",
  "fb.",
  "twitter",
  "x.com",
  "reddit",
  "twitch",
  "netflix",
  "disneyplus",
  "disney+",
  "crunchyroll",
  "pinterest",
  "kick.com",
  "9gag",
  "imgur",
  "tumblr",
  "threads.net",
  "roblox",
  "brawlstars",
  "clashroyale",
  "clashofclans",
  "pubg",
  "freefire",
  "minecraft",
  "steampowered",
  "store.steam",
  "epicgames",
  "supercell",
  "mobilelegends",
  "hoyoverse",
  "genshin",
  "valorant",
  "riotgames",
  "primevideo",
  "hulu",
  "hbomax",
  "max.com",
];

const STUDY_KEYWORDS = [
  "studytracker",
  "com.studytracker.app",
  "notion",
  "docs.google",
  "drive.google",
  "classroom.google",
  "scholar.google",
  "anki",
  "quizlet",
  "khanacademy",
  "coursera",
  "edx.org",
  "udemy",
  "instructure",
  "canvas",
  "blackboard",
  "moodle",
  "obsidian",
  "duolingo",
  "wikipedia",
  "github.com",
  "stackoverflow",
  "developer.mozilla",
  "mdn",
  "chatgpt",
  "claude.ai",
  "gemini.google",
  "perplexity",
  "overleaf",
  "desmos",
  "wolframalpha",
  "onenote",
  "microsoft.office.word",
  "microsoft.office.powerpoint",
  "goodnotes",
  "notability",
  "readwise",
  "zotero",
  "arxiv",
  "mit.edu",
  "localhost",
];

export function getTodayLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatScreenDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (safe === 0) return "0m";
  if (safe < 60) return `${safe}s`;
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function loadCategoryOverrides(): Record<string, ScreenTimeCategory> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, ScreenTimeCategory> = {};
    Object.entries(parsed).forEach(([key, val]) => {
      if (val === "distracting" || val === "study" || val === "neutral") {
        out[key.toLowerCase()] = val;
      }
    });
    return out;
  } catch {
    return {};
  }
}

export function saveCategoryOverride(
  appId: string,
  category: ScreenTimeCategory
): Record<string, ScreenTimeCategory> {
  const current = loadCategoryOverrides();
  const next = {
    ...current,
    [appId.toLowerCase()]: category,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function classifyAppOrDomain(
  id: string,
  name: string,
  overrides?: Record<string, ScreenTimeCategory>
): ScreenTimeCategory {
  const normalizedId = (id || "").toLowerCase().trim();
  const normalizedName = (name || "").toLowerCase().trim();

  if (overrides && overrides[normalizedId]) {
    return overrides[normalizedId];
  }

  const combined = `${normalizedId} ${normalizedName}`;

  if (STUDY_KEYWORDS.some((kw) => combined.includes(kw))) {
    return "study";
  }

  if (DISTRACTING_KEYWORDS.some((kw) => combined.includes(kw))) {
    return "distracting";
  }

  return "neutral";
}

export function recomputeTotalsWithOverrides(
  apps: TrackedAppEntry[],
  overrides: Record<string, ScreenTimeCategory>
): {
  apps: TrackedAppEntry[];
  totalSeconds: number;
  distractingSeconds: number;
  studySeconds: number;
} {
  let totalSeconds = 0;
  let distractingSeconds = 0;
  let studySeconds = 0;

  const updatedApps = apps.map((app) => {
    const seconds = Math.max(0, Math.round(Number(app.seconds) || 0));
    const category = overrides[app.id.toLowerCase()] ?? app.category;
    totalSeconds += seconds;
    if (category === "distracting") distractingSeconds += seconds;
    else if (category === "study") studySeconds += seconds;
    return {
      ...app,
      seconds,
      category,
    };
  });

  return {
    apps: updatedApps.sort((a, b) => b.seconds - a.seconds),
    totalSeconds,
    distractingSeconds,
    studySeconds,
  };
}

export function evaluateScreenTimeRisk({
  distractingSeconds,
  totalScreenSeconds,
  studySecondsToday,
  dailyGoalSeconds,
}: {
  distractingSeconds: number;
  totalScreenSeconds: number;
  studySecondsToday: number;
  dailyGoalSeconds: number;
}): ScreenTimeRiskSummary {
  const distractMins = Math.max(0, distractingSeconds) / 60;
  const totalNonStudyMins = Math.max(
    0,
    (Math.max(totalScreenSeconds, distractingSeconds) - 0) / 60
  );
  const studyMins = Math.max(0, studySecondsToday) / 60;
  const goalMins = Math.max(30, dailyGoalSeconds / 60);

  // Base risk from distracting screen time (0-78) + excess total screen time (0-22)
  let rawScore = (distractMins / 135) * 78 + Math.max(0, (totalNonStudyMins - 150) / 240) * 22;

  // Heighten urgency when distracting time noticeably outpaces today's study time
  if (distractMins >= 25 && studyMins < 20) {
    rawScore += 12;
  } else if (distractMins > studyMins * 1.5 && distractMins >= 30) {
    rawScore += Math.min(18, (distractMins - studyMins) / 6);
  }

  // Soften impact if daily study goal is already met or well underway
  const goalProgress = studyMins / goalMins;
  if (goalProgress >= 1) {
    rawScore -= 18;
  } else if (goalProgress >= 0.5) {
    rawScore -= 8;
  }

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  if (score <= 22) {
    return {
      level: "safe",
      score,
      label: "Safe",
      badgeClass:
        "border-emerald-500/35 bg-emerald-500/15 text-emerald-300",
      barColor: "#10b981",
      borderClass: "border-emerald-500/25",
      headline: "Screen time is well under control.",
      advice:
        distractMins < 10
          ? "Zero major distractions detected today — stay locked in."
          : "Distractions are low relative to your focus sessions.",
    };
  }

  if (score <= 44) {
    return {
      level: "caution",
      score,
      label: "Moderate",
      badgeClass: "border-yellow-500/35 bg-yellow-500/15 text-yellow-300",
      barColor: "#eab308",
      borderClass: "border-yellow-500/30",
      headline: "Distractions are starting to build up.",
      advice:
        "Wrap up casual browsing and start a quick Pomodoro before momentum slips.",
    };
  }

  if (score <= 66) {
    return {
      level: "warning",
      score,
      label: "High Risk",
      badgeClass: "border-orange-500/40 bg-orange-500/15 text-orange-300",
      barColor: "#f97316",
      borderClass: "border-orange-500/35",
      headline: "Screen time is catching up to your study time.",
      advice:
        "Close distracting apps/tabs now and knock out 25 minutes on your Timer.",
    };
  }

  if (score <= 84) {
    return {
      level: "danger",
      score,
      label: "Dangerous",
      badgeClass: "border-red-500/45 bg-red-500/15 text-red-300",
      barColor: "#ef4444",
      borderClass: "border-red-500/45",
      headline: "Screen time is hurting today's study goal.",
      advice:
        "High distraction load detected. Switch into Minimal Focus Mode to recover today's streak.",
    };
  }

  return {
    level: "critical",
    score,
    label: "Extremely Dangerous",
    badgeClass:
      "border-rose-500/60 bg-rose-500/20 text-rose-200 animate-pulse",
    barColor: "#e11d48",
    borderClass: "border-rose-500/55",
    headline: "Critical distraction overload vs. your studies!",
    advice:
      "Put your phone down / close distracting tabs immediately and lock in one 25m focus session.",
  };
}
