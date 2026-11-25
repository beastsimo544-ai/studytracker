"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MobileAppEntry({
  webFallback,
}: {
  webFallback: React.ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"web" | "checking" | "native-guest">("web");

  useEffect(() => {
    const checkNativeStartup = async () => {
      await Promise.resolve();
      if (!Capacitor.isNativePlatform()) return;

      setMode("checking");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace("/dashboard");
        return;
      }

      setMode("native-guest");
    };

    checkNativeStartup();
  }, [router]);

  if (mode === "checking") {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
      </main>
    );
  }

  if (mode === "native-guest") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-5 py-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/playstore-icon-512.png"
          alt="StudyTracker"
          className="h-20 w-20 rounded-2xl border border-white/12 shadow-xl"
        />

        <h1 className="mt-5 text-2xl font-bold tracking-tight">StudyTracker</h1>
        <p className="mt-2 text-xs leading-relaxed text-white/60">
          Track study hours, build daily streaks, and stay focused together with
          friends.
        </p>

        <div className="mt-7 flex w-full flex-col gap-2.5">
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black transition active:scale-[0.99]"
          >
            Sign In
          </Link>

          <Link
            href="/register"
            className="flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-[#111113] text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            Create Account
          </Link>

          <Link
            href="/timer"
            className="mt-1 py-2 text-xs font-medium text-white/55 hover:text-white"
          >
            Try study timer as guest →
          </Link>
        </div>
      </main>
    );
  }

  return <>{webFallback}</>;
}
