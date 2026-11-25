"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import UserAvatar from "@/components/user-avatar";
import { notifyAvatarUpdated, resizeAvatarFile } from "@/lib/avatar";
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

      const fullRes = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fullRes.error && fullRes.error.message.includes("avatar_url")) {
        const fallbackRes = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .maybeSingle();

        if (fallbackRes.data) {
          setHasProfileRow(true);
          setUsername(fallbackRes.data.username ?? null);
        }
      } else if (fullRes.data) {
        setHasProfileRow(true);
        setUsername(fullRes.data.username ?? null);
        setAvatarUrl(fullRes.data.avatar_url ?? null);
      }

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
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">Loading account settings...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="mt-2 text-white/60">
          Manage your profile, reminders, notifications, password, and account
          data.
        </p>
      </div>

      {/* PROFILE PICTURE & ACCOUNT SUMMARY */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Profile</h2>

        <div className="mt-5 flex flex-wrap items-center gap-5 border-b border-white/10 pb-6">
          <UserAvatar
            avatarUrl={avatarUrl}
            name={username || email}
            size="lg"
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
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
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
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
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:text-white disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>

            <p className="text-xs text-white/45">
              PNG, JPG, or WebP · Automatically cropped to a square
            </p>

            {avatarMessage && (
              <p className="text-xs text-white/75">{avatarMessage}</p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <span className="text-white/50">Email</span>
            <span className="font-medium">{email || "—"}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-white/50">Username</span>
            <div className="flex items-center gap-3">
              <span className="font-mono font-medium">
                {username ? `@${username}` : "Not set"}
              </span>
              <Link
                href="/friends"
                className="text-xs text-white/70 underline hover:text-white"
              >
                {username ? "Change" : "Set username"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* NOTIFICATIONS & REMINDERS */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h2 className="text-lg font-semibold">
              Notifications & Study Reminders 🔔
            </h2>
            <p className="mt-1 text-sm text-white/50">
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
                  className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Enable Notifications
                </button>
              )}

            <button
              type="button"
              onClick={handleTestNotification}
              className="rounded-xl border border-white/20 px-4 py-2 text-xs font-medium transition hover:bg-white/5"
            >
              Send Test
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          {/* Daily Reminder */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="font-medium">Daily Study Reminder</p>
              <p className="text-xs text-white/50">
                Get a daily nudge at your chosen study time.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="time"
                value={notifPrefs.dailyReminderTime}
                onChange={(e) =>
                  updatePref({ dailyReminderTime: e.target.value })
                }
                className="rounded-xl border border-white/10 bg-black px-3 py-1.5 text-xs outline-none"
              />

              <button
                type="button"
                onClick={() =>
                  updatePref({
                    dailyReminderEnabled: !notifPrefs.dailyReminderEnabled,
                  })
                }
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  notifPrefs.dailyReminderEnabled
                    ? "bg-emerald-400 text-black"
                    : "border border-white/15 bg-black/40 text-white/60"
                }`}
              >
                {notifPrefs.dailyReminderEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Streak-Saver */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="font-medium">Streak-Saver Alert (20:30) 🔥</p>
              <p className="text-xs text-white/50">
                Evening heads-up if your active study streak hasn&apos;t been
                extended today.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                updatePref({
                  streakSaverEnabled: !notifPrefs.streakSaverEnabled,
                })
              }
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                notifPrefs.streakSaverEnabled
                  ? "bg-emerald-400 text-black"
                  : "border border-white/15 bg-black/40 text-white/60"
              }`}
            >
              {notifPrefs.streakSaverEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* Exam Reminders */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="font-medium">Upcoming Exam Reminders 📝</p>
              <p className="text-xs text-white/50">
                Notify the day before (09:00) and morning of (08:00) pinned
                exams.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                updatePref({
                  examRemindersEnabled: !notifPrefs.examRemindersEnabled,
                })
              }
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                notifPrefs.examRemindersEnabled
                  ? "bg-emerald-400 text-black"
                  : "border border-white/15 bg-black/40 text-white/60"
              }`}
            >
              {notifPrefs.examRemindersEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* Live Friend Activity */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Live Friend Study Alerts 🟢</p>
              <p className="text-xs text-white/50">
                Alert when an accepted friend starts a live study session.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                updatePref({
                  friendLiveAlertsEnabled: !notifPrefs.friendLiveAlertsEnabled,
                })
              }
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                notifPrefs.friendLiveAlertsEnabled
                  ? "bg-emerald-400 text-black"
                  : "border border-white/15 bg-black/40 text-white/60"
              }`}
            >
              {notifPrefs.friendLiveAlertsEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      </section>

      {/* CHANGE PASSWORD */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <p className="mt-1 text-sm text-white/50">
          Update the password you use to sign in.
        </p>

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-white/60">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
                placeholder="At least 6 characters"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
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
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {isSavingPassword ? "Updating..." : "Update Password"}
          </button>

          {passwordMessage && (
            <p className="text-sm text-white/70">{passwordMessage}</p>
          )}
        </form>
      </section>

      {/* PRIVACY POLICY & CSV EXPORT */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Privacy &amp; Data Export</h2>
            <p className="mt-1 text-sm text-white/50">
              Export all your saved study sessions to CSV or view our privacy
              policy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isExportingCsv}
              onClick={handleExportAllDataCsv}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {isExportingCsv ? "Exporting..." : "Export CSV"}
            </button>

            <Link
              href="/privacy"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm transition hover:bg-white/5"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>

      {/* DANGER ZONE — DELETE ACCOUNT */}
      <section className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <h2 className="text-lg font-semibold text-red-400">Delete Account</h2>
        <p className="mt-1 text-sm text-white/70">
          Permanently delete your account and erase all saved study sessions,
          subjects, daily goals, and friendships. This action cannot be undone.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="flex-1 rounded-xl border border-red-500/30 bg-black px-4 py-3 text-sm outline-none"
          />

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={
              deleteConfirmText.trim().toUpperCase() !== "DELETE" ||
              isDeletingAccount
            }
            className="rounded-xl border border-red-500/40 bg-red-500/20 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeletingAccount ? "Deleting..." : "Delete My Account"}
          </button>
        </div>
      </section>
    </main>
  );
}
