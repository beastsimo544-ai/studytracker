"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import UserAvatar from "@/components/user-avatar";
import { supabase } from "@/lib/supabase";

function formatRelativeTime(iso: string) {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("?");
  const [bellOpen, setBellOpen] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement | null>(null);

  const normalizedPath =
    pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";

  const isActive = (href: string) => normalizedPath === href;

  useEffect(() => {
    const loadProfileBadge = async (userId: string, email?: string) => {
      const res = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (res.error && res.error.message.includes("avatar_url")) {
        const fallback = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", userId)
          .maybeSingle();
        setDisplayName(fallback.data?.username || email || "?");
        setAvatarUrl(null);
      } else {
        setDisplayName(res.data?.username || email || "?");
        setAvatarUrl(res.data?.avatar_url ?? null);
      }
    };

    const checkUser = async () => {
      setIsNativeApp(Capacitor.isNativePlatform());
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(!!user);
      if (user) {
        await loadProfileBadge(user.id, user.email);
      } else {
        setAvatarUrl(null);
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setIsLoggedIn(!!user);
      if (user) {
        loadProfileBadge(user.id, user.email);
      } else {
        setAvatarUrl(null);
      }
    });

    const handleAvatarUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ avatarUrl: string | null }>;
      setAvatarUrl(custom.detail?.avatarUrl ?? null);
    };

    window.addEventListener("profile-avatar-updated", handleAvatarUpdated);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("profile-avatar-updated", handleAvatarUpdated);
    };
  }, []);

  useEffect(() => {
    if (!bellOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        bellContainerRef.current &&
        !bellContainerRef.current.contains(e.target as Node)
      ) {
        setBellOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [bellOpen]);

  const handleLogout = async () => {
    setBellOpen(false);
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

  const renderBellButton = () => (
    <button
      type="button"
      onClick={() => setBellOpen((prev) => !prev)}
      aria-label="Notifications"
      className="relative rounded-xl border border-white/15 p-2 text-white/80 transition hover:bg-white/5 hover:text-white"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-bold text-black">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <nav
          ref={bellContainerRef}
          className="relative mx-auto max-w-6xl px-6 py-3.5 md:py-4"
        >
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

              {!isNativeApp && (
                <Link
                  href="/download"
                  className={
                    isActive("/download")
                      ? "font-semibold text-white"
                      : "text-white/70 transition hover:text-white"
                  }
                >
                  Download
                </Link>
              )}

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

                  {renderBellButton()}

                  <Link
                    href="/settings"
                    className={`flex items-center gap-2 ${
                      isActive("/settings")
                        ? "font-semibold text-white"
                        : "text-white/70 transition hover:text-white"
                    }`}
                  >
                    <UserAvatar
                      avatarUrl={avatarUrl}
                      name={displayName}
                      size="xs"
                    />
                    <span>Settings</span>
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

            {/* Mobile top right actions (Get App + Bell + Avatar + Logout) */}
            <div className="flex items-center gap-2 md:hidden">
              {!isNativeApp && (
                <Link
                  href="/download"
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    isActive("/download")
                      ? "border-white/40 bg-white/15 text-white"
                      : "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  App
                </Link>
              )}

              {isLoggedIn && (
                <>
                  {renderBellButton()}

                  <Link
                    href="/settings"
                    aria-label="Account Settings"
                    className={`rounded-full p-0.5 transition ${
                      isActive("/settings") ? "ring-2 ring-white" : ""
                    }`}
                  >
                    <UserAvatar
                      avatarUrl={avatarUrl}
                      name={displayName}
                      size="xs"
                    />
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 active:bg-white/10"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notification Bell Dropdown */}
          {bellOpen && isLoggedIn && (
            <div className="absolute right-4 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-[#111111] shadow-2xl md:right-6">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="text-sm font-semibold">Notifications</span>

                <div className="flex items-center gap-3 text-xs">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-emerald-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="text-white/45 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-white/45">
                    No notifications right now.
                  </p>
                ) : (
                  notifications.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        markAsRead(item.id);
                        setBellOpen(false);
                      }}
                      className={`flex items-start gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/5 last:border-b-0 ${
                        item.read ? "opacity-70" : "bg-white/[0.03]"
                      }`}
                    >
                      <span className="mt-0.5 text-lg">{item.icon}</span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-white">
                            {item.title}
                          </p>
                          {!item.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-white/60">
                          {item.body}
                        </p>
                        <p className="mt-1 text-[10px] text-white/35">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              <div className="border-t border-white/10 bg-black/40 px-4 py-2.5 text-right">
                <Link
                  href="/settings"
                  onClick={() => setBellOpen(false)}
                  className="text-xs text-white/65 hover:text-white"
                >
                  Reminder & notification settings →
                </Link>
              </div>
            </div>
          )}
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
