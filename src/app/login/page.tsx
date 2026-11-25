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
    <main className="mx-auto w-full max-w-md px-6 py-16">
      {isResetMode ? (
        <>
          <h1 className="text-3xl font-bold">Reset password</h1>

          <p className="mt-2 text-white/60">
            Enter your account email and we&apos;ll send you a password reset
            link.
          </p>

          <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
            <div>
              <label className="text-sm text-white/70">Email</label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          {message && <p className="mt-5 text-sm text-white/70">{message}</p>}

          <button
            type="button"
            onClick={() => {
              setIsResetMode(false);
              setMessage("");
            }}
            className="mt-6 text-sm text-white/70 underline hover:text-white"
          >
            ← Back to login
          </button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Login</h1>

          <p className="mt-2 text-white/60">
            Sign in to continue tracking your study progress.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="text-sm text-white/70">Email</label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-white/70">Password</label>

                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(true);
                    setMessage("");
                  }}
                  className="text-xs text-white/60 underline hover:text-white"
                >
                  Forgot password?
                </button>
              </div>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>

          {message && <p className="mt-5 text-sm text-white/70">{message}</p>}

          <p className="mt-6 text-sm text-white/60">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-white underline">
              Sign up
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
