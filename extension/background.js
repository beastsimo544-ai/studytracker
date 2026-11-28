try {
  importScripts("config.js");
} catch {
  // Handled cleanly via fallback
}

const CONFIG = self.STUDYTRACKER_CONFIG || {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  DASHBOARD_URL: "https://studytracker-e2vs.vercel.app/dashboard",
};

const ALARM_NAME = "st-heartbeat";
const MAX_TICK_SECONDS = 300;
const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const WARNING_COOLDOWN_MS = 45 * 60 * 1000;

const DISTRACTING_KEYWORDS = [
  "tiktok",
  "instagram",
  "youtube",
  "snapchat",
  "facebook",
  "twitter",
  "x.com",
  "reddit",
  "twitch",
  "netflix",
  "disneyplus",
  "crunchyroll",
  "pinterest",
  "kick.com",
  "9gag",
  "imgur",
  "tumblr",
  "threads.net",
  "roblox",
  "steampowered",
  "store.steam",
  "epicgames",
  "primevideo",
  "hulu",
  "hbomax",
  "max.com",
];

const STUDY_KEYWORDS = [
  "studytracker",
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
  "arxiv",
  "localhost",
];

function getTodayDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getHostnameFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function classifyDomain(domain, overrides = {}) {
  const key = (domain || "").toLowerCase().trim();
  if (!key) return "neutral";
  if (overrides[key]) return overrides[key];
  if (STUDY_KEYWORDS.some((kw) => key.includes(kw))) return "study";
  if (DISTRACTING_KEYWORDS.some((kw) => key.includes(kw))) return "distracting";
  return "neutral";
}

