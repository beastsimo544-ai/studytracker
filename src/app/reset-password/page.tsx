"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setHasRecoverySession(Boolean(session));
      setIsChecking(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setIsChecking(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Updating password...");

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password updated! Redirecting to dashboard...");
    setTimeout(() => {
      router.push("/dashboard");
    }, 1200);
  };

  if (isChecking) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <p className="text-white/60">Verifying reset link...</p>
      </main>
    );
  }

  if (!hasRecoverySession) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="text-3xl font-bold">Reset link expired</h1>
        <p className="mt-3 text-sm text-white/60">
          Open the password reset link directly from your email, or request a
          fresh reset link from the login page.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
        >
          Go to Login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">Choose a new password</h1>
      <p className="mt-2 text-white/60">
        Enter a new password for your StudyTracker account.
      </p>

      <form onSubmit={handleUpdatePassword} className="mt-8 space-y-5">
        <div>
          <label className="text-sm text-white/70">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label className="text-sm text-white/70">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
            placeholder="Repeat new password"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Update Password"}
        </button>
      </form>

      {message && <p className="mt-5 text-sm text-white/70">{message}</p>}
    </main>
  );
}
