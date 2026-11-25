"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage("Logging in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Login successful! Redirecting...");
    const hasSavedTimer = Boolean(localStorage.getItem("studyTimer"));
    router.push(hasSavedTimer ? "/timer" : "/dashboard");
    router.refresh();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Sending reset link...");

    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: redirectUrl,
    });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Password reset link sent! Check your email inbox (and spam folder)."
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
        {isResetMode ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              Reset password
            </h1>

            <p className="mt-1.5 text-xs leading-relaxed text-white/55 sm:text-sm">
              Enter your account email and we&apos;ll send you a password reset
              link.
            </p>

            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/70">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            {message && (
              <p className="mt-4 text-xs text-white/75 sm:text-sm">{message}</p>
            )}

            <button
              type="button"
              onClick={() => {
                setIsResetMode(false);
                setMessage("");
              }}
              className="mt-5 text-xs font-medium text-white/65 hover:text-white"
            >
              ← Back to login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Sign In</h1>

            <p className="mt-1.5 text-xs text-white/55 sm:text-sm">
              Sign in to sync your study sessions, streaks, and friends.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/70">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/70">
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setMessage("");
                    }}
                    className="text-xs text-white/55 hover:text-white"
                  >
                    Forgot password?
                  </button>
                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
                  placeholder="Your password"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {message && (
              <p className="mt-4 text-xs text-white/75 sm:text-sm">{message}</p>
            )}

            <p className="mt-5 text-center text-xs text-white/55 sm:text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-white hover:underline"
              >
                Create account
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
