"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.username) {
        setUsername(profile.username);
      }

      setIsLoading(false);
    };

    loadAccount();
  }, [router]);

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
    setPasswordMessage("Password updated successfully!");
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
      // 1. Delete all user data across public tables
      await supabase.from("study_sessions").delete().eq("user_id", userId);
      await supabase.from("subjects").delete().eq("user_id", userId);
      await supabase
        .from("friendships")
        .delete()
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      await supabase.from("profiles").delete().eq("user_id", userId);

      // 2. Delete auth.users account via secure RPC (if installed in Supabase)
      const { error: rpcError } = await supabase.rpc("delete_my_account");
      if (rpcError) {
        console.warn("delete_my_account RPC note:", rpcError.message);
      }

      // 3. Clear local state and sign out
      localStorage.removeItem("studyTimer");
      await supabase.auth.signOut();

      alert("Your account and study data have been deleted.");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Account deletion error:", error);
      alert("An error occurred while deleting your account.");
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
          Manage your profile, password, privacy, and account data.
        </p>
      </div>

      {/* PROFILE SUMMARY */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Account Information</h2>

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

      {/* PRIVACY POLICY */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Privacy & Data</h2>
            <p className="mt-1 text-sm text-white/50">
              Read how StudyTracker stores and protects your study data.
            </p>
          </div>

          <Link
            href="/privacy"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm transition hover:bg-white/5"
          >
            View Privacy Policy
          </Link>
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
