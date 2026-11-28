"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import ProfileEffectPicker from "@/components/profile-effect-picker";
import UserAvatar from "@/components/user-avatar";
import {
  evaluateAchievements,
  type Achievement,
  type SessionForAchievements,
} from "@/lib/achievements";
import { notifyAvatarUpdated, resizeAvatarFile } from "@/lib/avatar";
import {
  loadLocalProfileEffectPref,
  parseProfileEffectPreference,
  resolveActiveProfileEffect,
  saveResolvedActiveEffectId,
  type ProfileEffectPreference,
} from "@/lib/profile-effects";
import { exportSessionsToCsv, type CsvSessionRow } from "@/lib/csv-export";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPermissionState,
  loadNotificationPrefs,
  requestNotificationPermissions,
  saveNotificationPrefs,
  sendInstantSystemNotification,
  type NotificationPrefs,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasProfileRow, setHasProfileRow] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>(() =>
    evaluateAchievements([])
  );
  const [effectPref, setEffectPref] = useState<ProfileEffectPreference>("auto");
  const [isLoading, setIsLoading] = useState(true);

  // Notification preferences
  const [notifPermission, setNotifPermission] = useState<
    "granted" | "denied" | "prompt" | "unsupported"
  >("prompt");
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    const loadAccount = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");
      setNotifPrefs(loadNotificationPrefs());
      setNotifPermission(await getNotificationPermissionState());

      const [fullRes, sessionsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, avatar_url, profile_effect")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("study_sessions")
          .select("duration, created_at")
          .eq("user_id", user.id),
      ]);

      const evaluated = evaluateAchievements(
        (sessionsRes.data || []) as SessionForAchievements[]
      );
      setAchievements(evaluated);

      let profileUsername: string | null = null;
      let profileAvatar: string | null = null;
      let profileEffectRaw: string | null = null;
      let foundProfile = false;

      if (fullRes.error) {
        if (fullRes.error.message.includes("profile_effect")) {
          const avatarRes = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle();

          if (
            avatarRes.error &&
            avatarRes.error.message.includes("avatar_url")
          ) {
            const fallbackRes = await supabase
              .from("profiles")
              .select("username")
              .eq("user_id", user.id)
              .maybeSingle();

            if (fallbackRes.data) {
              foundProfile = true;
              profileUsername = fallbackRes.data.username ?? null;
            }
          } else if (avatarRes.data) {
            foundProfile = true;
            profileUsername = avatarRes.data.username ?? null;
            profileAvatar = avatarRes.data.avatar_url ?? null;
          }
        } else if (fullRes.error.message.includes("avatar_url")) {
          const fallbackRes = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", user.id)
            .maybeSingle();

          if (fallbackRes.data) {
            foundProfile = true;
            profileUsername = fallbackRes.data.username ?? null;
          }
        }
      } else if (fullRes.data) {
        foundProfile = true;
        profileUsername = fullRes.data.username ?? null;
        profileAvatar = fullRes.data.avatar_url ?? null;
        profileEffectRaw = fullRes.data.profile_effect ?? null;
      }

      if (foundProfile) {
        setHasProfileRow(true);
        setUsername(profileUsername);
        setAvatarUrl(profileAvatar);
      }

      const resolvedPref = profileEffectRaw
        ? parseProfileEffectPreference(profileEffectRaw)
        : loadLocalProfileEffectPref();
      setEffectPref(resolvedPref);

      const resolvedEffect = resolveActiveProfileEffect(
        resolvedPref,
        evaluated.filter((a) => a.unlocked).map((a) => a.id)
      );
      saveResolvedActiveEffectId(resolvedEffect?.id ?? null);

      setIsLoading(false);
    };

    loadAccount();
  }, [router]);

  const updatePref = async (patch: Partial<NotificationPrefs>) => {
    const next = { ...notifPrefs, ...patch };
    setNotifPrefs(next);
    saveNotificationPrefs(next);

    if (
      (patch.dailyReminderEnabled ||
        patch.streakSaverEnabled ||
        patch.examRemindersEnabled) &&
      notifPermission !== "granted"
    ) {
      const granted = await requestNotificationPermissions();
      setNotifPermission(await getNotificationPermissionState());
      if (!granted) {
        toast.info(
          "Enable system notifications",
          "Allow notifications on your device so background reminders can appear."
        );
      }
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermissions();
    const updatedState = await getNotificationPermissionState();
    setNotifPermission(updatedState);

    if (granted) {
      toast.success(
        "Notifications enabled!",
        "You'll receive timer alerts and study reminders."
      );
      await sendInstantSystemNotification({
        title: "StudyTracker Notifications Enabled 🔔",
        body: "Pomodoro alerts, streak-savers, and friend updates are active!",
      });
    } else {
      toast.error(
        "Notifications blocked",
        "Check your browser or phone app settings to allow notifications."
      );
    }
  };

  const handleTestNotification = async () => {
    if (notifPermission !== "granted") {
      await handleEnableNotifications();
      return;
    }

    toast.success(
      "Test notification sent!",
      "Check your system notification bar."
    );
    await sendInstantSystemNotification({
      title: "StudyTracker Test Alert ⚡",
      body: "Notifications are working on this device!",
    });
  };

  const saveAvatarToDb = async (nextAvatarUrl: string | null) => {
    if (!userId) return;
    setIsSavingAvatar(true);
    setAvatarMessage("");

    const result = hasProfileRow
      ? await supabase
          .from("profiles")
          .update({ avatar_url: nextAvatarUrl })
          .eq("user_id", userId)
      : await supabase.from("profiles").insert({
          user_id: userId,
          avatar_url: nextAvatarUrl,
          daily_goal_minutes: 120,
        });

    setIsSavingAvatar(false);

    if (result.error) {
      if (result.error.message.includes("avatar_url")) {
        setAvatarMessage(
          "Run `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;` in Supabase SQL Editor first."
        );
      } else {
        setAvatarMessage(`Could not save photo: ${result.error.message}`);
      }
      return;
    }

    setHasProfileRow(true);
    setAvatarUrl(nextAvatarUrl);
    notifyAvatarUpdated(nextAvatarUrl);
    toast.success(
      nextAvatarUrl ? "Profile picture updated!" : "Profile picture removed."
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setIsSavingAvatar(true);
      setAvatarMessage("Processing image...");
      const dataUrl = await resizeAvatarFile(file);
      await saveAvatarToDb(dataUrl);
      setAvatarMessage("");
    } catch (err) {
      setIsSavingAvatar(false);
      setAvatarMessage(
        err instanceof Error ? err.message : "Could not process image."
      );
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPassword) return;

    if (newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage("Updating password...");

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsSavingPassword(false);

    if (error) {
      setPasswordMessage(error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("");
    toast.success("Password updated successfully!");
  };

  const handleExportAllDataCsv = async () => {
    if (!userId || isExportingCsv) return;
    setIsExportingCsv(true);

    const fullRes = await supabase
      .from("study_sessions")
      .select("subject, duration, created_at, note")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    let rows: CsvSessionRow[] = [];

    if (fullRes.error && fullRes.error.message.includes("note")) {
      const fallbackRes = await supabase
        .from("study_sessions")
        .select("subject, duration, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fallbackRes.error) {
        setIsExportingCsv(false);
        toast.error("Could not load sessions for export");
        return;
      }
      rows = (fallbackRes.data || []) as CsvSessionRow[];
    } else if (fullRes.error) {
      setIsExportingCsv(false);
      toast.error("Could not load sessions for export");
      return;
    } else {
      rows = (fullRes.data || []) as CsvSessionRow[];
    }

    setIsExportingCsv(false);

    if (rows.length === 0) {
      toast.info("No study sessions to export yet");
      return;
    }

    const res = await exportSessionsToCsv(rows, "studytracker-all-sessions");
    if (res !== "cancelled") {
      toast.success("CSV exported!", `${rows.length} session(s) exported.`);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId || isDeletingAccount) return;
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") return;

    const confirmed = window.confirm(
      "Are you sure? This permanently deletes your StudyTracker account, study history, subjects, and friend connections."
    );
    if (!confirmed) return;

    setIsDeletingAccount(true);

    try {
      await supabase.from("study_sessions").delete().eq("user_id", userId);
      await supabase.from("exams").delete().eq("user_id", userId);
      await supabase.from("subjects").delete().eq("user_id", userId);
      await supabase
        .from("friendships")
        .delete()
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      await supabase.from("profiles").delete().eq("user_id", userId);

      const { error: rpcError } = await supabase.rpc("delete_my_account");
      if (rpcError) {
        console.warn("delete_my_account RPC note:", rpcError.message);
      }

      localStorage.removeItem("studyTimer");
      notifyAvatarUpdated(null);
      await supabase.auth.signOut();

      toast.info("Account deleted", "Your account and study data were erased.");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Account deletion error:", error);
      toast.error("Could not delete account.");
      setIsDeletingAccount(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-6 text-center">
          <p className="text-sm text-white/55">Loading account settings...</p>
        </div>
      </main>
    );
  }

  const activeProfileEffect = resolveActiveProfileEffect(
    effectPref,
    achievements.filter((a) => a.unlocked).map((a) => a.id)
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Settings
          </h1>
          <p className="mt-1 text-xs text-white/55 sm:text-sm">
            Profile, study reminders, data export, and account security.
          </p>
        </div>

        <button
          type="button"
          disabled={isSigningOut}
          onClick={handleSignOut}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-[#111113] px-3.5 text-xs font-semibold text-white/85 transition hover:border-white/30 hover:text-white disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </div>

      {/* PROFILE PICTURE & ACCOUNT SUMMARY */}
      <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
        <h2 className="text-base font-semibold">Profile</h2>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-white/[0.08] pb-4">
          <UserAvatar
            avatarUrl={avatarUrl}
            name={username || email}
            size="lg"
            effectId={activeProfileEffect?.id ?? null}
            className="!h-14 !w-14 !text-lg"
          />

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                disabled={isSavingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {isSavingAvatar
                  ? "Saving..."
                  : avatarUrl
                    ? "Change Photo"
                    : "Upload Photo"}
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  disabled={isSavingAvatar}
                  onClick={() => saveAvatarToDb(null)}
                  className="h-9 rounded-xl border border-white/15 px-3.5 text-xs text-white/70 transition hover:text-white disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>

            <p className="text-[11px] text-white/45">
              PNG, JPG, WebP, or animated GIF (up to 1.5 MB)
            </p>

            {avatarMessage && (
              <p className="text-xs text-white/75">{avatarMessage}</p>
            )}
          </div>
        </div>

        <div className="mt-3.5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2.5">
            <span className="shrink-0 text-xs text-white/50">Email</span>
            <span className="truncate text-xs font-medium sm:text-sm">
              {email || "—"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="shrink-0 text-xs text-white/50">Username</span>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-medium sm:text-sm">
                {username ? `@${username}` : "Not set"}
              </span>
              <Link
                href="/friends"
                className="text-xs text-emerald-400 hover:underline"
              >
                {username ? "Edit" : "Set"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PROFILE EFFECTS (UNLOCKED BY ACHIEVEMENTS) */}
      <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Profile Effects ✨</h2>
          <p className="mt-0.5 text-xs text-white/50">
            Animated Discord-style profile effects unlocked from your study
            achievements, shown on Friends &amp; Group leaderboards.
          </p>
        </div>

        <ProfileEffectPicker
          mode="inline"
          userId={userId}
          username={username || email.split("@")[0] || "student"}
          avatarUrl={avatarUrl}
          achievements={achievements}
          preference={effectPref}
          onPreferenceChange={(nextPref) => setEffectPref(nextPref)}
        />
      </section>

      {/* NOTIFICATIONS & REMINDERS */}
      <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-semibold">
              Notifications &amp; Reminders
            </h2>
            <p className="mt-0.5 text-xs text-white/50">
              Device status:{" "}
              <span
                className={
                  notifPermission === "granted"
                    ? "font-semibold text-emerald-400"
                    : "font-semibold text-amber-300"
                }
              >
                {notifPermission === "granted"
                  ? "Enabled ✓"
                  : notifPermission === "denied"
                    ? "Blocked in settings"
                    : notifPermission === "unsupported"
                      ? "In-app alerts only"
                      : "Not enabled yet"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {notifPermission !== "granted" &&
              notifPermission !== "unsupported" && (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Enable
                </button>
              )}

            <button
              type="button"
              onClick={handleTestNotification}
              className="h-9 rounded-xl border border-white/15 px-3.5 text-xs font-medium transition hover:bg-white/5"
            >
              Send Test
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3.5 text-sm">
          {/* Daily Reminder */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Daily Study Reminder</p>
              <p className="text-xs text-white/50">
                Daily nudge at your preferred study time.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={notifPrefs.dailyReminderTime}
                onChange={(e) =>
                  updatePref({ dailyReminderTime: e.target.value })
                }
                className="h-8 rounded-lg border border-white/12 bg-[#09090b] px-2.5 text-xs tabular-nums outline-none"
              />

              <button
                type="button"
                onClick={() =>
                  updatePref({
                    dailyReminderEnabled: !notifPrefs.dailyReminderEnabled,
                  })
                }
                className={`h-8 min-w-[52px] rounded-full px-3 text-xs font-semibold transition ${
                  notifPrefs.dailyReminderEnabled
                    ? "bg-emerald-400 text-black"
                    : "border border-white/15 bg-[#09090b] text-white/60"
                }`}
              >
                {notifPrefs.dailyReminderEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Streak-Saver */}
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Streak-Saver Alert (20:30)</p>
              <p className="text-xs text-white/50">
                Evening heads-up if your active streak isn&apos;t extended yet.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                updatePref({
                  streakSaverEnabled: !notifPrefs.streakSaverEnabled,
                })
              }
              className={`h-8 min-w-[52px] shrink-0 rounded-full px-3 text-xs font-semibold transition ${
                notifPrefs.streakSaverEnabled
                  ? "bg-emerald-400 text-black"
                  : "border border-white/15 bg-[#09090b] text-white/60"
              }`}
            >
              {notifPrefs.streakSaverEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* Exam Reminders */}
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Upcoming Exam Reminders</p>
              <p className="text-xs text-white/50">
                Alerts the day before (09:00) and morning of (08:00) exams.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                updatePref({
                  examRemindersEnabled: !notifPrefs.examRemindersEnabled,
                })
              }
              className={`h-8 min-w-[52px] shrink-0 rounded-full px-3 text-xs font-semibold transition ${
                notifPrefs.examRemindersEnabled
                  ? "bg-emerald-400 text-black"
                  : "border border-white/15 bg-[#09090b] text-white/60"
              }`}
            >
              {notifPrefs.examRemindersEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* Live Friend Activity */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Live Friend Study Alerts</p>
              <p className="text-xs text-white/50">
                Alert when an accepted friend starts studying live.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                updatePref({
                  friendLiveAlertsEnabled: !notifPrefs.friendLiveAlertsEnabled,
                })
              }
              className={`h-8 min-w-[52px] shrink-0 rounded-full px-3 text-xs font-semibold transition ${
                notifPrefs.friendLiveAlertsEnabled
                  ? "bg-emerald-400 text-black"
                  : "border border-white/15 bg-[#09090b] text-white/60"
              }`}
            >
              {notifPrefs.friendLiveAlertsEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      </section>

      {/* CHANGE PASSWORD */}
      <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
        <h2 className="text-base font-semibold">Change Password</h2>
        <p className="mt-0.5 text-xs text-white/50">
          Update the password you use to sign in.
        </p>

        <form onSubmit={handleChangePassword} className="mt-3.5 space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-white/60">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
                placeholder="At least 6 characters"
                className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
                placeholder="Repeat new password"
                className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="h-10 rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50 sm:text-sm"
          >
            {isSavingPassword ? "Updating..." : "Update Password"}
          </button>

          {passwordMessage && (
            <p className="text-xs text-white/70">{passwordMessage}</p>
          )}
        </form>
      </section>

      {/* PRIVACY POLICY & CSV EXPORT */}
      <section className="mt-4 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Privacy &amp; Data Export</h2>
            <p className="mt-0.5 text-xs text-white/50">
              Export all saved study sessions to CSV or view our privacy policy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isExportingCsv}
              onClick={handleExportAllDataCsv}
              className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {isExportingCsv ? "Exporting..." : "Export CSV"}
            </button>

            <Link
              href="/privacy"
              className="inline-flex h-9 items-center rounded-xl border border-white/15 px-3.5 text-xs font-medium transition hover:bg-white/5"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>

      {/* DANGER ZONE — DELETE ACCOUNT */}
      <section className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-rose-400">Delete Account</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/65">
          Permanently delete your account and erase all saved study sessions,
          subjects, daily goals, and friendships. This action cannot be undone.
        </p>

        <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="h-10 flex-1 rounded-xl border border-rose-500/25 bg-[#09090b] px-3.5 text-sm outline-none focus:border-rose-500/50"
          />

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={
              deleteConfirmText.trim().toUpperCase() !== "DELETE" ||
              isDeletingAccount
            }
            className="h-10 rounded-xl border border-rose-500/35 bg-rose-500/15 px-4 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            {isDeletingAccount ? "Deleting..." : "Delete My Account"}
          </button>
        </div>
      </section>
    </main>
  );
}
