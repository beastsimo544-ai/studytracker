"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(!!user);
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
  <header className="border-b border-white/10">
    <nav className="mx-auto max-w-6xl px-6 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          StudyTracker
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-6 md:flex">
          {isLoggedIn && (
            <Link href="/dashboard">Dashboard</Link>
          )}

          <Link href="/timer">Timer</Link>

          {isLoggedIn && (
            <>
              <Link href="/subject">Subjects</Link>
              <Link href="/history">History</Link>
            </>
          )}

          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/20 px-4 py-2"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-white/20 px-4 py-2"
              >
                Login
              </Link>

              <Link
                href="/register"
                className="rounded-lg bg-white px-4 py-2 text-black"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile button */}
        <button
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-lg border border-white/20 px-3 py-2 md:hidden"
        >
          {isOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile navigation */}
      {isOpen && (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 md:hidden">
          {isLoggedIn && (
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
            >
              Dashboard
            </Link>
          )}

          <Link
            href="/timer"
            onClick={() => setIsOpen(false)}
          >
            Timer
          </Link>

          {isLoggedIn && (
            <>
              <Link
                href="/subject"
                onClick={() => setIsOpen(false)}
              >
                Subjects
              </Link>

              <Link
                href="/history"
                onClick={() => setIsOpen(false)}
              >
                History
              </Link>
            </>
          )}

          {isLoggedIn ? (
            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="rounded-lg border border-white/20 px-4 py-2 text-left"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-center"
              >
                Login
              </Link>

              <Link
                href="/register"
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-white px-4 py-2 text-center text-black"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  </header>
);
}