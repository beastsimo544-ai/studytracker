"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import MonthlyStudyTrendChart from "@/components/monthly-study-trend-chart";
import { useNotifications } from "@/components/notification-provider";
import ProfileEffectOverlay, {
  ProfileEffectPill,
} from "@/components/profile-effect-overlay";
import ProfileEffectPicker from "@/components/profile-effect-picker";
import StudyHeatmap from "@/components/study-heatmap";
import StudyHoursByDayChart from "@/components/study-hours-by-day-chart";
import { useEffectsDisabled } from "@/components/use-effects-disabled";
import UserAvatar from "@/components/user-avatar";
import { evaluateAchievements } from "@/lib/achievements";
import {
  loadLocalProfileEffectBundle,
  parseProfileEffectBundle,
  resolveActiveProfileEffect,
  type ProfileEffectPreference,
} from "@/lib/profile-effects";
import { resolveSubjectColor } from "@/lib/subject-colors";
import { supabase } from "@/lib/supabase";

type TargetProfileRow = {
  user_id: string;
  username: string | null;
  avatar_url?: string | null;
  daily_goal_minutes?: number | null;
  studying_subject?: string | null;
  studying_started_at?: string | null;
  profile_effect?: string | null;
};

type StudySession = {
  id: number;
  subject: string;
  duration: number;
  created_at: string;
};

type FriendshipRow = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

const MAX_LIVE_SESSION_MS = 6 * 60 * 60 * 1000;

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
}

function formatCompact(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
}

