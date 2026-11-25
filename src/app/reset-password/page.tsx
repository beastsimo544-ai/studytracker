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
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-14">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-6 text-center">
          <p className="text-sm text-white/55">Verifying reset link...</p>
        </div>
      </main>
    );
  }

  if (!hasRecoverySession) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-14">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
          <h1 className="text-2xl font-bold tracking-tight">
            Reset link expired
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-white/60 sm:text-sm">
            Open the password reset link directly from your email, or request a
            fresh reset link from the sign-in page.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex h-10 items-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Go to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
        <h1 className="text-2xl font-bold tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-xs text-white/55 sm:text-sm">
          Enter a new password for your StudyTracker account.
        </p>

        <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-white/70">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-white/70">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
              placeholder="Repeat new password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Update Password"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-xs text-white/75 sm:text-sm">{message}</p>
        )}
      </div>
    </main>
  );
}
