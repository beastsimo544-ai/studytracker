"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage("Creating account...");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created! Check your email to confirm your account.");
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
        <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>

        <p className="mt-1.5 text-xs text-white/55 sm:text-sm">
          Sign up to save your study sessions and build streaks.
        </p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-white/70">Email</label>

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
            <label className="text-xs font-medium text-white/70">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-xs text-white/75 sm:text-sm">{message}</p>
        )}

        <p className="mt-5 text-center text-xs text-white/55 sm:text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-white hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