function formatLiveElapsed(startedAtIso: string, nowMs: number): string {
  const startMs = new Date(startedAtIso).getTime();
  if (Number.isNaN(startMs)) return "";
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const hours = Math.floor(elapsedSec / 3600);
  const minutes = Math.floor((elapsedSec % 3600) / 60);
  const secs = elapsedSec % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m ${String(secs).padStart(2, "0")}s`;
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useNotifications();
  const effectsDisabled = useEffectsDisabled();

  const queryUsername = (searchParams.get("u") || "").trim().replace(/^@+/, "");
  const queryUserId = (searchParams.get("id") || "").trim();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<TargetProfileRow | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [colorBySubject, setColorBySubject] = useState<
    Record<string, string | null>
  >({});
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [effectPref, setEffectPref] = useState<ProfileEffectPreference>("auto");
  const [customGifUrl, setCustomGifUrl] = useState<string | null>(null);
  const [isEffectPickerOpen, setIsEffectPickerOpen] = useState(false);
  const [isGifLightboxOpen, setIsGifLightboxOpen] = useState(false);

  const [isFriend, setIsFriend] = useState(false);
  const [isGroupMate, setIsGroupMate] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<
    "incoming" | "outgoing" | null
  >(null);
  const [friendshipId, setFriendshipId] = useState<number | null>(null);
  const [isMutatingRelation, setIsMutatingRelation] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadProfileData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setViewerId(user.id);

    const resolveTargetRow = async (): Promise<TargetProfileRow | null> => {
      const selectAttempts = [
        "user_id, username, avatar_url, daily_goal_minutes, studying_subject, studying_started_at, profile_effect",
        "user_id, username, avatar_url, daily_goal_minutes, studying_subject, studying_started_at",
        "user_id, username, avatar_url, daily_goal_minutes",
        "user_id, username, daily_goal_minutes",
      ];

      for (const columns of selectAttempts) {
        let query = supabase.from("profiles").select(columns);
        if (queryUserId) {
          query = query.eq("user_id", queryUserId);
        } else if (queryUsername) {
          const escaped = queryUsername.replace(/[%_]/g, "\\$&");
          query = query.ilike("username", escaped);
        } else {
          query = query.eq("user_id", user.id);
        }

        const res = await query.maybeSingle();
        if (!res.error) {
          return (res.data as TargetProfileRow | null) ?? null;
        }
        if (res.error.code !== "42703" && !res.error.message.includes("column")) {
          break;
        }
      }

      return null;
    };

    const resolvedProfile = await resolveTargetRow();

    if (!resolvedProfile) {
      setProfile(null);
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setNotFound(false);
    setProfile(resolvedProfile);

    const targetIsSelf = resolvedProfile.user_id === user.id;
    const resolvedBundle = resolvedProfile.profile_effect
      ? parseProfileEffectBundle(resolvedProfile.profile_effect)
      : targetIsSelf
        ? loadLocalProfileEffectBundle()
        : { effectPref: "auto" as const, customGifUrl: null };
    setEffectPref(resolvedBundle.effectPref);
    setCustomGifUrl(resolvedBundle.customGifUrl);

    let nextIsFriend = false;
    let nextIsGroupMate = false;
    let nextPendingDirection: "incoming" | "outgoing" | null = null;
    let nextFriendshipId: number | null = null;

    if (!targetIsSelf) {
      const [friendRes, groupRes] = await Promise.all([
        supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status")
          .or(
            `and(requester_id.eq.${user.id},addressee_id.eq.${resolvedProfile.user_id}),and(requester_id.eq.${resolvedProfile.user_id},addressee_id.eq.${user.id})`
          )
          .maybeSingle(),
        supabase
          .from("study_group_members")
          .select("group_id, user_id")
          .in("user_id", [user.id, resolvedProfile.user_id]),
      ]);

      const rel = friendRes.data as FriendshipRow | null;
      if (rel) {
        nextFriendshipId = rel.id;
        if (rel.status === "accepted") {
          nextIsFriend = true;
        } else {
          nextPendingDirection =
            rel.requester_id === user.id ? "outgoing" : "incoming";
        }
      }

      if (!groupRes.error && Array.isArray(groupRes.data)) {
        const viewerGroups = new Set<number>();
        const targetGroups = new Set<number>();
        groupRes.data.forEach((row) => {
          if (row.user_id === user.id) viewerGroups.add(row.group_id);
          if (row.user_id === resolvedProfile.user_id) {
            targetGroups.add(row.group_id);
          }
        });
        nextIsGroupMate = Array.from(viewerGroups).some((gid) =>
          targetGroups.has(gid)
        );
      }
    }

    setIsFriend(nextIsFriend);
    setIsGroupMate(nextIsGroupMate);
    setPendingDirection(nextPendingDirection);
    setFriendshipId(nextFriendshipId);

    const allowedToView = targetIsSelf || nextIsFriend || nextIsGroupMate;
    if (allowedToView) {
      const [sessionsRes, subjectsRes] = await Promise.all([
        supabase
          .from("study_sessions")
          .select("id, subject, duration, created_at")
          .eq("user_id", resolvedProfile.user_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("subjects")
          .select("name, color")
          .eq("user_id", resolvedProfile.user_id)
          .order("created_at", { ascending: true }),
      ]);

      if (!sessionsRes.error && sessionsRes.data) {
        setSessions(sessionsRes.data as StudySession[]);
      } else {
        setSessions([]);
      }

      const colors: Record<string, string | null> = {};
      if (!subjectsRes.error && subjectsRes.data) {
        subjectsRes.data.forEach((row) => {
          colors[row.name] = row.color ?? null;
        });
      }
      setColorBySubject(colors);
    } else {
      setSessions([]);
      setColorBySubject({});
    }

    setNowMs(Date.now());
    setIsLoading(false);
  }, [queryUserId, queryUsername, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfileData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadProfileData]);

  const isSelf = Boolean(viewerId && profile && profile.user_id === viewerId);
  const canViewStats = isSelf || isFriend || isGroupMate;

  useEffect(() => {
    if (!isSelf) return;

    const handleEffectUpdated = (event: Event) => {
      const custom = event as CustomEvent<{
        preference?: ProfileEffectPreference;
        customGifUrl?: string | null;
      }>;
      if (custom.detail?.preference) {
        setEffectPref(custom.detail.preference);
      }
      if (custom.detail && "customGifUrl" in custom.detail) {
        setCustomGifUrl(custom.detail.customGifUrl ?? null);
      }
    };

    window.addEventListener("profile-effect-updated", handleEffectUpdated);
    return () =>
      window.removeEventListener("profile-effect-updated", handleEffectUpdated);
  }, [isSelf]);

  useEffect(() => {
    if (!isGifLightboxOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGifLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGifLightboxOpen]);

  const isStudyingNow = useMemo(() => {
    if (!profile?.studying_subject || !profile?.studying_started_at) {
      return false;
    }
    const startedMs = new Date(profile.studying_started_at).getTime();
    if (Number.isNaN(startedMs)) return false;
    return (
      nowMs - startedMs >= -60000 && nowMs - startedMs < MAX_LIVE_SESSION_MS
    );
  }, [profile, nowMs]);

  useEffect(() => {
    if (!isStudyingNow) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isStudyingNow]);

  const handleSendFriendRequest = async () => {
    if (!viewerId || !profile || isMutatingRelation) return;
    setIsMutatingRelation(true);
    const { error } = await supabase.from("friendships").insert({
      requester_id: viewerId,
      addressee_id: profile.user_id,
      status: "pending",
    });
    setIsMutatingRelation(false);

    if (error) {
      toast.error("Could not send friend request", error.message);
      return;
    }

    toast.success("Friend request sent");
    await loadProfileData();
  };

  const handleAcceptFriendRequest = async () => {
    if (!friendshipId || isMutatingRelation) return;
    setIsMutatingRelation(true);
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    setIsMutatingRelation(false);

    if (error) {
      toast.error("Could not accept friend request", error.message);
      return;
    }

    toast.success("Friend added");
    await loadProfileData();
  };

  const dailyGoalMinutes =
    typeof profile?.daily_goal_minutes === "number" &&
    profile.daily_goal_minutes > 0
      ? profile.daily_goal_minutes
      : 120;

  const achievements = useMemo(() => evaluateAchievements(sessions), [sessions]);
  const unlockedIds = useMemo(
    () => achievements.filter((a) => a.unlocked).map((a) => a.id),
    [achievements]
  );
  const unlockedCount = unlockedIds.length;

  const activeEffect = useMemo(
    () => resolveActiveProfileEffect(effectPref, unlockedIds),
    [effectPref, unlockedIds]
  );

  const statsSnapshot = useMemo(() => {
    const today = new Date(nowMs);
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    const day = today.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    startOfWeek.setDate(today.getDate() - daysSinceMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const todaySeconds = sessions
      .filter((session) => {
        const d = new Date(session.created_at);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      })
      .reduce((sum, s) => sum + s.duration, 0);

    const weekSeconds = sessions
      .filter((session) => {
        const d = new Date(session.created_at);
        return d >= startOfWeek && d <= endOfToday;
      })
      .reduce((sum, s) => sum + s.duration, 0);

    const monthSeconds = sessions
      .filter((session) => {
        const d = new Date(session.created_at);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth()
        );
      })
      .reduce((sum, s) => sum + s.duration, 0);

    const studiedDaysThisWeek = new Set(
      sessions
        .filter((session) => {
          const d = new Date(session.created_at);
          return d >= startOfWeek && d <= endOfToday;
        })
        .map((session) => {
          const d = new Date(session.created_at);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })
    ).size;

    const dailyAverageSeconds =
      studiedDaysThisWeek > 0
        ? Math.floor(weekSeconds / studiedDaysThisWeek)
        : 0;

    const studiedDays = Array.from(
      new Set(
        sessions.map((session) => {
          const d = new Date(session.created_at);
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        })
      )
    ).sort((a, b) => a - b);

    let longestStreak = 0;
    let runningStreak = 0;
    let previousDay: number | null = null;

    studiedDays.forEach((dayTs) => {
      if (
        previousDay !== null &&
        Math.round((dayTs - previousDay) / (24 * 60 * 60 * 1000)) === 1
      ) {
        runningStreak += 1;
      } else {
        runningStreak = 1;
      }
      longestStreak = Math.max(longestStreak, runningStreak);
      previousDay = dayTs;
    });

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let currentStreak = 0;
    let streakCheckDate = new Date(today);
    if (!studiedDays.includes(today.getTime())) {
      streakCheckDate = yesterday;
    }
    while (studiedDays.includes(streakCheckDate.getTime())) {
      currentStreak += 1;
      streakCheckDate.setDate(streakCheckDate.getDate() - 1);
    }

    const weekData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
      (dayLabel, index) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + index);

        const daySessions = sessions.filter((session) => {
          const d = new Date(session.created_at);
          return (
            d.getFullYear() === date.getFullYear() &&
            d.getMonth() === date.getMonth() &&
            d.getDate() === date.getDate()
          );
        });

        const totalSeconds = daySessions.reduce(
          (sum, s) => sum + s.duration,
          0
        );
        const perSubject: Record<string, number> = {};
        daySessions.forEach((s) => {
          perSubject[s.subject] = (perSubject[s.subject] || 0) + s.duration;
        });

        const segments = Object.entries(perSubject)
          .map(([subject, seconds]) => ({
            subject,
            seconds,
            color: resolveSubjectColor(subject, colorBySubject),
          }))
          .sort((a, b) => b.seconds - a.seconds);

        return {
          day: dayLabel,
          seconds: totalSeconds,
          segments,
        };
      }
    );

    const maxDaySeconds = Math.max(...weekData.map((d) => d.seconds), 1);

    return {
      todaySeconds,
      weekSeconds,
      monthSeconds,
      dailyAverageSeconds,
      currentStreak,
      longestStreak,
      weekData,
      maxDaySeconds,
    };
  }, [sessions, colorBySubject, nowMs]);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
  const firstDayIndex =
    firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
  const calendarStart = new Date(firstDayOfMonth);
  calendarStart.setDate(firstDayOfMonth.getDate() - firstDayIndex);

  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    const daySessions = sessions.filter((session) => {
      const d = new Date(session.created_at);
      return (
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
      );
    });

    const seconds = daySessions.reduce((sum, s) => sum + s.duration, 0);
    const topColor =
      daySessions.length > 0
        ? resolveSubjectColor(daySessions[0].subject, colorBySubject)
        : null;

    return {
      date,
      seconds,
      topColor,
      isCurrentMonth: date.getMonth() === calendarMonth,
    };
  });

  const calendarTitle = calendarDate.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
          <p className="text-sm text-white/55">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
          <h1 className="text-lg font-semibold text-white">Profile not found</h1>
          <p className="mt-1.5 text-sm text-white/55">
            This user profile could not be found or hasn&apos;t set a username
            yet.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/friends"
              className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90"
            >
              Back to Friends
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-xl border border-white/15 px-4 text-xs font-medium text-white/80 transition hover:text-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const displayName = profile.username || "student";
  const dailyGoalSeconds = dailyGoalMinutes * 60;
  const dailyGoalProgress =
    dailyGoalSeconds > 0
      ? Math.min((statsSnapshot.todaySeconds / dailyGoalSeconds) * 100, 100)
      : 0;

  const summaryCards = [
    { label: "Today", value: formatDuration(statsSnapshot.todaySeconds) },
    { label: "This week", value: formatDuration(statsSnapshot.weekSeconds) },
    { label: "This month", value: formatDuration(statsSnapshot.monthSeconds) },
    {
      label: "Daily avg",
      value: formatDuration(statsSnapshot.dailyAverageSeconds),
    },
    { label: "Current streak", value: `${statsSnapshot.currentStreak}d` },
    {
      label: "Longest streak",
      value: `${statsSnapshot.longestStreak} ${
        statsSnapshot.longestStreak === 1 ? "day" : "days"
      }`,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-10">
      {/* TOP GRID: COMPACT DISCORD PROFILE CARD (TOP-LEFT) + STATS & GOAL (TOP-RIGHT) */}
      <section className="grid gap-4 lg:grid-cols-[340px_1fr] lg:items-stretch">
        {/* LEFT COLUMN: COMPACT DISCORD-STYLE PROFILE CARD */}
        <div
          className={`relative flex flex-col overflow-hidden rounded-2xl border bg-[#111113] ${
            !effectsDisabled && activeEffect
              ? activeEffect.borderClass
              : "border-white/[0.08]"
          }`}
        >
          <ProfileEffectOverlay
            effectId={activeEffect?.id ?? null}
            intensity="normal"
          />

          {/* Compact Crisp Banner Background */}
          <div className="relative h-36 w-full shrink-0 overflow-hidden">
            {!effectsDisabled && customGifUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={customGifUrl}
                  alt={`@${displayName} profile banner`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setIsGifLightboxOpen(true)}
                  className="absolute right-3 top-3 z-20 inline-flex h-6 items-center gap-1 rounded-md border border-white/20 bg-black/65 px-2 text-[10px] font-medium text-white/90 backdrop-blur-md transition hover:border-white/40 hover:bg-black/80"
                >
                  <span>Expand</span>
                  <span aria-hidden="true">↗</span>
                </button>
              </>
            ) : (
              <div
                aria-hidden="true"
                className="h-full w-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%),linear-gradient(180deg,#18181b_0%,#111113_100%)]"
              />
            )}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111113] via-[#111113]/20 to-transparent"
            />
          </div>

          {/* Identity Cutout & Actions */}
          <div className="relative z-10 flex flex-1 flex-col justify-between px-5 pb-5">
            <div>
              <div className="-mt-10 relative inline-block w-fit rounded-full bg-[#111113] p-1 shadow-2xl">
                <UserAvatar
                  avatarUrl={profile.avatar_url}
                  name={displayName}
                  size="lg"
                  effectId={activeEffect?.id ?? null}
                  className="!h-[72px] !w-[72px] !text-xl"
                />
                <span
                  aria-hidden="true"
                  title={isStudyingNow ? "Currently studying" : "Offline / idle"}
                  className={`absolute bottom-1.5 right-1.5 z-20 h-3.5 w-3.5 rounded-full border-[3px] border-[#111113] ${
                    isStudyingNow ? "bg-emerald-400" : "bg-zinc-600"
                  }`}
                />
              </div>

              <div className="mt-2.5 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h1 className="truncate font-mono text-lg font-bold tracking-tight text-white">
                    @{displayName}
                  </h1>

                  {isSelf ? (
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                      You
                    </span>
                  ) : isFriend ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      Friend
                    </span>
                  ) : isGroupMate ? (
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                      Study Group
                    </span>
                  ) : null}

                  <ProfileEffectPill effectId={activeEffect?.id ?? null} />
                </div>

                {canViewStats && (
                  <p className="mt-1 text-xs text-white/55 tabular-nums">
                    {unlockedCount} / {achievements.length} achievements
                  </p>
                )}

                {isStudyingNow && profile.studying_started_at && (
                  <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 tabular-nums">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                    <span className="truncate">
                      Studying {profile.studying_subject} ·{" "}
                      {formatLiveElapsed(profile.studying_started_at, nowMs)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3.5">
              {isSelf ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEffectPickerOpen(true)}
                    className="h-8 flex-1 rounded-xl bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90"
                  >
                    Customize Profile
                  </button>
                  <Link
                    href="/settings"
                    className="inline-flex h-8 items-center rounded-xl border border-white/15 bg-[#09090b]/80 px-3 text-xs font-medium text-white/85 transition hover:border-white/30 hover:text-white"
                  >
                    Settings
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/friends"
                    className="inline-flex h-8 items-center rounded-xl border border-white/15 bg-[#09090b]/80 px-3 text-xs font-medium text-white/85 transition hover:border-white/30 hover:text-white"
                  >
                    Back to Friends
                  </Link>

                  {!isFriend && pendingDirection === null && (
                    <button
                      type="button"
                      disabled={isMutatingRelation}
                      onClick={handleSendFriendRequest}
                      className="h-8 flex-1 rounded-xl bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                    >
                      Add Friend
                    </button>
                  )}

                  {pendingDirection === "incoming" && (
                    <button
                      type="button"
                      disabled={isMutatingRelation}
                      onClick={handleAcceptFriendRequest}
                      className="h-8 flex-1 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      Accept Request
                    </button>
                  )}

                  {pendingDirection === "outgoing" && (
                    <span className="inline-flex h-8 flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 text-xs font-medium text-white/55">
                      Request Sent
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STUDY OVERVIEW & DAILY GOAL OR PRIVATE LOCKED STATE */}
        {canViewStats ? (
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
              {summaryCards.map((stat) => (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5"
                >
                  <p className="text-xs font-medium text-white/50">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
                    {stat.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="flex flex-1 flex-col justify-center rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-white/50">
                    Daily study goal
                  </p>
                  <p className="mt-1 text-lg font-bold tracking-tight tabular-nums sm:text-xl">
                    {formatDuration(statsSnapshot.todaySeconds)}{" "}
                    <span className="font-normal text-white/40">
                      / {formatDuration(dailyGoalSeconds)}
                    </span>
                  </p>
                </div>

                <span className="rounded-lg border border-white/10 bg-[#09090b] px-2.5 py-1 text-xs font-medium text-white/75 tabular-nums">
                  {Math.round(dailyGoalProgress)}% today
                </span>
              </div>

              <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${dailyGoalProgress}%` }}
                />
              </div>

              <p className="mt-1.5 text-xs text-white/45">
                {Math.round(dailyGoalProgress)}% complete today
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
            <h2 className="text-base font-semibold text-white">
              Private Study Analytics
            </h2>
            <p className="mt-1.5 max-w-md text-xs text-white/55 sm:text-sm">
              Add <span className="font-mono text-white/85">@{displayName}</span>{" "}
              as a friend (or join the same study group) to view their study
              totals, weekly chart, calendar, and consistency heatmap.
            </p>
          </div>
        )}
      </section>

      {canViewStats && (
        <>

          {/* WEEKLY CHART & STUDY CALENDAR */}
          <section className="mt-5 grid gap-5 sm:mt-6 lg:grid-cols-2">
            <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
              <div>
                <h2 className="text-base font-semibold sm:text-lg">
                  Study this week
                </h2>

                <div className="mt-4 flex h-40 items-end justify-between gap-1.5 sm:h-44 sm:gap-3">
                  {statsSnapshot.weekData.map(
                    ({ day: dayLabel, seconds, segments }) => {
                      const height =
                        (seconds / statsSnapshot.maxDaySeconds) * 100;

                      return (
                        <div
                          key={dayLabel}
                          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                        >
                          <p className="truncate text-[10px] text-white/65 tabular-nums sm:text-xs">
                            {seconds > 0 ? formatCompact(seconds) : "0m"}
                          </p>

                          {seconds > 0 ? (
                            <div
                              className="flex w-full max-w-7 flex-col overflow-hidden rounded-t-md sm:max-w-9"
                              style={{ height: `${Math.max(height, 6)}%` }}
                            >
                              {segments.map((seg) => (
                                <div
                                  key={seg.subject}
                                  title={`${seg.subject}: ${formatDuration(seg.seconds)}`}
                                  style={{
                                    height: `${(seg.seconds / seconds) * 100}%`,
                                    backgroundColor: seg.color,
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div
                              className="w-full max-w-7 rounded-t-md bg-white/12 sm:max-w-9"
                              style={{ height: "2px" }}
                            />
                          )}

                          <span className="text-[11px] text-white/45 sm:text-xs">
                            {dayLabel}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="mt-5 border-t border-white/[0.07] pt-4">
                <MonthlyStudyTrendChart sessions={sessions} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold sm:text-lg">
                  Study calendar
                </h2>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarDate(
                        new Date(calendarYear, calendarMonth - 1, 1)
                      )
                    }
                    aria-label="Previous month"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-xs hover:bg-white/5"
                  >
                    ←
                  </button>

                  <p className="min-w-24 text-center text-xs font-semibold sm:text-sm">
                    {calendarTitle}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setCalendarDate(
                        new Date(calendarYear, calendarMonth + 1, 1)
                      )
                    }
                    aria-label="Next month"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-xs hover:bg-white/5"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="grid grid-cols-7 text-center text-[10px] font-medium text-white/45 sm:text-xs">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="py-1.5">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-white/[0.08]">
                  {calendarDays.map(
                    ({ date, seconds, topColor, isCurrentMonth }) => (
                      <div
                        key={date.toISOString()}
                        className={`flex min-h-12 flex-col justify-between border-b border-r border-white/[0.07] p-1 sm:min-h-15 sm:p-1.5 ${
                          isCurrentMonth
                            ? "bg-[#09090b]/60"
                            : "bg-black/30 text-white/20"
                        }`}
                      >
                        <p className="text-[10px] font-medium tabular-nums sm:text-xs">
                          {date.getDate()}
                        </p>

                        {seconds > 0 && (
                          <div
                            className="truncate rounded px-1 py-0.5 text-center text-[9px] font-semibold leading-tight text-white tabular-nums sm:text-[10px]"
                            style={{
                              backgroundColor: `${topColor || "#10b981"}33`,
                            }}
                          >
                            {formatCompact(seconds)}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 52-WEEK CONSISTENCY HEATMAP */}
          <StudyHeatmap
            sessions={sessions}
            dailyGoalMinutes={dailyGoalMinutes}
          />

          {/* 24-HOUR STUDY DISTRIBUTION */}
          <StudyHoursByDayChart sessions={sessions} />
        </>
      )}

      {/* BANNER GIF LIGHTBOX MODAL */}
      {isGifLightboxOpen && customGifUrl && !effectsDisabled && (
        <div
          onClick={() => setIsGifLightboxOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`@${displayName} profile banner GIF`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#111113] shadow-2xl"
          >
            <div className="bg-[#09090b] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={customGifUrl}
                alt={`@${displayName} full profile banner`}
                className="mx-auto max-h-[75vh] w-full rounded-xl object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/65">
                <span className="font-mono font-semibold text-white">
                  @{displayName}
                </span>
                <span>·</span>
                <span>Profile Banner GIF</span>
              </div>

              <button
                type="button"
                onClick={() => setIsGifLightboxOpen(false)}
                className="h-8 rounded-lg border border-white/15 px-3 text-xs font-medium text-white/80 transition hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isSelf && (
        <ProfileEffectPicker
          mode="modal"
          open={isEffectPickerOpen}
          onClose={() => setIsEffectPickerOpen(false)}
          userId={viewerId}
          username={displayName}
          avatarUrl={profile.avatar_url ?? null}
          achievements={achievements}
          preference={effectPref}
          customGifUrl={customGifUrl}
          onBundleChange={(nextBundle) => {
            setEffectPref(nextBundle.effectPref);
            setCustomGifUrl(nextBundle.customGifUrl);
          }}
        />
      )}
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
            <p className="text-sm text-white/55">Loading profile...</p>
          </div>
        </main>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
