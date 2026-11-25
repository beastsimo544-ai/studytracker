"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const normalizedPath =
    pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";

  const isActive = (href: string) => normalizedPath === href;

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
    router.push("/login");
    router.refresh();
  };

  const mobileTabs = isLoggedIn
    ? [
        {
          href: "/dashboard",
          label: "Home",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          ),
        },
        {
          href: "/timer",
          label: "Timer",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5" />
              <path d="M10 2h4" />
            </svg>
          ),
        },
        {
          href: "/subject",
          label: "Subjects",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          ),
        },
        {
          href: "/history",
          label: "History",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
          ),
        },
        {
          href: "/friends",
          label: "Friends",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
      ]
    : [
        {
          href: "/timer",
          label: "Timer",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5" />
              <path d="M10 2h4" />
            </svg>
          ),
        },
        {
          href: "/login",
          label: "Login",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          ),
        },
        {
          href: "/register",
          label: "Sign Up",
          icon: (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          ),
        },
      ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <nav className="mx-auto max-w-6xl px-6 py-3.5 md:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">
              StudyTracker
            </Link>

            {/* Desktop navigation */}
            <div className="hidden items-center gap-6 md:flex">
              {isLoggedIn && (
                <Link
                  href="/dashboard"
                  className={
                    isActive("/dashboard")
                      ? "font-semibold text-white"
                      : "text-white/70 transition hover:text-white"
                  }
                >
                  Dashboard
                </Link>
              )}

              <Link
                href="/timer"
                className={
                  isActive("/timer")
                    ? "font-semibold text-white"
                    : "text-white/70 transition hover:text-white"
                }
              >
                Timer
              </Link>

              {isLoggedIn && (
                <>
                  <Link
                    href="/subject"
                    className={
                      isActive("/subject")
                        ? "font-semibold text-white"
                        : "text-white/70 transition hover:text-white"
                    }
                  >
                    Subjects
                  </Link>
                  <Link
                    href="/history"
                    className={
                      isActive("/history")
                        ? "font-semibold text-white"
                        : "text-white/70 transition hover:text-white"
                    }
                  >
                    History
                  </Link>
                  <Link
                    href="/friends"
                    className={
                      isActive("/friends")
                        ? "font-semibold text-white"
                        : "text-white/70 transition hover:text-white"
                    }
                  >
                    Friends
                  </Link>
                </>
              )}

              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-white/20 px-4 py-2 transition hover:bg-white/5"
                >
                  Logout
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-lg border border-white/20 px-4 py-2 transition hover:bg-white/5"
                  >
                    Login
                  </Link>

                  <Link
                    href="/register"
                    className="rounded-lg bg-white px-4 py-2 font-medium text-black transition hover:bg-white/90"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile top right action (Logout when signed in) */}
            <div className="flex items-center md:hidden">
              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 active:bg-white/10"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* App-style Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0a0a0a]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {mobileTabs.map((tab) => {
            const active = isActive(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition ${
                  active ? "text-white" : "text-white/45 hover:text-white/75"
                }`}
              >
                <span
                  className={`rounded-full px-3 py-0.5 transition ${
                    active ? "bg-white/15" : ""
                  }`}
                >
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