function formatCompactBadge(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  if (safe < 60) return "";
  const mins = Math.floor(safe / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

function evaluateRisk({
  distractingSeconds,
  totalScreenSeconds,
  studySecondsToday,
  dailyGoalSeconds,
}) {
  const distractMins = Math.max(0, distractingSeconds) / 60;
  const totalMins = Math.max(totalScreenSeconds, distractingSeconds) / 60;
  const studyMins = Math.max(0, studySecondsToday) / 60;
  const goalMins = Math.max(30, dailyGoalSeconds / 60);

  let rawScore =
    (distractMins / 135) * 78 +
    Math.max(0, (totalMins - 150) / 240) * 22;

  if (distractMins >= 25 && studyMins < 20) {
    rawScore += 12;
  } else if (distractMins > studyMins * 1.5 && distractMins >= 30) {
    rawScore += Math.min(18, (distractMins - studyMins) / 6);
  }

  const goalProgress = studyMins / goalMins;
  if (goalProgress >= 1) rawScore -= 18;
  else if (goalProgress >= 0.5) rawScore -= 8;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  if (score <= 22) {
    return {
      level: "safe",
      label: "Safe",
      score,
      color: "#10b981",
      headline: "Screen time is well under control.",
    };
  }
  if (score <= 44) {
    return {
      level: "caution",
      label: "Moderate",
      score,
      color: "#eab308",
      headline: "Distractions are starting to build up.",
    };
  }
  if (score <= 66) {
    return {
      level: "warning",
      label: "High Risk",
      score,
      color: "#f97316",
      headline: "Screen time is catching up to your study time.",
    };
  }
  if (score <= 84) {
    return {
      level: "danger",
      label: "Dangerous",
      score,
      color: "#ef4444",
      headline: "Screen time is hurting today's study goal.",
    };
  }
  return {
    level: "critical",
    label: "Extremely Dangerous",
    score,
    color: "#e11d48",
    headline: "Critical distraction overload vs. your studies!",
  };
}

async function getStore() {
  const data = await chrome.storage.local.get([
    "dailyUsage",
    "overrides",
    "activeSession",
    "auth",
    "studyMeta",
    "lastSyncAt",
    "lastSyncError",
    "lastWarningAt",
    "isIdle",
  ]);
  return {
    dailyUsage: data.dailyUsage || {},
    overrides: data.overrides || {},
    activeSession: data.activeSession || null,
    auth: data.auth || null,
    studyMeta: data.studyMeta || {
      dateKey: "",
      studySecondsToday: 0,
      dailyGoalSeconds: 7200,
    },
    lastSyncAt: data.lastSyncAt || 0,
    lastSyncError: data.lastSyncError || "",
    lastWarningAt: data.lastWarningAt || 0,
    isIdle: Boolean(data.isIdle),
  };
}

function buildTodaySummary(store) {
  const dateKey = getTodayDateKey();
  const domainMap = store.dailyUsage[dateKey] || {};
  const apps = Object.entries(domainMap)
    .map(([domain, secs]) => ({
      id: domain,
      name: domain,
      seconds: Math.max(0, Math.round(Number(secs) || 0)),
      category: classifyDomain(domain, store.overrides),
      source: "extension",
    }))
    .filter((a) => a.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);

  let totalSeconds = 0;
  let distractingSeconds = 0;
  let studySeconds = 0;
  for (const app of apps) {
    totalSeconds += app.seconds;
    if (app.category === "distracting") distractingSeconds += app.seconds;
    else if (app.category === "study") studySeconds += app.seconds;
  }

  const studySecondsToday =
    store.studyMeta.dateKey === dateKey
      ? Number(store.studyMeta.studySecondsToday) || 0
      : 0;
  const dailyGoalSeconds = Number(store.studyMeta.dailyGoalSeconds) || 7200;

  const risk = evaluateRisk({
    distractingSeconds,
    totalScreenSeconds: totalSeconds,
    studySecondsToday,
    dailyGoalSeconds,
  });

  return {
    dateKey,
    totalSeconds,
    distractingSeconds,
    studySeconds,
    studySecondsToday,
    dailyGoalSeconds,
    apps,
    risk,
  };
}

async function updateBadgeAndAlert(store, activeDomain) {
  const summary = buildTodaySummary(store);
  try {
    await chrome.action.setBadgeBackgroundColor({ color: summary.risk.color });
    await chrome.action.setBadgeText({
      text: formatCompactBadge(summary.distractingSeconds || summary.totalSeconds),
    });
  } catch {
    // Ignore badge update errors
  }

  const now = Date.now();
  const isRiskyLevel =
    summary.risk.level === "danger" || summary.risk.level === "critical";
  const onDistractingSite =
    activeDomain &&
    classifyDomain(activeDomain, store.overrides) === "distracting";

  if (
    isRiskyLevel &&
    onDistractingSite &&
    now - store.lastWarningAt > WARNING_COOLDOWN_MS
  ) {
    await chrome.storage.local.set({ lastWarningAt: now });
    try {
      chrome.notifications.create(`st-risk-${now}`, {
        type: "basic",
        iconUrl: "icon.png",
        title: `StudyTracker Alert: ${summary.risk.label}`,
        message: `${activeDomain} is cutting into your focus today. Open StudyTracker to lock back in.`,
        priority: 2,
      });
    } catch {
      // Ignore notification errors
    }
  }

  return summary;
}

async function flushElapsedTime(nextDomainOrNull) {
  const store = await getStore();
  const now = Date.now();
  let updatedDailyUsage = { ...store.dailyUsage };

  if (store.activeSession && store.activeSession.domain && !store.isIdle) {
    const elapsedSec = Math.min(
      MAX_TICK_SECONDS,
      Math.max(0, Math.round((now - store.activeSession.startedAt) / 1000))
    );
    if (elapsedSec > 0) {
      const dateKey = getTodayDateKey();
      const todayMap = { ...(updatedDailyUsage[dateKey] || {}) };
      const domain = store.activeSession.domain;
      todayMap[domain] = (todayMap[domain] || 0) + elapsedSec;
      updatedDailyUsage[dateKey] = todayMap;

      // Keep last 14 days only
      const keys = Object.keys(updatedDailyUsage).sort();
      if (keys.length > 14) {
        const nextTrimmed = {};
        for (const k of keys.slice(-14)) {
          nextTrimmed[k] = updatedDailyUsage[k];
        }
        updatedDailyUsage = nextTrimmed;
      }
    }
  }

  const nextActive =
    nextDomainOrNull && !store.isIdle
      ? { domain: nextDomainOrNull, startedAt: now }
      : null;

  await chrome.storage.local.set({
    dailyUsage: updatedDailyUsage,
    activeSession: nextActive,
  });

  const nextStore = {
    ...store,
    dailyUsage: updatedDailyUsage,
    activeSession: nextActive,
  };
  await updateBadgeAndAlert(nextStore, nextActive?.domain || null);
  return nextStore;
}

async function detectCurrentFocusedDomain() {
  try {
    const win = await chrome.windows.getLastFocused({ populate: false });
    if (!win || !win.focused) return null;
    const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
    if (!tabs || tabs.length === 0) return null;
    return getHostnameFromUrl(tabs[0].url);
  } catch {
    return null;
  }
}

async function ensureValidAccessToken(auth) {
  if (!auth || !auth.accessToken) return null;
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return null;

  if (auth.expiresAt && Date.now() < auth.expiresAt - 60 * 1000) {
    return auth;
  }

  if (!auth.refreshToken) return null;

  const res = await fetch(
    `${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: auth.refreshToken }),
    }
  );

  if (!res.ok) {
    await chrome.storage.local.remove("auth");
    return null;
  }

  const json = await res.json();
  const refreshed = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    userId: json.user?.id || auth.userId,
    email: json.user?.email || auth.email,
  };
  await chrome.storage.local.set({ auth: refreshed });
  return refreshed;
}

async function syncTodayToSupabase(force = false) {
  const store = await getStore();
  if (!store.auth) return { ok: false, error: "Not signed in" };
  if (!force && Date.now() - store.lastSyncAt < SYNC_INTERVAL_MS) {
    return { ok: true, skipped: true };
  }

  const auth = await ensureValidAccessToken(store.auth);
  if (!auth) {
    const errMsg = "Session expired — please sign in again.";
    await chrome.storage.local.set({ lastSyncError: errMsg });
    return { ok: false, error: errMsg };
  }

  const summary = buildTodaySummary(store);

  try {
    // 1. Pull today's study sessions + daily goal so risk score matches dashboard
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [sessionsRes, profileRes] = await Promise.all([
      fetch(
        `${CONFIG.SUPABASE_URL}/rest/v1/study_sessions?select=duration&user_id=eq.${encodeURIComponent(
          auth.userId
        )}&created_at=gte.${encodeURIComponent(startOfDay.toISOString())}`,
        {
          headers: {
            apikey: CONFIG.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      ),
      fetch(
        `${CONFIG.SUPABASE_URL}/rest/v1/profiles?select=daily_goal_minutes&user_id=eq.${encodeURIComponent(
          auth.userId
        )}`,
        {
          headers: {
            apikey: CONFIG.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${auth.accessToken}`,
          },
        }
      ),
    ]);

    let studySecondsToday = store.studyMeta.studySecondsToday || 0;
    let dailyGoalSeconds = store.studyMeta.dailyGoalSeconds || 7200;

    if (sessionsRes.ok) {
      const sRows = await sessionsRes.json();
      if (Array.isArray(sRows)) {
        studySecondsToday = sRows.reduce(
          (sum, r) => sum + (Number(r.duration) || 0),
          0
        );
      }
    }
    if (profileRes.ok) {
      const pRows = await profileRes.json();
      if (Array.isArray(pRows) && pRows[0]?.daily_goal_minutes) {
        dailyGoalSeconds = Number(pRows[0].daily_goal_minutes) * 60;
      }
    }

    await chrome.storage.local.set({
      studyMeta: {
        dateKey: summary.dateKey,
        studySecondsToday,
        dailyGoalSeconds,
      },
    });

    // 2. Push today's browser usage row to screen_time_logs
    const payload = {
      user_id: auth.userId,
      log_date: summary.dateKey,
      source: "extension",
      total_seconds: summary.totalSeconds,
      distracting_seconds: summary.distractingSeconds,
      study_seconds: summary.studySeconds,
      apps: summary.apps.slice(0, 20),
      updated_at: new Date().toISOString(),
    };

    const upsertRes = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/screen_time_logs?on_conflict=user_id,log_date,source`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${auth.accessToken}`,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      const friendly =
        text.includes("screen_time_logs") || text.includes("42P01")
          ? "Run supabase-screen-time-setup.sql in Supabase SQL Editor first."
          : `Sync failed (${upsertRes.status})`;
      await chrome.storage.local.set({ lastSyncError: friendly });
      return { ok: false, error: friendly };
    }

    await chrome.storage.local.set({
      lastSyncAt: Date.now(),
      lastSyncError: "",
    });
    const refreshedStore = await getStore();
    await updateBadgeAndAlert(
      refreshedStore,
      refreshedStore.activeSession?.domain || null
    );
    return { ok: true };
  } catch {
    const errMsg = "Network error while syncing.";
    await chrome.storage.local.set({ lastSyncError: errMsg });
    return { ok: false, error: errMsg };
  }
}

