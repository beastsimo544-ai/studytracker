"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  user_id: string;
  username: string | null;
  daily_goal_minutes?: number | null;
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
  is_self: boolean;
  today_seconds: number;
  week_seconds: number;
  top_subjects: SubjectSummary[];
};

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

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
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
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

export default function FriendsPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(120);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [usernamesById, setUsernamesById] = useState<Record<string, string>>(
    {}
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const loadFriendsData = useCallback(async (userId: string) => {
    const { todayStart, weekStart } = getTimeBoundaries();

    // 1. Load current user's profile
    const { data: myProfile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, username, daily_goal_minutes")
      .eq("user_id", userId)
      .maybeSingle();

    let resolvedMyUsername: string | null = null;

    if (profileError) {
      if (
        profileError.message.includes("username") ||
        profileError.code === "42703"
      ) {
        setSetupRequired(true);
        setIsLoading(false);
        return;
      }
      console.error("Profile fetch error:", profileError);
    } else if (myProfile) {
      resolvedMyUsername = myProfile.username ?? null;
      setMyUsername(resolvedMyUsername);
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

    // Fetch usernames for everyone involved in friendships
    const otherUserIds = Array.from(
      new Set(
        typedFriendships.map((f) =>
          f.requester_id === userId ? f.addressee_id : f.requester_id
        )
      )
    );

    const usernameMap: Record<string, string> = {};

    if (otherUserIds.length > 0) {
      const { data: relatedProfiles } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", otherUserIds);

      if (relatedProfiles) {
        relatedProfiles.forEach((p) => {
          if (p.username) {
            usernameMap[p.user_id] = p.username;
          }
        });
      }
    }

    setUsernamesById(usernameMap);

    // 3. Build weekly leaderboard for you + accepted friends
    const acceptedFriendIds = typedFriendships
      .filter((f) => f.status === "accepted")
      .map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );

    const circleIds = Array.from(new Set([userId, ...acceptedFriendIds]));
    const earliestDate = todayStart < weekStart ? todayStart : weekStart;

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("study_sessions")
      .select("user_id, subject, duration, created_at")
      .in("user_id", circleIds)
      .gte("created_at", earliestDate.toISOString());

    if (sessionsError) {
      console.error("Leaderboard sessions error:", sessionsError);
    }

    const allSessions = sessionRows || [];

    const computedLeaderboard: LeaderboardEntry[] = circleIds
      .map((memberId) => {
        const memberSessions = allSessions.filter(
          (s) => s.user_id === memberId
        );

        let todaySeconds = 0;
        let weekSeconds = 0;
        const subjectSeconds: Record<string, number> = {};

        memberSessions.forEach((s) => {
          const created = new Date(s.created_at);
          const dur = Number(s.duration) || 0;

          if (created >= todayStart) {
            todaySeconds += dur;
          }
          if (created >= weekStart) {
            weekSeconds += dur;
            subjectSeconds[s.subject] =
              (subjectSeconds[s.subject] || 0) + dur;
          }
        });

        const topSubjects: SubjectSummary[] = Object.entries(subjectSeconds)
          .map(([subject, seconds]) => ({ subject, seconds }))
          .sort((a, b) => b.seconds - a.seconds)
          .slice(0, 3);

        const displayUsername =
          memberId === userId
            ? resolvedMyUsername || "you"
            : usernameMap[memberId] || "student";

        return {
          user_id: memberId,
          username: displayUsername,
          is_self: memberId === userId,
          today_seconds: todaySeconds,
          week_seconds: weekSeconds,
          top_subjects: topSubjects,
        };
      })
      .sort(
        (a, b) =>
          b.week_seconds - a.week_seconds ||
          b.today_seconds - a.today_seconds ||
          a.username.localeCompare(b.username)
      );

    setLeaderboard(computedLeaderboard);
    setSetupRequired(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);
      await loadFriendsData(user.id);
    };

    init();
  }, [router, loadFriendsData]);

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

    setMyUsername(cleaned);
    setUsernameInput(cleaned);
    setIsEditingUsername(false);
    setUsernameMessage("Username saved!");
    await loadFriendsData(currentUserId);
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

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username")
      .not("username", "is", null)
      .neq("user_id", currentUserId)
      .ilike("username", `%${escaped}%`)
      .limit(8);

    setIsSearching(false);

    if (error) {
      console.error("User search error:", error);
      alert("Could not search usernames.");
      return;
    }

    setSearchResults((data || []) as ProfileRow[]);
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!currentUserId) return;

    if (!myUsername) {
      alert("Please set your @username above before sending friend requests.");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        alert("A friend request already exists between you and this user.");
      } else {
        alert(`Could not send friend request: ${error.message}`);
      }
      return;
    }

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
      alert("Could not accept friend request.");
      return;
    }

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

  const maxWeekSeconds = Math.max(
    ...leaderboard.map((entry) => entry.week_seconds),
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
            To enable usernames, friend requests, and the weekly study
            leaderboard, open your{" "}
            <strong>Supabase Dashboard → SQL Editor</strong>, paste the contents
            of <code>supabase-friends-setup.sql</code> from your project folder,
            and click <strong>Run</strong>. Then refresh this page.
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
          Add friends by username and see what and how much everyone is studying
          this week.
        </p>
      </div>

      {/* YOUR USERNAME CARD */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/50">Your username</p>
            {myUsername && !isEditingUsername ? (
              <p className="mt-1 font-mono text-xl font-bold">@{myUsername}</p>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                Choose a unique @username so friends can find and add you.
              </p>
            )}
          </div>

          {myUsername && !isEditingUsername && (
            <button
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
                      <span className="font-mono font-medium">
                        @{senderName}
                      </span>

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
                      <span className="font-mono text-white/80">
                        @{recipientName}
                      </span>

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
                    <span className="font-mono font-medium">
                      @{profile.username}
                    </span>

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

      {/* WEEKLY LEADERBOARD & STUDY BREAKDOWN */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Weekly Leaderboard</h2>
          <p className="text-sm text-white/50">
            Resets every Monday · Ranked by study time this week
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-white/60">No study activity yet.</p>
            </div>
          ) : (
            leaderboard.map((entry, index) => {
              const rank = index + 1;
              const medal =
                rank === 1
                  ? "🥇"
                  : rank === 2
                    ? "🥈"
                    : rank === 3
                      ? "🥉"
                      : `#${rank}`;
              const progressPercent =
                entry.week_seconds > 0
                  ? Math.max((entry.week_seconds / maxWeekSeconds) * 100, 4)
                  : 0;
              const relation = !entry.is_self
                ? findRelationship(entry.user_id)
                : undefined;

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
                    <div className="flex items-center gap-4">
                      <span className="w-8 text-center text-xl font-bold">
                        {medal}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold">
                            @{entry.username}
                          </span>
                          {entry.is_self && (
                            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90">
                              You
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-white/50">
                          Today:{" "}
                          <span className="font-semibold text-white/80">
                            {formatDuration(entry.today_seconds)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-white/50">This week</p>
                        <p className="font-mono text-xl font-bold">
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

                  {/* Relative progress bar */}
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Subjects studied this week */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {entry.top_subjects.length === 0 ? (
                      <span className="text-xs text-white/40">
                        No sessions logged yet this week
                      </span>
                    ) : (
                      entry.top_subjects.map((item) => (
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

        {leaderboard.length === 1 && (
          <p className="mt-4 text-center text-sm text-white/50">
            Search for a friend&apos;s @username above to add them to your
            weekly leaderboard!
          </p>
        )}
      </section>
    </main>
  );
}
