import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  classifyAppOrDomain,
  getTodayLocalDateKey,
  loadCategoryOverrides,
  type TrackedAppEntry,
} from "@/lib/screen-time";
import { supabase } from "@/lib/supabase";

type NativeAppUsage = {
  id: string;
  name: string;
  seconds: number;
};

type NativeTodayUsageResult = {
  granted: boolean;
  dateKey?: string;
  totalSeconds: number;
  apps: NativeAppUsage[];
};

type ScreenTimePluginInterface = {
  checkPermission(): Promise<{ granted: boolean }>;
  openUsageAccessSettings(): Promise<void>;
  getTodayUsage(): Promise<NativeTodayUsageResult>;
};

const ScreenTime = registerPlugin<ScreenTimePluginInterface>("ScreenTime");

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function checkAndroidUsagePermission(): Promise<boolean> {
  if (!isAndroidNative()) return false;
  try {
    const res = await ScreenTime.checkPermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

export async function openAndroidUsageSettings(): Promise<void> {
  if (!isAndroidNative()) return;
  await ScreenTime.openUsageAccessSettings();
}

export async function getAndroidTodayUsage(): Promise<{
  granted: boolean;
  dateKey: string;
  totalSeconds: number;
  distractingSeconds: number;
  studySeconds: number;
  apps: TrackedAppEntry[];
}> {
  const fallbackDateKey = getTodayLocalDateKey();
  if (!isAndroidNative()) {
    return {
      granted: false,
      dateKey: fallbackDateKey,
      totalSeconds: 0,
      distractingSeconds: 0,
      studySeconds: 0,
      apps: [],
    };
  }

  try {
    const res = await ScreenTime.getTodayUsage();
    const overrides = loadCategoryOverrides();
    const rawApps = Array.isArray(res?.apps) ? res.apps : [];

    let totalSeconds = 0;
    let distractingSeconds = 0;
    let studySeconds = 0;

    const apps: TrackedAppEntry[] = rawApps
      .map((item) => {
        const seconds = Math.max(0, Math.round(Number(item.seconds) || 0));
        const category = classifyAppOrDomain(item.id, item.name, overrides);
        totalSeconds += seconds;
        if (category === "distracting") distractingSeconds += seconds;
        else if (category === "study") studySeconds += seconds;

        return {
          id: item.id,
          name: item.name || item.id,
          seconds,
          category,
          source: "android" as const,
        };
      })
      .sort((a, b) => b.seconds - a.seconds);

    return {
      granted: Boolean(res?.granted),
      dateKey: res?.dateKey || fallbackDateKey,
      totalSeconds,
      distractingSeconds,
      studySeconds,
      apps,
    };
  } catch {
    return {
      granted: false,
      dateKey: fallbackDateKey,
      totalSeconds: 0,
      distractingSeconds: 0,
      studySeconds: 0,
      apps: [],
    };
  }
}

export async function syncAndroidUsageToSupabase(userId: string): Promise<{
  granted: boolean;
  setupRequired: boolean;
  dateKey: string;
  totalSeconds: number;
  distractingSeconds: number;
  studySeconds: number;
  apps: TrackedAppEntry[];
}> {
  const usage = await getAndroidTodayUsage();
  if (!usage.granted) {
    return { ...usage, setupRequired: false };
  }

  const { error } = await supabase.from("screen_time_logs").upsert(
    {
      user_id: userId,
      log_date: usage.dateKey,
      source: "android",
      total_seconds: usage.totalSeconds,
      distracting_seconds: usage.distractingSeconds,
      study_seconds: usage.studySeconds,
      apps: usage.apps.slice(0, 20),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date,source" }
  );

  const setupRequired = Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message.includes("screen_time_logs"))
  );

  return {
    ...usage,
    setupRequired,
  };
}