async function ensureHeartbeat() {
  chrome.idle.setDetectionInterval(60);
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureHeartbeat();
  const domain = await detectCurrentFocusedDomain();
  await flushElapsedTime(domain);
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureHeartbeat();
  const domain = await detectCurrentFocusedDomain();
  await flushElapsedTime(domain);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const domain = getHostnameFromUrl(tab?.url);
    await flushElapsedTime(domain);
  } catch {
    await flushElapsedTime(null);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  if (!tab?.active) return;
  const win = await chrome.windows.get(tab.windowId).catch(() => null);
  if (!win?.focused) return;
  await flushElapsedTime(getHostnameFromUrl(tab.url));
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushElapsedTime(null);
    return;
  }
  const domain = await detectCurrentFocusedDomain();
  await flushElapsedTime(domain);
});

chrome.idle.onStateChanged.addListener(async (newState) => {
  const isIdle = newState !== "active";
  await chrome.storage.local.set({ isIdle });
  const domain = isIdle ? null : await detectCurrentFocusedDomain();
  await flushElapsedTime(domain);
  if (isIdle) {
    await syncTodayToSupabase(true);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const domain = await detectCurrentFocusedDomain();
  await flushElapsedTime(domain);
  await syncTodayToSupabase(false);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "GET_STATE") {
      const domain = await detectCurrentFocusedDomain();
      const store = await flushElapsedTime(domain);
      const summary = buildTodaySummary(store);
      sendResponse({
        ok: true,
        dashboardUrl: CONFIG.DASHBOARD_URL,
        auth: store.auth ? { email: store.auth.email, userId: store.auth.userId } : null,
        lastSyncAt: store.lastSyncAt,
        lastSyncError: store.lastSyncError,
        activeDomain: domain,
        summary,
      });
      return;
    }

    if (message?.type === "SIGN_IN") {
      const { email, password } = message;
      if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
        sendResponse({ ok: false, error: "Extension config missing." });
        return;
      }
      const res = await fetch(
        `${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: CONFIG.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, password }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.access_token) {
        sendResponse({
          ok: false,
          error: json.error_description || json.msg || "Invalid email or password.",
        });
        return;
      }
      const auth = {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
        userId: json.user?.id,
        email: json.user?.email || email,
      };
      await chrome.storage.local.set({ auth, lastSyncError: "" });
      const syncResult = await syncTodayToSupabase(true);
      sendResponse({ ok: true, syncResult });
      return;
    }

    if (message?.type === "SIGN_OUT") {
      await chrome.storage.local.remove(["auth", "lastSyncError", "lastSyncAt"]);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "SYNC_NOW") {
      const domain = await detectCurrentFocusedDomain();
      await flushElapsedTime(domain);
      const result = await syncTodayToSupabase(true);
      sendResponse(result);
      return;
    }

    if (message?.type === "SET_CATEGORY") {
      const store = await getStore();
      const nextOverrides = {
        ...store.overrides,
        [String(message.domain || "").toLowerCase()]: message.category,
      };
      await chrome.storage.local.set({ overrides: nextOverrides });
      const updatedStore = { ...store, overrides: nextOverrides };
      const summary = await updateBadgeAndAlert(
        updatedStore,
        updatedStore.activeSession?.domain || null
      );
      await syncTodayToSupabase(true);
      sendResponse({ ok: true, summary });
      return;
    }

    sendResponse({ ok: false, error: "Unknown command" });
  })();

  return true;
});
