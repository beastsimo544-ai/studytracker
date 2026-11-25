"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { evaluateAchievements } from "@/lib/achievements";
import {
  loadNotificationPrefs,
  sendInstantSystemNotification,
  syncDailyAndStreakSchedules,
  syncExamReminderSchedules,
  type NotificationPrefs,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export type AppNotification = {
  id: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

type ToastVariant = "success" | "error" | "info" | "achievement";

type ToastItem = {
  id: string;
  variant: ToastVariant;
  title: string;
  body?: string;
  href?: string;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  toast: {
    success: (title: string, body?: string) => void;
    error: (title: string, body?: string) => void;
    info: (title: string, body?: string, href?: string) => void;
    achievement: (title: string, body?: string) => void;
  };
  checkNewAchievements: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null
);

const MAX_STORED_NOTIFICATIONS = 25;

function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeStreakAndStudiedToday(sessionIsos: string[]) {
  const studiedKeys = new Set(
    sessionIsos.map((iso) => toLocalDateKey(new Date(iso)))
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toLocalDateKey(today);
  const studiedToday = studiedKeys.has(todayKey);

  const checkDate = new Date(today);
  if (!studiedToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  while (studiedKeys.has(toLocalDateKey(checkDate))) {
    streak += 1;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return { currentStreak: streak, studiedToday };
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return ctx;
}

export default function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const prefsRef = useRef<NotificationPrefs>(loadNotificationPrefs());
  const acceptedFriendIdsRef = useRef<Set<string>>(new Set());
  const friendLiveSeenRef = useRef<Record<string, string>>({});

  const pushToast = useCallback(
    (
      variant: ToastVariant,
      title: string,
      body?: string,
      href?: string
    ) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, variant, title, body, href }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const persistNotifications = useCallback(
    (uid: string | null, items: AppNotification[]) => {
      if (!uid || typeof window === "undefined") return;
      localStorage.setItem(
        `studyAppNotifications_${uid}`,
        JSON.stringify(items.slice(0, MAX_STORED_NOTIFICATIONS))
      );
    },
    []
  );

  const upsertNotification = useCallback(
    (uid: string | null, incoming: Omit<AppNotification, "read" | "createdAt"> & { createdAt?: string }) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incoming.id)) {
          return prev;
        }
        const next: AppNotification[] = [
          {
            id: incoming.id,
            icon: incoming.icon,
            title: incoming.title,
            body: incoming.body,
            href: incoming.href,
            createdAt: incoming.createdAt ?? new Date().toISOString(),
            read: false,
          },
          ...prev,
        ].slice(0, MAX_STORED_NOTIFICATIONS);
        persistNotifications(uid, next);
        return next;
      });
    },
    [persistNotifications]
  );

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        persistNotifications(userId, next);
        return next;
      });
    },
    [persistNotifications, userId]
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      persistNotifications(userId, next);
      return next;
    });
  }, [persistNotifications, userId]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    if (userId && typeof window !== "undefined") {
      localStorage.removeItem(`studyAppNotifications_${userId}`);
    }
  }, [userId]);

  const checkNewAchievements = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("duration, created_at")
      .eq("user_id", user.id);

    if (!sessions) return;

    const badges = evaluateAchievements(sessions);
    const unlockedIds = badges.filter((b) => b.unlocked).map((b) => b.id);
    const storageKey = `studyUnlockedBadges_${user.id}`;
    const rawPrev = localStorage.getItem(storageKey);

    if (!rawPrev) {
      localStorage.setItem(storageKey, JSON.stringify(unlockedIds));
    } else {
      try {
        const prevSet = new Set(JSON.parse(rawPrev) as string[]);
        const newlyUnlocked = badges.filter(
          (b) => b.unlocked && !prevSet.has(b.id)
        );

        localStorage.setItem(storageKey, JSON.stringify(unlockedIds));

        newlyUnlocked.forEach((badge) => {
          const title = `Achievement Unlocked: ${badge.title}`;
          pushToast("achievement", `${badge.icon} ${title}`, badge.description);
          upsertNotification(user.id, {
            id: `ach_${badge.id}`,
            icon: badge.icon,
            title,
            body: badge.description,
            href: "/dashboard",
          });
          if (typeof document !== "undefined" && document.hidden) {
            sendInstantSystemNotification({
              title: `${badge.icon} ${title}`,
              body: badge.description,
            });
          }
        });
      } catch {
        localStorage.setItem(storageKey, JSON.stringify(unlockedIds));
      }
    }

    // Also refresh streak-saver schedule after logging a session
    const { currentStreak, studiedToday } = computeStreakAndStudiedToday(
      sessions.map((s) => s.created_at)
    );
    await syncDailyAndStreakSchedules({
      prefs: prefsRef.current,
      currentStreak,
      studiedToday,
    });
  }, [pushToast, upsertNotification]);

  const refreshSchedules = useCallback(async () => {
    const prefs = loadNotificationPrefs();
    prefsRef.current = prefs;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("duration, created_at")
      .eq("user_id", user.id);

    const { currentStreak, studiedToday } = computeStreakAndStudiedToday(
      (sessions || []).map((s) => s.created_at)
    );

    await syncDailyAndStreakSchedules({
      prefs,
      currentStreak,
      studiedToday,
    });

    const examsRes = await supabase
      .from("exams")
      .select("id, title, subject, exam_date")
      .eq("user_id", user.id);

    if (!examsRes.error && examsRes.data) {
      await syncExamReminderSchedules(examsRes.data, prefs.examRemindersEnabled);
    }
  }, []);

  // Listen to preference updates from /settings
  useEffect(() => {
    const handlePrefsChanged = () => {
      prefsRef.current = loadNotificationPrefs();
      refreshSchedules();
    };

    window.addEventListener(
      "study-notification-prefs-changed",
      handlePrefsChanged
    );
    return () =>
      window.removeEventListener(
        "study-notification-prefs-changed",
        handlePrefsChanged
      );
  }, [refreshSchedules]);

  // Web-browser fallback reminder checker (every 30s when tab is open on desktop/web)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const interval = setInterval(() => {
      const prefs = prefsRef.current;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      const todayKey = toLocalDateKey(now);

      if (prefs.dailyReminderEnabled && hhmm === prefs.dailyReminderTime) {
        const firedKey = `studyWebDailyFired_${todayKey}_${hhmm}`;
        if (!localStorage.getItem(firedKey)) {
          localStorage.setItem(firedKey, "1");
          pushToast(
            "info",
            "📚 Time to Study!",
            "Start a session to stay on track with your daily goal.",
            "/timer"
          );
          sendInstantSystemNotification({
            title: "Time to Study! 📚",
            body: "Start a study session on StudyTracker to hit your daily goal.",
          });
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [pushToast]);

  // Auth + Realtime subscriptions for Friend Requests, Accepted Friends, Live Studying, Exams & Achievements
  useEffect(() => {
    let activeUid: string | null = null;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupForUser = async (uid: string) => {
      activeUid = uid;
      setUserId(uid);
      prefsRef.current = loadNotificationPrefs();

      // Restore stored notifications
      const rawStored = localStorage.getItem(`studyAppNotifications_${uid}`);
      if (rawStored) {
        try {
          setNotifications(JSON.parse(rawStored) as AppNotification[]);
        } catch {
          setNotifications([]);
        }
      } else {
        setNotifications([]);
      }

      // 1. Load friendships (seed pending requests & accepted friend IDs)
      const { data: friendshipRows } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at");

      if (friendshipRows) {
        const acceptedSet = new Set<string>();
        const pendingRequesterIds: string[] = [];

        friendshipRows.forEach((f) => {
          if (f.status === "accepted") {
            acceptedSet.add(
              f.requester_id === uid ? f.addressee_id : f.requester_id
            );
          } else if (f.status === "pending" && f.addressee_id === uid) {
            pendingRequesterIds.push(f.requester_id);
          }
        });

        acceptedFriendIdsRef.current = acceptedSet;

        if (pendingRequesterIds.length > 0) {
          const { data: reqProfiles } = await supabase
            .from("profiles")
            .select("user_id, username")
            .in("user_id", pendingRequesterIds);

          const nameMap: Record<string, string> = {};
          (reqProfiles || []).forEach((p) => {
            if (p.username) nameMap[p.user_id] = p.username;
          });

          friendshipRows
            .filter((f) => f.status === "pending" && f.addressee_id === uid)
            .forEach((f) => {
              const uname = nameMap[f.requester_id] || "student";
              upsertNotification(uid, {
                id: `freq_${f.id}`,
                icon: "👋",
                title: `Friend request from @${uname}`,
                body: "Tap to accept or decline on your Friends page.",
                href: "/friends",
                createdAt: f.created_at,
              });
            });
        }

        // Seed currently active friend sessions so we don't fire duplicate "just started" alerts on reload
        if (acceptedSet.size > 0) {
          const { data: friendProfiles } = await supabase
            .from("profiles")
            .select("user_id, studying_started_at")
            .in("user_id", Array.from(acceptedSet));

          (friendProfiles || []).forEach(
            (fp: { user_id: string; studying_started_at?: string | null }) => {
              if (fp.studying_started_at) {
                friendLiveSeenRef.current[fp.user_id] = fp.studying_started_at;
              }
            }
          );
        }
      }

      // 2. Check achievements baseline & schedule reminders
      const { data: mySessions } = await supabase
        .from("study_sessions")
        .select("duration, created_at")
        .eq("user_id", uid);

      if (mySessions) {
        const badges = evaluateAchievements(mySessions);
        const unlockedIds = badges.filter((b) => b.unlocked).map((b) => b.id);
        const badgeKey = `studyUnlockedBadges_${uid}`;
        if (!localStorage.getItem(badgeKey)) {
          localStorage.setItem(badgeKey, JSON.stringify(unlockedIds));
        }

        const { currentStreak, studiedToday } = computeStreakAndStudiedToday(
          mySessions.map((s) => s.created_at)
        );
        await syncDailyAndStreakSchedules({
          prefs: prefsRef.current,
          currentStreak,
          studiedToday,
        });
      }

      // 3. Check exams due Today or Tomorrow + schedule native exam reminders
      const examsRes = await supabase
        .from("exams")
        .select("id, title, subject, exam_date")
        .eq("user_id", uid);

      if (!examsRes.error && examsRes.data) {
        await syncExamReminderSchedules(
          examsRes.data,
          prefsRef.current.examRemindersEnabled
        );

        if (prefsRef.current.examRemindersEnabled) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayKey = toLocalDateKey(today);

          examsRes.data.forEach((exam) => {
            const [y, m, d] = exam.exam_date.split("-").map(Number);
            const target = new Date(y, (m || 1) - 1, d || 1);
            target.setHours(0, 0, 0, 0);
            const diffDays = Math.round(
              (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
            );

            if (diffDays === 0 || diffDays === 1) {
              const label = exam.subject
                ? `${exam.title} (${exam.subject})`
                : exam.title;
              upsertNotification(uid, {
                id: `exam_${exam.id}_${todayKey}`,
                icon: diffDays === 0 ? "🍀" : "📝",
                title:
                  diffDays === 0 ? `Exam Today: ${label}` : `Exam Tomorrow: ${label}`,
                body:
                  diffDays === 0
                    ? "Your exam is today — good luck!"
                    : "One day left — review your key topics today!",
                href: "/dashboard",
              });
            }
          });
        }
      }

      // 4. Subscribe to live friend requests, accepts, and friends starting study sessions
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }

      realtimeChannel = supabase
        .channel(`studytracker-notifs-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "friendships",
            filter: `addressee_id=eq.${uid}`,
          },
          async (payload) => {
            const row = payload.new as {
              id: number;
              requester_id: string;
              status: string;
            };
            if (row.status !== "pending") return;

            const { data: sender } = await supabase
              .from("profiles")
              .select("username")
              .eq("user_id", row.requester_id)
              .maybeSingle();

            const uname = sender?.username || "someone";
            const title = `New friend request from @${uname}`;
            pushToast("info", `👋 ${title}`, "Open Friends to accept.", "/friends");
            upsertNotification(uid, {
              id: `freq_${row.id}`,
              icon: "👋",
              title,
              body: "Tap to accept or decline.",
              href: "/friends",
            });
            sendInstantSystemNotification({
              title,
              body: "Open StudyTracker to accept or decline.",
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "friendships",
            filter: `requester_id=eq.${uid}`,
          },
          async (payload) => {
            const row = payload.new as {
              id: number;
              addressee_id: string;
              status: string;
            };
            if (row.status !== "accepted") return;

            acceptedFriendIdsRef.current.add(row.addressee_id);

            const { data: friendProfile } = await supabase
              .from("profiles")
              .select("username")
              .eq("user_id", row.addressee_id)
              .maybeSingle();

            const uname = friendProfile?.username || "Your friend";
            const title = `@${uname} accepted your friend request!`;
            pushToast("success", `🎉 ${title}`, "Compare study times on Friends!");
            upsertNotification(uid, {
              id: `facc_${row.id}`,
              icon: "🎉",
              title,
              body: "You can now see each other on the leaderboard.",
              href: "/friends",
            });
            sendInstantSystemNotification({
              title,
              body: "Check the Friends leaderboard on StudyTracker!",
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
          },
          (payload) => {
            const row = payload.new as {
              user_id: string;
              username?: string | null;
              studying_subject?: string | null;
              studying_started_at?: string | null;
            };

            if (!row.user_id || row.user_id === uid) return;
            if (!acceptedFriendIdsRef.current.has(row.user_id)) return;
            if (!prefsRef.current.friendLiveAlertsEnabled) return;

            if (row.studying_subject && row.studying_started_at) {
              const prevStarted = friendLiveSeenRef.current[row.user_id];
              if (prevStarted === row.studying_started_at) return;

              const startMs = new Date(row.studying_started_at).getTime();
              if (Number.isNaN(startMs) || Date.now() - startMs > 120000) {
                friendLiveSeenRef.current[row.user_id] = row.studying_started_at;
                return;
              }

              friendLiveSeenRef.current[row.user_id] = row.studying_started_at;
              const uname = row.username || "A friend";
              const title = `@${uname} started studying ${row.studying_subject}`;

              pushToast("info", `🟢 ${title}`, "Join in on the Timer!", "/timer");
              upsertNotification(uid, {
                id: `live_${row.user_id}_${row.studying_started_at}`,
                icon: "🟢",
                title,
                body: "Tap to start studying together!",
                href: "/timer",
              });

              if (typeof document !== "undefined" && document.hidden) {
                sendInstantSystemNotification({
                  title: `🟢 ${title}`,
                  body: "Open StudyTracker to study together!",
                });
              }
            } else {
              delete friendLiveSeenRef.current[row.user_id];
            }
          }
        )
        .subscribe();
    };

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await setupForUser(user.id);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUid = session?.user?.id ?? null;
      if (nextUid && nextUid !== activeUid) {
        setupForUser(nextUid);
      } else if (!nextUid) {
        activeUid = null;
        setUserId(null);
        setNotifications([]);
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [pushToast, upsertNotification]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const toastApi = useMemo(
    () => ({
      success: (title: string, body?: string) =>
        pushToast("success", title, body),
      error: (title: string, body?: string) => pushToast("error", title, body),
      info: (title: string, body?: string, href?: string) =>
        pushToast("info", title, body, href),
      achievement: (title: string, body?: string) =>
        pushToast("achievement", title, body),
    }),
    [pushToast]
  );

  const contextValue = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      toast: toastApi,
      checkNewAchievements,
      refreshSchedules,
    }),
    [
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      toastApi,
      checkNewAchievements,
      refreshSchedules,
    ]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Sleek Toast Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 top-16 z-[60] flex flex-col items-end gap-2.5 md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:w-96"
        >
          {toasts.map((item) => {
            let borderClass = "border-white/15 bg-[#121212]/95 text-white";
            if (item.variant === "success") {
              borderClass =
                "border-emerald-500/35 bg-[#0d1f18]/95 text-emerald-100";
            } else if (item.variant === "error") {
              borderClass = "border-rose-500/35 bg-[#221014]/95 text-rose-100";
            } else if (item.variant === "achievement") {
              borderClass =
                "border-amber-500/45 bg-[#221a0c]/95 text-amber-100";
            }

            const inner = (
              <div
                className={`pointer-events-auto flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-md transition ${borderClass}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.body && (
                    <p className="mt-0.5 text-xs text-white/70">{item.body}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissToast(item.id);
                  }}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>
            );

            return item.href ? (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => dismissToast(item.id)}
                className="w-full"
              >
                {inner}
              </Link>
            ) : (
              <div key={item.id} className="w-full">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </NotificationContext.Provider>
  );
}
