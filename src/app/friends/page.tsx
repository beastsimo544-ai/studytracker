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

  const streakWindowStart = new Date(todayStart);
  streakWindowStart.setDate(todayStart.getDate() - 120);

  return {
    todayStart,
    weekStart,
    streakWindowStart,
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

    // 1. Load current user's profile with graceful column fallbacks
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

    // 2. Load friendships (incoming, outgoing, accepted)
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

    // Fetch usernames + avatars + live status for everyone involved in friendships
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

    // 3. Build daily/weekly leaderboard + streaks for you + accepted friends
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
    setUsernameMessage("Username saved!");
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
      setUsernameMessage("Profile picture updated!");
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
        console.error("User search error:", fallbackSearch.error);
        alert("Could not search usernames.");
        return;
      }

      setSearchResults((fallbackSearch.data || []) as ProfileRow[]);
      return;
    }

    setIsSearching(false);

    if (fullSearch.error) {
      console.error("User search error:", fullSearch.error);
      alert("Could not search usernames.");
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
      alert("Could not remove friend request.");
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
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">Loading friends...</p>
        </div>
      </main>
    );
  }

  if (setupRequired) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-bold">Friends</h1>
        <div className="mt-6 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-6">
          <h2 className="text-lg font-semibold text-orange-300">
            One-time Supabase SQL setup required
          </h2>
          <p className="mt-2 text-sm text-white/80">
            To enable usernames, friend requests, and the study leaderboard,
            open your <strong>Supabase Dashboard → SQL Editor</strong>, paste
            the contents of <code>supabase-friends-setup.sql</code> from your
            project folder, and click <strong>Run</strong>. Then refresh this
            page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Friends</h1>
        <p className="mt-2 text-white/60">
          Add friends by username, see who is studying live, and compare daily
          and weekly progress.
        </p>
      </div>

      {/* YOUR PROFILE & USERNAME CARD */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar
              avatarUrl={myAvatarUrl}
              name={myUsername || "you"}
              size="lg"
            />

            <div>
              <p className="text-sm text-white/50">Your profile</p>
              {myUsername && !isEditingUsername ? (
                <p className="mt-0.5 font-mono text-xl font-bold">
                  @{myUsername}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-white/70">
                  Choose a unique @username so friends can find and add you.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              className="rounded-lg border border-white/20 px-4 py-2 text-sm transition hover:bg-white/5 disabled:opacity-50"
            >
              {isSavingAvatar
                ? "Uploading..."
                : myAvatarUrl
                  ? "Change photo"
                  : "Upload photo"}
            </button>

            {myUsername && !isEditingUsername && (
              <button
                type="button"
                onClick={() => {
                  setUsernameInput(myUsername);
                  setUsernameMessage("");
                  setIsEditingUsername(true);
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm transition hover:bg-white/5"
              >
                Change username
              </button>
            )}
          </div>
        </div>

        {(!myUsername || isEditingUsername) && (
          <form
            onSubmit={handleSaveUsername}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                @
              </span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="your_username"
                maxLength={24}
                className="w-full rounded-xl border border-white/10 bg-black py-3 pl-9 pr-4 outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSavingUsername}
                className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {isSavingUsername ? "Saving..." : "Save Username"}
              </button>

              {myUsername && isEditingUsername && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUsername(false);
                    setUsernameMessage("");
                  }}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {usernameMessage && (
          <p className="mt-3 text-sm text-white/70">{usernameMessage}</p>
        )}
      </section>

      {/* INCOMING & OUTGOING REQUESTS */}
      {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          {incomingRequests.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold">
                Friend requests ({incomingRequests.length})
              </h2>

              <div className="mt-4 space-y-3">
                {incomingRequests.map((req) => {
                  const senderName =
                    usernamesById[req.requester_id] || "student";

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          avatarUrl={avatarsById[req.requester_id]}
                          name={senderName}
                          size="sm"
                        />
                        <span className="font-mono font-medium">
                          @{senderName}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptFriendRequest(req.id)}
                          className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-sm text-green-400 transition hover:bg-green-500/20"
                        >
                          Accept
                        </button>

                        <button
                          onClick={() => removeFriendship(req.id)}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:text-white"
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold">
                Sent requests ({outgoingRequests.length})
              </h2>

              <div className="mt-4 space-y-3">
                {outgoingRequests.map((req) => {
                  const recipientName =
                    usernamesById[req.addressee_id] || "student";

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          avatarUrl={avatarsById[req.addressee_id]}
                          name={recipientName}
                          size="sm"
                        />
                        <span className="font-mono text-white/80">
                          @{recipientName}
                        </span>
                      </div>

                      <button
                        onClick={() => removeFriendship(req.id)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:text-white"
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
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Add a friend</h2>
        <p className="mt-1 text-sm text-white/50">
          Search by @username to send a friend request.
        </p>

        <form
          onSubmit={handleSearchUsers}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search @username..."
            className="flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 outline-none"
          />

          <button
            type="submit"
            disabled={isSearching}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>

        {hasSearched && (
          <div className="mt-4 space-y-2">
            {searchResults.length === 0 ? (
              <p className="py-2 text-sm text-white/50">
                No users found matching that username.
              </p>
            ) : (
              searchResults.map((profile) => {
                const relation = findRelationship(profile.user_id);

                return (
                  <div
                    key={profile.user_id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        avatarUrl={profile.avatar_url}
                        name={profile.username}
                        size="sm"
                      />
                      <span className="font-mono font-medium">
                        @{profile.username}
                      </span>
                    </div>

                    {!relation ? (
                      <button
                        onClick={() => sendFriendRequest(profile.user_id)}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                      >
                        Add Friend
                      </button>
                    ) : relation.status === "accepted" ? (
                      <span className="text-sm text-green-400">Friends ✓</span>
                    ) : relation.requester_id === currentUserId ? (
                      <span className="text-sm text-white/50">
                        Request sent
                      </span>
                    ) : (
                      <button
                        onClick={() => acceptFriendRequest(relation.id)}
                        className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm text-green-400 transition hover:bg-green-500/20"
                      >
                        Accept Request
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
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {leaderboardPeriod === "today"
                ? "Daily Leaderboard"
                : "Weekly Leaderboard"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {leaderboardPeriod === "today"
                ? "Ranked by study time today"
                : "Resets every Monday · Ranked by study time this week"}
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setLeaderboardPeriod("today")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                leaderboardPeriod === "today"
                  ? "bg-white text-black"
                  : "text-white/65 hover:text-white"
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardPeriod("week")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                leaderboardPeriod === "week"
                  ? "bg-white text-black"
                  : "text-white/65 hover:text-white"
              }`}
            >
              Weekly
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sortedLeaderboard.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-white/60">No study activity yet.</p>
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
                  className={`rounded-2xl border p-5 ${
                    entry.is_self
                      ? "border-white/30 bg-white/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="w-7 text-center text-xl font-bold">
                        {medal}
                      </span>

                      <UserAvatar
                        avatarUrl={entry.avatar_url}
                        name={entry.username}
                        size="md"
                      />

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-lg font-bold">
                            @{entry.username}
                          </span>
                          {entry.is_self && (
                            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90">
                              You
                            </span>
                          )}
                          {entry.current_streak > 0 && (
                            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-300">
                              🔥 {entry.current_streak}d
                            </span>
                          )}
                          {entry.unlocked_badges.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs">
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
                          <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                            </span>
                            <span>
                              Studying <strong>{entry.studying_subject}</strong>{" "}
                              ·{" "}
                              {formatLiveElapsed(
                                entry.studying_started_at,
                                nowMs
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                      <div
                        className={`rounded-xl border px-3.5 py-2 text-right transition ${
                          leaderboardPeriod === "today"
                            ? "border-white/25 bg-white/10"
                            : "border-white/10 bg-black/30"
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-white/50">
                          Today
                        </p>
                        <p className="font-mono text-lg font-bold sm:text-xl">
                          {formatDuration(entry.today_seconds)}
                        </p>
                      </div>

                      <div
                        className={`rounded-xl border px-3.5 py-2 text-right transition ${
                          leaderboardPeriod === "week"
                            ? "border-white/25 bg-white/10"
                            : "border-white/10 bg-black/30"
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-white/50">
                          This week
                        </p>
                        <p className="font-mono text-lg font-bold sm:text-xl">
                          {formatDuration(entry.week_seconds)}
                        </p>
                      </div>

                      {!entry.is_self && relation && (
                        <button
                          onClick={() =>
                            removeFriendship(
                              relation.id,
                              `Remove @${entry.username} from your friends?`
                            )
                          }
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-red-500/30 hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {activeSubjects.length === 0 ? (
                      <span className="text-xs text-white/40">
                        {leaderboardPeriod === "today"
                          ? "No sessions logged yet today"
                          : "No sessions logged yet this week"}
                      </span>
                    ) : (
                      activeSubjects.map((item) => (
                        <span
                          key={item.subject}
                          className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white/80"
                        >
                          {item.subject} ·{" "}
                          <span className="font-semibold">
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
          <p className="mt-4 text-center text-sm text-white/50">
            Search for a friend&apos;s @username above to add them to your
            leaderboard!
          </p>
        )}
      </section>
    </main>
  );
}
