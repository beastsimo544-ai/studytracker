import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from "@capacitor/local-notifications";

export type NotificationPrefs = {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // "HH:MM", e.g. "19:00"
  streakSaverEnabled: boolean;
  examRemindersEnabled: boolean;
  friendLiveAlertsEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyReminderEnabled: false,
  dailyReminderTime: "19:00",
  streakSaverEnabled: true,
  examRemindersEnabled: true,
  friendLiveAlertsEnabled: true,
};

const PREFS_STORAGE_KEY = "studyNotificationPrefs";

// Notification ID ranges (must be 32-bit integers on Android)
const ID_ONGOING_TIMER = 1001;
const ID_POMODORO_END = 1002;
const ID_DAILY_REMINDER = 2001;
const ID_STREAK_SAVER = 2002;
const ID_EXAM_BASE = 3000;
const ID_EXAM_MAX = 3099;

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      dailyReminderEnabled:
        typeof parsed.dailyReminderEnabled === "boolean"
          ? parsed.dailyReminderEnabled
          : DEFAULT_NOTIFICATION_PREFS.dailyReminderEnabled,
      dailyReminderTime:
        typeof parsed.dailyReminderTime === "string" &&
        /^\d{2}:\d{2}$/.test(parsed.dailyReminderTime)
          ? parsed.dailyReminderTime
          : DEFAULT_NOTIFICATION_PREFS.dailyReminderTime,
      streakSaverEnabled:
        typeof parsed.streakSaverEnabled === "boolean"
          ? parsed.streakSaverEnabled
          : DEFAULT_NOTIFICATION_PREFS.streakSaverEnabled,
      examRemindersEnabled:
        typeof parsed.examRemindersEnabled === "boolean"
          ? parsed.examRemindersEnabled
          : DEFAULT_NOTIFICATION_PREFS.examRemindersEnabled,
      friendLiveAlertsEnabled:
        typeof parsed.friendLiveAlertsEnabled === "boolean"
          ? parsed.friendLiveAlertsEnabled
          : DEFAULT_NOTIFICATION_PREFS.friendLiveAlertsEnabled,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(
    new CustomEvent("study-notification-prefs-changed", { detail: prefs })
  );
}

export async function getNotificationPermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unsupported"
> {
  if (typeof window === "undefined") return "unsupported";

  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === "granted") return "granted";
      if (status.display === "denied") return "denied";
      return "prompt";
    } catch {
      return "unsupported";
    }
  }

  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "prompt";
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === "granted") return true;
      const requested = await LocalNotifications.requestPermissions();
      return requested.display === "granted";
    } catch {
      return false;
    }
  }

  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export async function sendInstantSystemNotification(options: {
  title: string;
  body: string;
  id?: number;
}) {
  if (typeof window === "undefined") return;

  const notifId = options.id ?? Math.floor(4000 + Math.random() * 50000);

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") return;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: options.title,
            body: options.body,
            schedule: { at: new Date(Date.now() + 250) },
          },
        ],
      });
    } catch {
      // Ignore if unavailable
    }
    return;
  }

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(options.title, {
        body: options.body,
        icon: "/icon.svg",
      });
    } catch {
      // Ignore browser notification errors
    }
  }
}

export async function showOngoingTimerNotification(
  subject: string,
  modeLabel: string
) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_ONGOING_TIMER,
          title: `Studying ${subject}`,
          body: `${modeLabel} timer is running · Tap to return to StudyTracker`,
          ongoing: true,
          autoCancel: false,
        },
      ],
    });
  } catch {
    // Ignore
  }
}

export async function clearOngoingTimerNotification() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: ID_ONGOING_TIMER }],
    });
  } catch {
    // Ignore
  }
}

