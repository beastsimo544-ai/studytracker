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

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
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
          <label className="text-sm text-white/70">Password</label>

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

      {message && (
        <p className="mt-5 text-sm text-white/70">
          {message}
        </p>
      )}

      <p className="mt-6 text-sm text-white/60">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-white underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}