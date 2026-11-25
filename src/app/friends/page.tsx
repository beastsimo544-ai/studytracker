"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import UserAvatar from "@/components/user-avatar";
import { evaluateAchievements, type Achievement } from "@/lib/achievements";
import { notifyAvatarUpdated, resizeAvatarFile } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  user_id: string;
  username: string | null;
  avatar_url?: string | null;
  daily_goal_minutes?: number | null;
  studying_subject?: string | null;
  studying_started_at?: string | null;
};

type FriendshipRow = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

type SubjectSummary = {
  subject: string;
  seconds: number;
};

type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_self: boolean;
  today_seconds: number;
  week_seconds: number;
  current_streak: number;
  unlocked_badges: Achievement[];
  studying_subject: string | null;
  studying_started_at: string | null;
  today_subjects: SubjectSummary[];
  week_subjects: SubjectSummary[];
};

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;
const MAX_LIVE_SESSION_MS = 6 * 60 * 60 * 1000;

function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeCurrentStreak(sessionDates: string[]) {
  if (sessionDates.length === 0) return 0;

  const studiedKeys = new Set(
    sessionDates.map((iso) => toLocalDateKey(new Date(iso)))
  );

  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  if (!studiedKeys.has(toLocalDateKey(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  while (studiedKeys.has(toLocalDateKey(checkDate))) {
    streak += 1;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

function getTimeBoundaries() {
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  const day = now.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  return {
    todayStart,
    weekStart,
  };
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${safeSeconds}s`;
}

function formatLiveElapsed(startedAtIso: string, nowMs: number) {
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

export default function FriendsPage() {
  const router = useRouter();
  const { toast } = useNotifications();
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [hasProfileRow, setHasProfileRow] = useState(false);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(120);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [usernamesById, setUsernamesById] = useState<Record<string, string>>(
    {}
  );
  const [avatarsById, setAvatarsById] = useState<Record<string, string | null>>(
    {}
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"today" | "week">(
    "week"
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const loadFriendsData = useCallback(async (userId: string) => {
    const { todayStart, weekStart } = getTimeBoundaries();

    let myProfile: ProfileRow | null = null;

    const fullProfileRes = await supabase
      .from("profiles")
      .select(
        "user_id, username, avatar_url, daily_goal_minutes, studying_subject, studying_started_at"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (fullProfileRes.error) {
      if (
        fullProfileRes.error.message.includes("avatar_url") ||
        fullProfileRes.error.message.includes("studying_")
      ) {
        const midRes = await supabase
          .from("profiles")
          .select(
            "user_id, username, daily_goal_minutes, studying_subject, studying_started_at"
          )
          .eq("user_id", userId)
          .maybeSingle();

        if (!midRes.error) {
          myProfile = midRes.data as ProfileRow | null;
        } else {
          const basicProfileRes = await supabase
            .from("profiles")
            .select("user_id, username, daily_goal_minutes")
            .eq("user_id", userId)
            .maybeSingle();

          if (basicProfileRes.error) {
            if (
              basicProfileRes.error.message.includes("username") ||
              basicProfileRes.error.code === "42703"
            ) {
              setSetupRequired(true);
              setIsLoading(false);
              return;
            }
          } else {
            myProfile = basicProfileRes.data as ProfileRow | null;
          }
        }
      } else if (
        fullProfileRes.error.message.includes("username") ||
        fullProfileRes.error.code === "42703"
      ) {
        setSetupRequired(true);
        setIsLoading(false);
        return;
      } else {
        console.error("Profile fetch error:", fullProfileRes.error);
      }
    } else {
      myProfile = fullProfileRes.data as ProfileRow | null;
    }

    let resolvedMyUsername: string | null = null;
    let resolvedMyAvatar: string | null = null;

    if (myProfile) {
      setHasProfileRow(true);
      resolvedMyUsername = myProfile.username ?? null;
      resolvedMyAvatar = myProfile.avatar_url ?? null;
      setMyUsername(resolvedMyUsername);
      setMyAvatarUrl(resolvedMyAvatar);
      setUsernameInput(resolvedMyUsername ?? "");
      if (typeof myProfile.daily_goal_minutes === "number") {
        setDailyGoalMinutes(myProfile.daily_goal_minutes);
      }
    }

    const { data: friendshipRows, error: friendshipsError } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at")
      .order("created_at", { ascending: false });

    if (friendshipsError) {
      if (
        friendshipsError.code === "42P01" ||
        friendshipsError.code === "PGRST205" ||
        friendshipsError.message.includes("friendships")
      ) {
        setSetupRequired(true);
        setIsLoading(false);
        return;
      }
      console.error("Friendships fetch error:", friendshipsError);
    }

    const typedFriendships = (friendshipRows || []) as FriendshipRow[];
    setFriendships(typedFriendships);

    const otherUserIds = Array.from(
      new Set(
        typedFriendships.map((f) =>
          f.requester_id === userId ? f.addressee_id : f.requester_id
        )
      )
    );

    const usernameMap: Record<string, string> = {};
    const avatarMap: Record<string, string | null> = {
      [userId]: resolvedMyAvatar,
    };
    const liveStatusMap: Record<
      string,
      { subject: string | null; startedAt: string | null }
    > = {};

    if (myProfile) {
      liveStatusMap[userId] = {
        subject: myProfile.studying_subject ?? null,
        startedAt: myProfile.studying_started_at ?? null,
      };
    }

    if (otherUserIds.length > 0) {
      const fullRelatedRes = await supabase
        .from("profiles")
        .select(
          "user_id, username, avatar_url, studying_subject, studying_started_at"
        )
        .in("user_id", otherUserIds);

      let relatedProfiles: ProfileRow[] | null = null;

      if (fullRelatedRes.error) {
        const midRelatedRes = await supabase
          .from("profiles")
          .select("user_id, username, studying_subject, studying_started_at")
          .in("user_id", otherUserIds);

        if (!midRelatedRes.error) {
          relatedProfiles = (midRelatedRes.data || []) as ProfileRow[];
        } else {
          const basicRelatedRes = await supabase
            .from("profiles")
            .select("user_id, username")
            .in("user_id", otherUserIds);
          relatedProfiles = (basicRelatedRes.data || []) as ProfileRow[];
        }
      } else {
        relatedProfiles = (fullRelatedRes.data || []) as ProfileRow[];
      }

      relatedProfiles.forEach((p) => {
        if (p.username) {
          usernameMap[p.user_id] = p.username;
        }
        avatarMap[p.user_id] = p.avatar_url ?? null;
        liveStatusMap[p.user_id] = {
          subject: p.studying_subject ?? null,
          startedAt: p.studying_started_at ?? null,
        };
      });
    }

    setUsernamesById(usernameMap);
    setAvatarsById(avatarMap);

    const acceptedFriendIds = typedFriendships
      .filter((f) => f.status === "accepted")
      .map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );

    const circleIds = Array.from(new Set([userId, ...acceptedFriendIds]));

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("study_sessions")
      .select("user_id, subject, duration, created_at")
      .in("user_id", circleIds);

    if (sessionsError) {
      console.error("Leaderboard sessions error:", sessionsError);
    }

    const allSessions = sessionRows || [];
    const currentTimestamp = Date.now();

    const computedLeaderboard: LeaderboardEntry[] = circleIds.map(
      (memberId) => {
        const memberSessions = allSessions.filter(
          (s) => s.user_id === memberId
        );

        let todaySeconds = 0;
        let weekSeconds = 0;
        const todaySubjectSeconds: Record<string, number> = {};
        const weekSubjectSeconds: Record<string, number> = {};

        memberSessions.forEach((s) => {
          const created = new Date(s.created_at);
          const dur = Number(s.duration) || 0;

          if (created >= todayStart) {
            todaySeconds += dur;
            todaySubjectSeconds[s.subject] =
              (todaySubjectSeconds[s.subject] || 0) + dur;
          }
          if (created >= weekStart) {
            weekSeconds += dur;
            weekSubjectSeconds[s.subject] =
              (weekSubjectSeconds[s.subject] || 0) + dur;
          }
        });

        const todaySubjects: SubjectSummary[] = Object.entries(
          todaySubjectSeconds
        )
          .map(([subject, seconds]) => ({ subject, seconds }))
          .sort((a, b) => b.seconds - a.seconds)
          .slice(0, 3);

        const weekSubjects: SubjectSummary[] = Object.entries(
          weekSubjectSeconds
        )
          .map(([subject, seconds]) => ({ subject, seconds }))
          .sort((a, b) => b.seconds - a.seconds)
          .slice(0, 3);

        const currentStreak = computeCurrentStreak(
          memberSessions.map((s) => s.created_at)
        );

        const unlockedBadges = evaluateAchievements(memberSessions).filter(
          (b) => b.unlocked
        );

        const rawLive = liveStatusMap[memberId];
        let activeStudyingSubject: string | null = null;
        let activeStudyingStartedAt: string | null = null;

        if (rawLive?.subject && rawLive?.startedAt) {
          const startedMs = new Date(rawLive.startedAt).getTime();
          if (
            !Number.isNaN(startedMs) &&
            currentTimestamp - startedMs >= -60000 &&
            currentTimestamp - startedMs < MAX_LIVE_SESSION_MS
          ) {
            activeStudyingSubject = rawLive.subject;
            activeStudyingStartedAt = rawLive.startedAt;
          }
        }

        const displayUsername =
          memberId === userId
            ? resolvedMyUsername || "you"
            : usernameMap[memberId] || "student";

        return {
          user_id: memberId,
          username: displayUsername,
          avatar_url: avatarMap[memberId] ?? null,
          is_self: memberId === userId,
          today_seconds: todaySeconds,
          week_seconds: weekSeconds,
          current_streak: currentStreak,
          unlocked_badges: unlockedBadges,
          studying_subject: activeStudyingSubject,
          studying_started_at: activeStudyingStartedAt,
          today_subjects: todaySubjects,
          week_subjects: weekSubjects,
        };
      }
    );

    setLeaderboard(computedLeaderboard);
    setNowMs(currentTimestamp);
    setSetupRequired(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let activeUserId: string | null = null;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      activeUserId = user.id;
      setCurrentUserId(user.id);
      await loadFriendsData(user.id);
    };

    init();

    const pollInterval = setInterval(() => {
      if (activeUserId) {
        loadFriendsData(activeUserId);
      }
    }, 25000);

    const channel = supabase
      .channel("friends-live-profiles")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          if (activeUserId) {
            loadFriendsData(activeUserId);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [router, loadFriendsData]);

  const hasAnyoneStudyingLive = leaderboard.some((e) =>
    Boolean(e.studying_subject && e.studying_started_at)
  );

  useEffect(() => {
    if (!hasAnyoneStudyingLive) return;

    const tickInterval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [hasAnyoneStudyingLive]);

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || isSavingUsername) return;

    const cleaned = usernameInput.trim().replace(/^@+/, "");

    if (!USERNAME_REGEX.test(cleaned)) {
      setUsernameMessage(
        "Username must be 3–24 characters using letters, numbers, or underscores."
      );
      return;
    }

    setIsSavingUsername(true);
    setUsernameMessage("");

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: currentUserId,
        username: cleaned,
        daily_goal_minutes: dailyGoalMinutes,
      },
      { onConflict: "user_id" }
    );

    setIsSavingUsername(false);

    if (error) {
      if (error.code === "23505") {
        setUsernameMessage("That username is already taken. Try another one.");
      } else {
        setUsernameMessage(`Could not save username: ${error.message}`);
      }
      return;
    }

    setHasProfileRow(true);
    setMyUsername(cleaned);
    setUsernameInput(cleaned);
    setIsEditingUsername(false);
    setUsernameMessage("");
    toast.success("Username saved!", `@${cleaned}`);
    await loadFriendsData(currentUserId);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentUserId) return;

    try {
      setIsSavingAvatar(true);
      setUsernameMessage("Uploading photo...");
      const dataUrl = await resizeAvatarFile(file);

      const res = hasProfileRow
        ? await supabase
            .from("profiles")
            .update({ avatar_url: dataUrl })
            .eq("user_id", currentUserId)
        : await supabase.from("profiles").insert({
            user_id: currentUserId,
            avatar_url: dataUrl,
            daily_goal_minutes: dailyGoalMinutes,
          });

      setIsSavingAvatar(false);

      if (res.error) {
        if (res.error.message.includes("avatar_url")) {
          setUsernameMessage(
            "Run `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;` in Supabase SQL Editor first."
          );
        } else {
          setUsernameMessage(`Could not save photo: ${res.error.message}`);
        }
        return;
      }

      setHasProfileRow(true);
      setMyAvatarUrl(dataUrl);
      notifyAvatarUpdated(dataUrl);
      setUsernameMessage("");
      toast.success("Profile picture updated!");
      await loadFriendsData(currentUserId);
    } catch (err) {
      setIsSavingAvatar(false);
      setUsernameMessage(
        err instanceof Error ? err.message : "Could not process image."
      );
    }
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    const cleaned = searchQuery.trim().replace(/^@+/, "");
    if (!cleaned) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    const escaped = cleaned.replace(/[%_]/g, "\\$&");

    const fullSearch = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .not("username", "is", null)
      .neq("user_id", currentUserId)
      .ilike("username", `%${escaped}%`)
      .limit(8);

    if (fullSearch.error && fullSearch.error.message.includes("avatar_url")) {
      const fallbackSearch = await supabase
        .from("profiles")
        .select("user_id, username")
        .not("username", "is", null)
        .neq("user_id", currentUserId)
        .ilike("username", `%${escaped}%`)
        .limit(8);

      setIsSearching(false);

      if (fallbackSearch.error) {
        toast.error("Could not search usernames");
        return;
      }

      setSearchResults((fallbackSearch.data || []) as ProfileRow[]);
      return;
    }

    setIsSearching(false);

    if (fullSearch.error) {
      toast.error("Could not search usernames");
      return;
    }

    setSearchResults((fullSearch.data || []) as ProfileRow[]);
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!currentUserId) return;

    if (!myUsername) {
      toast.info(
        "Choose a @username first",
        "Set your @username above before sending friend requests."
      );
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        toast.info("Request already exists");
      } else {
        toast.error("Could not send friend request", error.message);
      }
      return;
    }

    toast.success("Friend request sent!");
    await loadFriendsData(currentUserId);
  };

  const acceptFriendRequest = async (friendshipId: number) => {
    if (!currentUserId) return;

    const { data, error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId)
      .select("id");

    if (error || !data || data.length === 0) {
      toast.error("Could not accept friend request");
      return;
    }

    toast.success("Friend added! 🎉");
    await loadFriendsData(currentUserId);
  };

  const removeFriendship = async (
    friendshipId: number,
    confirmMessage?: string
  ) => {
    if (!currentUserId) return;

    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    const { data, error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId)
      .select("id");

    if (error || !data || data.length === 0) {
      toast.error("Could not remove friend");
      return;
    }

    await loadFriendsData(currentUserId);
  };

  const incomingRequests = friendships.filter(
    (f) => f.status === "pending" && f.addressee_id === currentUserId
  );

  const outgoingRequests = friendships.filter(
    (f) => f.status === "pending" && f.requester_id === currentUserId
  );

  const findRelationship = (otherUserId: string) =>
    friendships.find(
      (f) =>
        (f.requester_id === currentUserId && f.addressee_id === otherUserId) ||
        (f.addressee_id === currentUserId && f.requester_id === otherUserId)
    );

  const sortedLeaderboard = [...leaderboard].sort((a, b) =>
    leaderboardPeriod === "today"
      ? b.today_seconds - a.today_seconds ||
        b.week_seconds - a.week_seconds ||
        a.username.localeCompare(b.username)
      : b.week_seconds - a.week_seconds ||
        b.today_seconds - a.today_seconds ||
        a.username.localeCompare(b.username)
  );

  const maxPeriodSeconds = Math.max(
    ...sortedLeaderboard.map((entry) =>
      leaderboardPeriod === "today" ? entry.today_seconds : entry.week_seconds
    ),
    1
  );

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
          <p className="text-sm text-white/55">Loading friends...</p>
        </div>
      </main>
    );
  }

  if (setupRequired) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Friends</h1>
        <div className="mt-5 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
          <h2 className="text-base font-semibold text-orange-300">
            One-time Supabase SQL setup required
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">
            Open your <strong>Supabase Dashboard → SQL Editor</strong>, paste
            the contents of <code>supabase-friends-setup.sql</code>, and click{" "}
            <strong>Run</strong>. Then refresh this page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Friends
        </h1>
        <p className="mt-0.5 text-xs text-white/55 sm:text-sm">
          See who is studying live and compare daily &amp; weekly progress.
        </p>
      </div>

      {/* YOUR PROFILE & USERNAME CARD */}
      <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:mt-7 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <UserAvatar
              avatarUrl={myAvatarUrl}
              name={myUsername || "you"}
              size="md"
            />

            <div>
              <p className="text-[11px] font-medium text-white/45">
                Your profile
              </p>
              {myUsername && !isEditingUsername ? (
                <p className="font-mono text-base font-bold sm:text-lg">
                  @{myUsername}
                </p>
              ) : (
                <p className="text-xs text-white/65">
                  Choose a unique @username so friends can find you.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />

            <button
              type="button"
              disabled={isSavingAvatar}
              onClick={() => avatarFileInputRef.current?.click()}
              className="h-9 rounded-xl border border-white/15 px-3 text-xs font-medium transition hover:bg-white/5 disabled:opacity-50"
            >
              {isSavingAvatar
                ? "Uploading..."
                : myAvatarUrl
                  ? "Change photo"
                  : "Add photo"}
            </button>

            {myUsername && !isEditingUsername && (
              <button
                type="button"
                onClick={() => {
                  setUsernameInput(myUsername);
                  setUsernameMessage("");
                  setIsEditingUsername(true);
                }}
                className="h-9 rounded-xl border border-white/15 px-3 text-xs font-medium transition hover:bg-white/5"
              >
                Edit @username
              </button>
            )}
          </div>
        </div>

        {(!myUsername || isEditingUsername) && (
          <form
            onSubmit={handleSaveUsername}
            className="mt-3.5 flex flex-col gap-2.5 sm:flex-row"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">
                @
              </span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="your_username"
                maxLength={24}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#09090b] pl-8 pr-3.5 text-sm outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSavingUsername}
                className="h-10 flex-1 rounded-xl bg-white px-5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50 sm:flex-none sm:text-sm"
              >
                {isSavingUsername ? "Saving..." : "Save"}
              </button>

              {myUsername && isEditingUsername && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUsername(false);
                    setUsernameMessage("");
                  }}
                  className="h-10 rounded-xl border border-white/10 px-3.5 text-xs text-white/70 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {usernameMessage && (
          <p className="mt-2.5 text-xs text-white/70">{usernameMessage}</p>
        )}
      </section>

      {/* INCOMING & OUTGOING REQUESTS */}
      {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
        <section className="mt-5 grid gap-4 sm:mt-6 md:grid-cols-2">
          {incomingRequests.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
              <h2 className="text-sm font-semibold sm:text-base">
                Friend requests ({incomingRequests.length})
              </h2>

              <div className="mt-3 space-y-2.5">
                {incomingRequests.map((req) => {
                  const senderName =
                    usernamesById[req.requester_id] || "student";

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          avatarUrl={avatarsById[req.requester_id]}
                          name={senderName}
                          size="xs"
                        />
                        <span className="truncate font-mono text-xs font-medium sm:text-sm">
                          @{senderName}
                        </span>
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => acceptFriendRequest(req.id)}
                          className="h-8 rounded-lg border border-emerald-500/25 bg-emerald-500/15 px-3 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25"
                        >
                          Accept
                        </button>

                        <button
                          onClick={() => removeFriendship(req.id)}
                          className="h-8 rounded-lg border border-white/10 px-2.5 text-xs text-white/60 transition hover:text-white"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {outgoingRequests.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
              <h2 className="text-sm font-semibold sm:text-base">
                Sent requests ({outgoingRequests.length})
              </h2>

              <div className="mt-3 space-y-2.5">
                {outgoingRequests.map((req) => {
                  const recipientName =
                    usernamesById[req.addressee_id] || "student";

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          avatarUrl={avatarsById[req.addressee_id]}
                          name={recipientName}
                          size="xs"
                        />
                        <span className="truncate font-mono text-xs text-white/80 sm:text-sm">
                          @{recipientName}
                        </span>
                      </div>

                      <button
                        onClick={() => removeFriendship(req.id)}
                        className="h-8 shrink-0 rounded-lg border border-white/10 px-3 text-xs text-white/60 transition hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* FIND FRIENDS BY USERNAME */}
      <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:mt-6 sm:p-5">
        <h2 className="text-sm font-semibold sm:text-base">Add a friend</h2>

        <form onSubmit={handleSearchUsers} className="mt-3 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search @username..."
            className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
          />

          <button
            type="submit"
            disabled={isSearching}
            className="h-10 shrink-0 rounded-xl bg-white px-5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50 sm:text-sm"
          >
            {isSearching ? "..." : "Search"}
          </button>
        </form>

        {hasSearched && (
          <div className="mt-3 space-y-2">
            {searchResults.length === 0 ? (
              <p className="py-1.5 text-xs text-white/50">
                No users found matching that username.
              </p>
            ) : (
              searchResults.map((profile) => {
                const relation = findRelationship(profile.user_id);

                return (
                  <div
                    key={profile.user_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar
                        avatarUrl={profile.avatar_url}
                        name={profile.username}
                        size="xs"
                      />
                      <span className="truncate font-mono text-xs font-medium sm:text-sm">
                        @{profile.username}
                      </span>
                    </div>

                    {!relation ? (
                      <button
                        onClick={() => sendFriendRequest(profile.user_id)}
                        className="h-8 shrink-0 rounded-lg bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-white/90"
                      >
                        Add Friend
                      </button>
                    ) : relation.status === "accepted" ? (
                      <span className="shrink-0 text-xs font-medium text-emerald-400">
                        Friends ✓
                      </span>
                    ) : relation.requester_id === currentUserId ? (
                      <span className="shrink-0 text-xs text-white/45">
                        Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => acceptFriendRequest(relation.id)}
                        className="h-8 shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/15 px-3 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25"
                      >
                        Accept
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* DAILY & WEEKLY LEADERBOARD */}
      <section className="mt-6 sm:mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold sm:text-lg">
              {leaderboardPeriod === "today"
                ? "Daily Leaderboard"
                : "Weekly Leaderboard"}
            </h2>
            <p className="mt-0.5 text-xs text-white/45">
              {leaderboardPeriod === "today"
                ? "Ranked by study time today"
                : "Resets Monday · Ranked by weekly hours"}
            </p>
          </div>

          <div className="inline-flex h-9 shrink-0 items-center rounded-xl border border-white/10 bg-[#111113] p-1">
            <button
              type="button"
              onClick={() => setLeaderboardPeriod("today")}
              className={`h-7 rounded-lg px-3 text-xs font-semibold transition ${
                leaderboardPeriod === "today"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardPeriod("week")}
              className={`h-7 rounded-lg px-3 text-xs font-semibold transition ${
                leaderboardPeriod === "week"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Weekly
            </button>
          </div>
        </div>

        <div className="mt-3.5 space-y-3">
          {sortedLeaderboard.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
              <p className="text-xs text-white/55 sm:text-sm">
                No study activity yet.
              </p>
            </div>
          ) : (
            sortedLeaderboard.map((entry, index) => {
              const rank = index + 1;
              const medal =
                rank === 1
                  ? "🥇"
                  : rank === 2
                    ? "🥈"
                    : rank === 3
                      ? "🥉"
                      : `#${rank}`;
              const activeSeconds =
                leaderboardPeriod === "today"
                  ? entry.today_seconds
                  : entry.week_seconds;
              const progressPercent =
                activeSeconds > 0
                  ? Math.max((activeSeconds / maxPeriodSeconds) * 100, 4)
                  : 0;
              const activeSubjects =
                leaderboardPeriod === "today"
                  ? entry.today_subjects
                  : entry.week_subjects;
              const relation = !entry.is_self
                ? findRelationship(entry.user_id)
                : undefined;
              const isStudyingNow = Boolean(
                entry.studying_subject && entry.studying_started_at
              );

              return (
                <div
                  key={entry.user_id}
                  className={`rounded-2xl border p-4 sm:p-5 ${
                    entry.is_self
                      ? "border-white/25 bg-[#151518]"
                      : "border-white/[0.08] bg-[#111113]"
                  }`}
                >
                  {/* Top Row: Identity + Desktop Stats + Remove */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-6 shrink-0 text-center text-base font-bold sm:text-lg">
                          {medal}
                        </span>

                        <UserAvatar
                          avatarUrl={entry.avatar_url}
                          name={entry.username}
                          size="sm"
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-mono text-sm font-bold sm:text-base">
                              @{entry.username}
                            </span>
                            {entry.is_self && (
                              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                                You
                              </span>
                            )}
                            {entry.current_streak > 0 && (
                              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-300 tabular-nums">
                                🔥 {entry.current_streak}d
                              </span>
                            )}
                            {entry.unlocked_badges.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[11px]">
                                {entry.unlocked_badges.map((b) => (
                                  <span
                                    key={b.id}
                                    title={`${b.title} — ${b.description}`}
                                  >
                                    {b.icon}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>

                          {isStudyingNow && entry.studying_started_at && (
                            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 tabular-nums">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              </span>
                              <span className="truncate">
                                Studying{" "}
                                <strong>{entry.studying_subject}</strong> ·{" "}
                                {formatLiveElapsed(
                                  entry.studying_started_at,
                                  nowMs
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {!entry.is_self && relation && (
                        <button
                          onClick={() =>
                            removeFriendship(
                              relation.id,
                              `Remove @${entry.username} from your friends?`
                            )
                          }
                          className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/45 transition hover:border-red-500/30 hover:text-red-400 sm:hidden"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Symmetrical 50/50 Grid on Mobile, Compact Pair on Desktop */}
                    <div className="flex items-center gap-2.5">
                      <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none">
                        <div
                          className={`rounded-xl border px-3 py-1.5 text-left sm:min-w-24 sm:text-right ${
                            leaderboardPeriod === "today"
                              ? "border-white/20 bg-white/[0.08]"
                              : "border-white/[0.07] bg-[#09090b]"
                          }`}
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
                            Today
                          </p>
                          <p className="font-mono text-sm font-bold tabular-nums sm:text-base">
                            {formatDuration(entry.today_seconds)}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl border px-3 py-1.5 text-left sm:min-w-24 sm:text-right ${
                            leaderboardPeriod === "week"
                              ? "border-white/20 bg-white/[0.08]"
                              : "border-white/[0.07] bg-[#09090b]"
                          }`}
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
                            This week
                          </p>
                          <p className="font-mono text-sm font-bold tabular-nums sm:text-base">
                            {formatDuration(entry.week_seconds)}
                          </p>
                        </div>
                      </div>

                      {!entry.is_self && relation && (
                        <button
                          onClick={() =>
                            removeFriendship(
                              relation.id,
                              `Remove @${entry.username} from your friends?`
                            )
                          }
                          className="hidden h-8 shrink-0 rounded-lg border border-white/10 px-2.5 text-xs text-white/45 transition hover:border-red-500/30 hover:text-red-400 sm:inline-flex sm:items-center"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Subjects studied */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {activeSubjects.length === 0 ? (
                      <span className="text-[11px] text-white/35">
                        {leaderboardPeriod === "today"
                          ? "No sessions logged today"
                          : "No sessions logged this week"}
                      </span>
                    ) : (
                      activeSubjects.map((item) => (
                        <span
                          key={item.subject}
                          className="rounded-lg border border-white/[0.08] bg-[#09090b] px-2 py-0.5 text-[11px] text-white/75 tabular-nums"
                        >
                          {item.subject} ·{" "}
                          <span className="font-semibold text-white">
                            {formatDuration(item.seconds)}
                          </span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {sortedLeaderboard.length === 1 && (
          <p className="mt-4 text-center text-xs text-white/45">
            Search for a friend&apos;s @username above to add them to your
            leaderboard!
          </p>
        )}
      </section>
    </main>
  );
}