export async function schedulePomodoroFinishNotification(options: {
  endTimestampMs: number;
  isBreak: boolean;
  subject: string;
  durationMinutes: number;
}) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    await LocalNotifications.cancel({
      notifications: [{ id: ID_POMODORO_END }],
    });

    if (options.endTimestampMs <= Date.now() + 1000) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_POMODORO_END,
          title: options.isBreak
            ? "Break Finished! ⏰"
            : `Focus Complete (${options.durationMinutes}m)! 🍅`,
          body: options.isBreak
            ? "Ready to jump into your next study block?"
            : `Great job studying ${options.subject}! Open StudyTracker to start your break.`,
          schedule: {
            at: new Date(options.endTimestampMs),
            allowWhileIdle: true,
          },
        },
      ],
    });
  } catch {
    // Ignore
  }
}

export async function cancelPomodoroFinishNotification() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: ID_POMODORO_END }],
    });
  } catch {
    // Ignore
  }
}

export async function syncDailyAndStreakSchedules(options: {
  prefs: NotificationPrefs;
  currentStreak?: number;
  studiedToday?: boolean;
}) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    // Cancel existing daily + streak schedules first
    await LocalNotifications.cancel({
      notifications: [{ id: ID_DAILY_REMINDER }, { id: ID_STREAK_SAVER }],
    });

    const toSchedule: LocalNotificationSchema[] = [];

    if (options.prefs.dailyReminderEnabled) {
      const [hh, mm] = options.prefs.dailyReminderTime.split(":").map(Number);
      toSchedule.push({
        id: ID_DAILY_REMINDER,
        title: "Time to Study! 📚",
        body: "Start a study session on StudyTracker to stay on track with your daily goal.",
        schedule: {
          on: {
            hour: Number.isFinite(hh) ? hh : 19,
            minute: Number.isFinite(mm) ? mm : 0,
          },
          repeats: true,
        },
      });
    }

    if (options.prefs.streakSaverEnabled && (options.currentStreak ?? 0) > 0) {
      const now = new Date();
      const target = new Date(now);
      target.setHours(20, 30, 0, 0);

      // If user already studied today or it's already past 20:30, schedule for tomorrow 20:30
      if (options.studiedToday || target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const nextStreakCount = options.studiedToday
        ? options.currentStreak ?? 1
        : options.currentStreak ?? 1;

      toSchedule.push({
        id: ID_STREAK_SAVER,
        title: `Protect Your ${nextStreakCount}-Day Streak! 🔥`,
        body: "Log a quick study session before midnight to keep your streak alive.",
        schedule: {
          at: target,
          allowWhileIdle: true,
        },
      });
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch {
    // Ignore
  }
}

export async function syncExamReminderSchedules(
  exams: { title: string; subject: string | null; exam_date: string }[],
  enabled: boolean
) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    const cancelIds = [];
    for (let id = ID_EXAM_BASE; id <= ID_EXAM_MAX; id += 1) {
      cancelIds.push({ id });
    }
    await LocalNotifications.cancel({ notifications: cancelIds });

    if (!enabled || exams.length === 0) return;

    const nowMs = Date.now();
    const notifications: LocalNotificationSchema[] = [];
    let nextId = ID_EXAM_BASE;

    exams.slice(0, 40).forEach((exam) => {
      const [y, m, d] = exam.exam_date.split("-").map(Number);
      if (!y || !m || !d) return;

      const label = exam.subject
        ? `${exam.title} (${exam.subject})`
        : exam.title;

      // Day before at 09:00
      const dayBefore = new Date(y, m - 1, d - 1, 9, 0, 0, 0);
      if (dayBefore.getTime() > nowMs && nextId <= ID_EXAM_MAX) {
        notifications.push({
          id: nextId,
          title: "Exam Tomorrow! 📝",
          body: `${label} is tomorrow. Review your notes today!`,
          schedule: { at: dayBefore, allowWhileIdle: true },
        });
        nextId += 1;
      }

      // Exam morning at 08:00
      const examMorning = new Date(y, m - 1, d, 8, 0, 0, 0);
      if (examMorning.getTime() > nowMs && nextId <= ID_EXAM_MAX) {
        notifications.push({
          id: nextId,
          title: "Exam Day — Good Luck! 🍀",
          body: `${label} is today. You've got this!`,
          schedule: { at: examMorning, allowWhileIdle: true },
        });
        nextId += 1;
      }
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch {
    // Ignore
  }
}
