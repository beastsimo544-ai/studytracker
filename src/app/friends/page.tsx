"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import ChampionQuoteBanner from "@/components/champion-quote-banner";
import { useNotifications } from "@/components/notification-provider";
import ProfileEffectOverlay, {
  ProfileEffectPill,
} from "@/components/profile-effect-overlay";
import ProfileEffectPicker from "@/components/profile-effect-picker";
import { useEffectsDisabled } from "@/components/use-effects-disabled";
import UserAvatar from "@/components/user-avatar";
import { evaluateAchievements, type Achievement } from "@/lib/achievements";
import { notifyAvatarUpdated, resizeAvatarFile } from "@/lib/avatar";
import {
  encodeDailyChampionQuote,
  parseDailyChampionQuote,
  toLocalDateKey,
  type ChampionQuoteDraft,
} from "@/lib/champion-quote";
import {
  encodeProfileEffectBundle,
  getProfileEffectById,
  loadLocalProfileEffectBundle,
  notifyEffectsDisabledUpdated,
  parseProfileEffectBundle,
  resolveActiveProfileEffect,
  saveResolvedActiveEffectId,
  type ProfileEffectId,
  type ProfileEffectPreference,
} from "@/lib/profile-effects";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  user_id: string;
  username: string | null;
  avatar_url?: string | null;
  daily_goal_minutes?: number | null;
  studying_subject?: string | null;
  studying_started_at?: string | null;
  champion_quote?: string | null;
  profile_effect?: string | null;
};

type FriendshipRow = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

type StudyGroupRow = {
  id: number;
  name: string;
  invite_code: string;
  created_by: string;
  champion_quote: string | null;
  champion_quote_author_id: string | null;
  champion_quote_updated_at?: string | null;
  created_at: string;
};

type GroupMemberRow = {
  group_id: number;
  user_id: string;
  joined_at: string;
};

type SessionRow = {
  user_id: string;
  subject: string;
  duration: number;
  created_at: string;
};

type SubjectSummary = {
  subject: string;
  seconds: number;
};

type ProfileMeta = {
  username: string;
  avatarUrl: string | null;
  studyingSubject: string | null;
  studyingStartedAt: string | null;
  championQuote: string | null;
  profileEffect: string | null;
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
  active_effect: ProfileEffectId | null;
  custom_gif_url: string | null;
  studying_subject: string | null;
  studying_started_at: string | null;
  champion_quote: string | null;
  today_subjects: SubjectSummary[];
  week_subjects: SubjectSummary[];
};

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;
const MAX_LIVE_SESSION_MS = 6 * 60 * 60 * 1000;
const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode() {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
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

function buildLeaderboardEntries(
  memberIds: string[],
  allSessions: SessionRow[],
  profileLookup: Record<string, ProfileMeta>,
  currentUserId: string,
  currentTimestamp: number
): LeaderboardEntry[] {
  const { todayStart, weekStart } = getTimeBoundaries();
  const uniqueIds = Array.from(new Set(memberIds));

  return uniqueIds.map((memberId) => {
    const memberSessions = allSessions.filter((s) => s.user_id === memberId);

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

    const todaySubjects: SubjectSummary[] = Object.entries(todaySubjectSeconds)
      .map(([subject, seconds]) => ({ subject, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 3);

    const weekSubjects: SubjectSummary[] = Object.entries(weekSubjectSeconds)
      .map(([subject, seconds]) => ({ subject, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 3);

    const currentStreak = computeCurrentStreak(
      memberSessions.map((s) => s.created_at)
    );

    const meta = profileLookup[memberId];
    const unlockedBadges = evaluateAchievements(memberSessions).filter(
      (b) => b.unlocked
    );
    const parsedEffectBundle = parseProfileEffectBundle(meta?.profileEffect);
    const activeEffect =
      resolveActiveProfileEffect(
        parsedEffectBundle.effectPref,
        unlockedBadges.map((b) => b.id)
      )?.id ?? null;

    let activeStudyingSubject: string | null = null;
    let activeStudyingStartedAt: string | null = null;

    if (meta?.studyingSubject && meta?.studyingStartedAt) {
      const startedMs = new Date(meta.studyingStartedAt).getTime();
      if (
        !Number.isNaN(startedMs) &&
        currentTimestamp - startedMs >= -60000 &&
        currentTimestamp - startedMs < MAX_LIVE_SESSION_MS
      ) {
        activeStudyingSubject = meta.studyingSubject;
        activeStudyingStartedAt = meta.studyingStartedAt;
      }
    }

    return {
      user_id: memberId,
      username: meta?.username || (memberId === currentUserId ? "you" : "student"),
      avatar_url: meta?.avatarUrl ?? null,
      is_self: memberId === currentUserId,
      today_seconds: todaySeconds,
      week_seconds: weekSeconds,
      current_streak: currentStreak,
      unlocked_badges: unlockedBadges,
      active_effect: activeEffect,
      custom_gif_url: parsedEffectBundle.customGifUrl,
      studying_subject: activeStudyingSubject,
      studying_started_at: activeStudyingStartedAt,
      champion_quote: meta?.championQuote ?? null,
      today_subjects: todaySubjects,
      week_subjects: weekSubjects,
    };
  });
}

function isTodayIso(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return toLocalDateKey(parsed) === toLocalDateKey(new Date());
}

function getDailyChampion(entries: LeaderboardEntry[]) {
  const ranked = [...entries]
    .filter((entry) => entry.today_seconds > 0)
    .sort(
      (a, b) =>
        b.today_seconds - a.today_seconds ||
        b.week_seconds - a.week_seconds ||
        a.username.localeCompare(b.username)
    );
  return ranked[0] ?? null;
}

export default function FriendsPage() {
  const router = useRouter();
  const { toast } = useNotifications();
  const effectsDisabled = useEffectsDisabled();
  const avatarInputId = useId();

  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends");
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
  const [snapshotTimestamp, setSnapshotTimestamp] = useState(() => Date.now());

  // Groups & Champion Quote state
  const [groupsSetupRequired, setGroupsSetupRequired] = useState(false);
  const [myGroups, setMyGroups] = useState<StudyGroupRow[]>([]);
  const [groupMembersByGroupId, setGroupMembersByGroupId] = useState<
    Record<number, string[]>
  >({});
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [cachedSessions, setCachedSessions] = useState<SessionRow[]>([]);
  const [cachedProfileLookup, setCachedProfileLookup] = useState<
    Record<string, ProfileMeta>
  >({});
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [myEffectPref, setMyEffectPref] =
    useState<ProfileEffectPreference>("auto");
  const [myCustomGifUrl, setMyCustomGifUrl] = useState<string | null>(null);
  const [isEffectPickerOpen, setIsEffectPickerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const loadFriendsData = useCallback(async (userId: string) => {
    let myProfile: ProfileRow | null = null;

    const fullProfileRes = await supabase
      .from("profiles")
      .select(
        "user_id, username, avatar_url, daily_goal_minutes, studying_subject, studying_started_at, champion_quote, profile_effect"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (fullProfileRes.error) {
      if (
        fullProfileRes.error.message.includes("profile_effect") ||
        fullProfileRes.error.message.includes("champion_quote") ||
        fullProfileRes.error.message.includes("avatar_url") ||
        fullProfileRes.error.message.includes("studying_")
      ) {
        const quoteProfileRes = await supabase
          .from("profiles")
          .select(
            "user_id, username, avatar_url, daily_goal_minutes, studying_subject, studying_started_at, champion_quote"
          )
          .eq("user_id", userId)
          .maybeSingle();

        if (!quoteProfileRes.error) {
          myProfile = quoteProfileRes.data as ProfileRow | null;
        } else {
          const avatarStudyRes = await supabase
            .from("profiles")
            .select(
              "user_id, username, avatar_url, daily_goal_minutes, studying_subject, studying_started_at"
            )
            .eq("user_id", userId)
            .maybeSingle();

          if (!avatarStudyRes.error) {
            myProfile = avatarStudyRes.data as ProfileRow | null;
          } else {
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
    const resolvedMyBundle = myProfile?.profile_effect
      ? parseProfileEffectBundle(myProfile.profile_effect)
      : loadLocalProfileEffectBundle();
    setMyEffectPref(resolvedMyBundle.effectPref);
    setMyCustomGifUrl(resolvedMyBundle.customGifUrl);

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

    // Load user's Study Groups (optional until SQL setup runs)
    let loadedGroups: StudyGroupRow[] = [];
    const nextGroupMembersById: Record<number, string[]> = {};
    const groupMemberIds: string[] = [];

    const myMembershipRes = await supabase
      .from("study_group_members")
      .select("group_id")
      .eq("user_id", userId);

    if (myMembershipRes.error) {
      if (
        myMembershipRes.error.code === "42P01" ||
        myMembershipRes.error.code === "PGRST205" ||
        myMembershipRes.error.message.includes("study_group")
      ) {
        setGroupsSetupRequired(true);
      } else {
        console.error("Group membership error:", myMembershipRes.error);
      }
    } else {
      setGroupsSetupRequired(false);
      const myGroupIds = Array.from(
        new Set((myMembershipRes.data || []).map((row) => row.group_id))
      );

      if (myGroupIds.length > 0) {
        const [groupsRes, allGroupMembersRes] = await Promise.all([
          supabase
            .from("study_groups")
            .select(
              "id, name, invite_code, created_by, champion_quote, champion_quote_author_id, champion_quote_updated_at, created_at"
            )
            .in("id", myGroupIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("study_group_members")
            .select("group_id, user_id, joined_at")
            .in("group_id", myGroupIds),
        ]);

        if (!groupsRes.error && groupsRes.data) {
          loadedGroups = groupsRes.data as StudyGroupRow[];
        }
        if (!allGroupMembersRes.error && allGroupMembersRes.data) {
          (allGroupMembersRes.data as GroupMemberRow[]).forEach((m) => {
            if (!nextGroupMembersById[m.group_id]) {
              nextGroupMembersById[m.group_id] = [];
            }
            nextGroupMembersById[m.group_id].push(m.user_id);
            groupMemberIds.push(m.user_id);
          });
        }
      }
    }

    setMyGroups(loadedGroups);
    setGroupMembersByGroupId(nextGroupMembersById);
    setSelectedGroupId((prev) => {
      if (prev !== null && loadedGroups.some((g) => g.id === prev)) {
        return prev;
      }
      return loadedGroups[0]?.id ?? null;
    });

    const friendshipOtherIds = typedFriendships.map((f) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );
    const otherUserIds = Array.from(
      new Set([...friendshipOtherIds, ...groupMemberIds])
    ).filter((id) => id !== userId);

    const usernameMap: Record<string, string> = {};
    const avatarMap: Record<string, string | null> = {
      [userId]: resolvedMyAvatar,
    };
    const profileLookup: Record<string, ProfileMeta> = {
      [userId]: {
        username: resolvedMyUsername || "you",
        avatarUrl: resolvedMyAvatar,
        studyingSubject: myProfile?.studying_subject ?? null,
        studyingStartedAt: myProfile?.studying_started_at ?? null,
        championQuote: myProfile?.champion_quote ?? null,
        profileEffect: encodeProfileEffectBundle(
          resolvedMyBundle.effectPref,
          resolvedMyBundle.customGifUrl
        ),
      },
    };

    if (otherUserIds.length > 0) {
      const fullRelatedRes = await supabase
        .from("profiles")
        .select(
          "user_id, username, avatar_url, studying_subject, studying_started_at, champion_quote, profile_effect"
        )
        .in("user_id", otherUserIds);

      let relatedProfiles: ProfileRow[] | null = null;

      if (fullRelatedRes.error) {
        const quoteRelatedRes = await supabase
          .from("profiles")
          .select(
            "user_id, username, avatar_url, studying_subject, studying_started_at, champion_quote"
          )
          .in("user_id", otherUserIds);

        if (!quoteRelatedRes.error) {
          relatedProfiles = (quoteRelatedRes.data || []) as ProfileRow[];
        } else {
          const avatarStudyRelatedRes = await supabase
            .from("profiles")
            .select(
              "user_id, username, avatar_url, studying_subject, studying_started_at"
            )
            .in("user_id", otherUserIds);

          if (!avatarStudyRelatedRes.error) {
            relatedProfiles = (avatarStudyRelatedRes.data || []) as ProfileRow[];
          } else {
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
          }
        }
      } else {
        relatedProfiles = (fullRelatedRes.data || []) as ProfileRow[];
      }

      relatedProfiles.forEach((p) => {
        if (p.username) {
          usernameMap[p.user_id] = p.username;
        }
        avatarMap[p.user_id] = p.avatar_url ?? null;
        profileLookup[p.user_id] = {
          username: p.username || "student",
          avatarUrl: p.avatar_url ?? null,
          studyingSubject: p.studying_subject ?? null,
          studyingStartedAt: p.studying_started_at ?? null,
          championQuote: p.champion_quote ?? null,
          profileEffect: p.profile_effect ?? null,
        };
      });
    }

    setUsernamesById(usernameMap);
    setAvatarsById(avatarMap);
    setCachedProfileLookup(profileLookup);

    const acceptedFriendIds = typedFriendships
      .filter((f) => f.status === "accepted")
      .map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );

    const friendsCircleIds = Array.from(
      new Set([userId, ...acceptedFriendIds])
    );
    const allVisibleIds = Array.from(
      new Set([...friendsCircleIds, ...groupMemberIds])
    );

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("study_sessions")
      .select("user_id, subject, duration, created_at")
      .in("user_id", allVisibleIds);

    if (sessionsError) {
      console.error("Leaderboard sessions error:", sessionsError);
    }

    const allSessions = (sessionRows || []) as SessionRow[];
    const currentTimestamp = Date.now();

    const nextLeaderboard = buildLeaderboardEntries(
      friendsCircleIds,
      allSessions,
      profileLookup,
      userId,
      currentTimestamp
    );

    const selfEntry = nextLeaderboard.find((entry) => entry.is_self);
    if (selfEntry) {
      saveResolvedActiveEffectId(selfEntry.active_effect);
    }

    setCachedSessions(allSessions);
    setSnapshotTimestamp(currentTimestamp);
    setLeaderboard(nextLeaderboard);
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

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const joinParam = params.get("join");
        if (joinParam && joinParam.trim()) {
          setJoinCodeInput(joinParam.trim().toUpperCase().slice(0, 8));
          setActiveTab("groups");
        }
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
      .channel(
        `friends-live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          if (activeUserId) {
            loadFriendsData(activeUserId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_groups" },
        () => {
          if (activeUserId) {
            loadFriendsData(activeUserId);
          }
        }
      )
      .subscribe();

    const handleEffectUpdated = (event: Event) => {
      const custom = event as CustomEvent<{
        preference?: ProfileEffectPreference;
        customGifUrl?: string | null;
        resolvedEffectId?: ProfileEffectId | null;
      }>;
      const nextPref = custom.detail?.preference;
      const hasCustomGif = Boolean(
        custom.detail && "customGifUrl" in custom.detail
      );
      const nextCustomGif = hasCustomGif
        ? (custom.detail?.customGifUrl ?? null)
        : undefined;
      const nextEffectId = custom.detail?.resolvedEffectId ?? null;
      if (nextPref) {
        setMyEffectPref(nextPref);
      }
      if (hasCustomGif) {
        setMyCustomGifUrl(nextCustomGif ?? null);
      }
      if (activeUserId) {
        const uid = activeUserId;
        setCachedProfileLookup((prev) => {
          const existing = prev[uid];
          if (!existing) return prev;
          const prevBundle = parseProfileEffectBundle(existing.profileEffect);
          return {
            ...prev,
            [uid]: {
              ...existing,
              profileEffect: encodeProfileEffectBundle(
                nextPref ?? prevBundle.effectPref,
                hasCustomGif ? (nextCustomGif ?? null) : prevBundle.customGifUrl
              ),
            },
          };
        });
        setLeaderboard((prev) =>
          prev.map((entry) =>
            entry.is_self
              ? {
                  ...entry,
                  active_effect: nextEffectId,
                  ...(hasCustomGif
                    ? { custom_gif_url: nextCustomGif ?? null }
                    : {}),
                }
              : entry
          )
        );
      }
    };

    window.addEventListener("profile-effect-updated", handleEffectUpdated);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      window.removeEventListener("profile-effect-updated", handleEffectUpdated);
    };
  }, [router, loadFriendsData]);

  const myAchievements = useMemo(() => {
    if (!currentUserId) return evaluateAchievements([]);
    return evaluateAchievements(
      cachedSessions.filter((s) => s.user_id === currentUserId)
    );
  }, [cachedSessions, currentUserId]);

  const myActiveEffect = useMemo(
    () =>
      resolveActiveProfileEffect(
        myEffectPref,
        myAchievements.filter((a) => a.unlocked).map((a) => a.id)
      ),
    [myEffectPref, myAchievements]
  );

  const selectedGroup = useMemo(
    () => myGroups.find((g) => g.id === selectedGroupId) ?? myGroups[0] ?? null,
    [myGroups, selectedGroupId]
  );

  const groupLeaderboard = useMemo(() => {
    if (!selectedGroup || !currentUserId) return [];
    const memberIds = groupMembersByGroupId[selectedGroup.id] ?? [currentUserId];
    return buildLeaderboardEntries(
      memberIds,
      cachedSessions,
      cachedProfileLookup,
      currentUserId,
      snapshotTimestamp
    );
  }, [
    selectedGroup,
    currentUserId,
    groupMembersByGroupId,
    cachedSessions,
    cachedProfileLookup,
    snapshotTimestamp,
  ]);

  const hasAnyoneStudyingLive = useMemo(() => {
    return (
      leaderboard.some((e) =>
        Boolean(e.studying_subject && e.studying_started_at)
      ) ||
      groupLeaderboard.some((e) =>
        Boolean(e.studying_subject && e.studying_started_at)
      )
    );
  }, [leaderboard, groupLeaderboard]);

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
    const input = e.currentTarget;
    const file = input.files?.[0];
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
    } finally {
      input.value = "";
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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || isCreatingGroup) return;

    const cleanedName = newGroupName.trim().slice(0, 40);
    if (cleanedName.length < 2) {
      toast.error("Group name must be at least 2 characters.");
      return;
    }

    setIsCreatingGroup(true);
    const inviteCode = generateInviteCode();

    const { data: createdGroup, error: createError } = await supabase
      .from("study_groups")
      .insert({
        name: cleanedName,
        invite_code: inviteCode,
        created_by: currentUserId,
      })
      .select(
        "id, name, invite_code, created_by, champion_quote, champion_quote_author_id, created_at"
      )
      .single();

    if (createError || !createdGroup) {
      setIsCreatingGroup(false);
      toast.error(
        "Could not create group",
        createError?.message || "Please try again."
      );
      return;
    }

    const { error: memberError } = await supabase
      .from("study_group_members")
      .insert({
        group_id: createdGroup.id,
        user_id: currentUserId,
      });

    setIsCreatingGroup(false);

    if (memberError) {
      toast.error("Created group, but failed to join", memberError.message);
      return;
    }

    setNewGroupName("");
    setSelectedGroupId(createdGroup.id);
    toast.success("Study group created!", `Invite code: ${createdGroup.invite_code}`);
    await loadFriendsData(currentUserId);
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || isJoiningGroup) return;

    const code = joinCodeInput.trim().toUpperCase();
    if (code.length < 4) {
      toast.error("Enter a valid group invite code.");
      return;
    }

    setIsJoiningGroup(true);

    const { data: targetGroup, error: lookupError } = await supabase
      .from("study_groups")
      .select("id, name, invite_code")
      .eq("invite_code", code)
      .maybeSingle();

    if (lookupError) {
      setIsJoiningGroup(false);
      toast.error("Could not look up invite code", lookupError.message);
      return;
    }

    if (!targetGroup) {
      setIsJoiningGroup(false);
      toast.error("Group not found", `No group matches code "${code}".`);
      return;
    }

    if (myGroups.some((g) => g.id === targetGroup.id)) {
      setIsJoiningGroup(false);
      setSelectedGroupId(targetGroup.id);
      setJoinCodeInput("");
      toast.info(`You're already in ${targetGroup.name}`);
      return;
    }

    const { error: joinError } = await supabase
      .from("study_group_members")
      .insert({
        group_id: targetGroup.id,
        user_id: currentUserId,
      });

    setIsJoiningGroup(false);

    if (joinError) {
      if (joinError.code === "23505") {
        setSelectedGroupId(targetGroup.id);
        toast.info(`You're already in ${targetGroup.name}`);
        await loadFriendsData(currentUserId);
        return;
      }
      toast.error("Could not join group", joinError.message);
      return;
    }

    setJoinCodeInput("");
    setSelectedGroupId(targetGroup.id);
    toast.success(`Joined ${targetGroup.name}! 🎉`);
    await loadFriendsData(currentUserId);
  };

  const handleLeaveOrDeleteGroup = async (group: StudyGroupRow) => {
    if (!currentUserId) return;

    const isCreator = group.created_by === currentUserId;
    const confirmed = window.confirm(
      isCreator
        ? `Delete "${group.name}" for all members?`
        : `Leave "${group.name}"?`
    );
    if (!confirmed) return;

    if (isCreator) {
      const { error } = await supabase
        .from("study_groups")
        .delete()
        .eq("id", group.id)
        .eq("created_by", currentUserId);

      if (error) {
        toast.error("Could not delete group", error.message);
        return;
      }
      toast.info(`Deleted ${group.name}`);
    } else {
      const { error } = await supabase
        .from("study_group_members")
        .delete()
        .eq("group_id", group.id)
        .eq("user_id", currentUserId);

      if (error) {
        toast.error("Could not leave group", error.message);
        return;
      }
      toast.info(`Left ${group.name}`);
    }

    await loadFriendsData(currentUserId);
  };

  const handleCopyInvite = async (
    group: StudyGroupRow,
    mode: "code" | "link"
  ) => {
    try {
      const value =
        mode === "code"
          ? group.invite_code
          : `${window.location.origin}/friends?join=${group.invite_code}`;
      await navigator.clipboard.writeText(value);
      toast.success(
        mode === "code" ? "Invite code copied!" : "Invite link copied!",
        mode === "code" ? group.invite_code : "Send it to your study mates."
      );
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleSaveFriendsQuote = async (
    draftQuote: ChampionQuoteDraft
  ): Promise<boolean> => {
    if (!currentUserId || isSavingQuote) return false;
    setIsSavingQuote(true);

    const payloadQuote = encodeDailyChampionQuote(
      draftQuote.text,
      draftQuote.imageUrl
    );
    const { error } = await supabase
      .from("profiles")
      .update({ champion_quote: payloadQuote })
      .eq("user_id", currentUserId);

    setIsSavingQuote(false);

    if (error) {
      if (error.message.includes("champion_quote") || error.code === "42703") {
        toast.error(
          "SQL setup required",
          "Run supabase-groups-setup.sql in Supabase SQL Editor first."
        );
      } else {
        toast.error("Could not save champion quote", error.message);
      }
      return false;
    }

    toast.success(
      payloadQuote
        ? "Today's champion quote updated! 👑"
        : "Champion quote & photo cleared"
    );
    await loadFriendsData(currentUserId);
    return true;
  };

  const handleSaveGroupQuote = async (
    groupId: number,
    draftQuote: ChampionQuoteDraft
  ): Promise<boolean> => {
    if (!currentUserId || isSavingQuote) return false;
    setIsSavingQuote(true);

    const payloadQuote = encodeDailyChampionQuote(
      draftQuote.text,
      draftQuote.imageUrl
    );
    const { error } = await supabase
      .from("study_groups")
      .update({
        champion_quote: payloadQuote,
        champion_quote_author_id: payloadQuote ? currentUserId : null,
        champion_quote_updated_at: payloadQuote
          ? new Date().toISOString()
          : null,
      })
      .eq("id", groupId);

    setIsSavingQuote(false);

    if (error) {
      toast.error("Could not save group quote", error.message);
      return false;
    }

    toast.success(
      payloadQuote
        ? "Today's group quote updated! 👑"
        : "Group quote & photo cleared"
    );
    await loadFriendsData(currentUserId);
    return true;
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

  const sortLeaderboard = (entries: LeaderboardEntry[]) =>
    [...entries].sort((a, b) =>
      leaderboardPeriod === "today"
        ? b.today_seconds - a.today_seconds ||
          b.week_seconds - a.week_seconds ||
          a.username.localeCompare(b.username)
        : b.week_seconds - a.week_seconds ||
          b.today_seconds - a.today_seconds ||
          a.username.localeCompare(b.username)
    );

  const sortedFriendsLeaderboard = sortLeaderboard(leaderboard);
  const maxFriendsPeriodSeconds = Math.max(
    ...sortedFriendsLeaderboard.map((entry) =>
      leaderboardPeriod === "today" ? entry.today_seconds : entry.week_seconds
    ),
    1
  );

  const friendsDailyChampion = getDailyChampion(leaderboard);

  const sortedGroupLeaderboard = sortLeaderboard(groupLeaderboard);
  const maxGroupPeriodSeconds = Math.max(
    ...sortedGroupLeaderboard.map((entry) =>
      leaderboardPeriod === "today" ? entry.today_seconds : entry.week_seconds
    ),
    1
  );
  const groupDailyChampion = getDailyChampion(groupLeaderboard);

  const renderLeaderboardCards = (
    entries: LeaderboardEntry[],
    maxPeriodSeconds: number,
    allowRemoveFriend: boolean,
    championUserId: string | null
  ) => {
    if (entries.length === 0) {
      return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
          <p className="text-xs text-white/55 sm:text-sm">
            No study activity yet.
          </p>
        </div>
      );
    }

    return entries.map((entry, index) => {
      const rank = index + 1;
      const rankBadgeClass =
        rank === 1
          ? "border-amber-400/35 bg-amber-400/10 text-amber-300"
          : rank === 2
            ? "border-zinc-400/30 bg-zinc-400/10 text-zinc-200"
            : rank === 3
              ? "border-orange-400/30 bg-orange-400/10 text-orange-300"
              : "border-white/10 bg-white/[0.04] text-white/55";
      const profileHref = entry.is_self
        ? "/profile"
        : entry.username && entry.username !== "student"
          ? `/profile?u=${encodeURIComponent(entry.username)}`
          : `/profile?id=${encodeURIComponent(entry.user_id)}`;
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
      const relation =
        allowRemoveFriend && !entry.is_self
          ? findRelationship(entry.user_id)
          : undefined;
      const isStudyingNow = Boolean(
        entry.studying_subject && entry.studying_started_at
      );
      const isWeeklyChampion = championUserId === entry.user_id;
      const cardEffect = getProfileEffectById(entry.active_effect);

      return (
        <div
          key={entry.user_id}
          className={`relative overflow-hidden rounded-2xl border ${
            !effectsDisabled && cardEffect
              ? `${cardEffect.borderClass} ${
                  entry.is_self ? "bg-[#151518]" : "bg-[#111113]"
                }`
              : entry.is_self
                ? "border-white/25 bg-[#151518]"
                : "border-white/[0.08] bg-[#111113]"
          }`}
        >
          <ProfileEffectOverlay effectId={entry.active_effect} />

          <div className="relative z-10 p-4 sm:p-5">
            {/* Top Row: Identity + Desktop Stats + Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-flex h-7 min-w-8 shrink-0 items-center justify-center rounded-lg border px-1.5 font-mono text-xs font-bold tabular-nums ${rankBadgeClass}`}
                  >
                    #{rank}
                  </span>

                  <Link
                    href={profileHref}
                    className="group flex min-w-0 items-center gap-3"
                  >
                    <UserAvatar
                      avatarUrl={entry.avatar_url}
                      name={entry.username}
                      size="sm"
                      effectId={entry.active_effect}
                    />
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={profileHref}
                        className="truncate font-mono text-sm font-bold text-white transition hover:underline sm:text-base"
                      >
                        @{entry.username}
                      </Link>
                      {entry.is_self && (
                        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                          You
                        </span>
                      )}
                      {isWeeklyChampion && (
                        <span className="rounded-full border border-amber-400/35 bg-amber-400/12 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          Top Today
                        </span>
                      )}
                      {entry.current_streak > 0 && (
                        <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/75 tabular-nums">
                          {entry.current_streak}d streak
                        </span>
                      )}
                      <ProfileEffectPill effectId={entry.active_effect} />
                    </div>

                  {isStudyingNow && entry.studying_started_at && (
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 tabular-nums">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      <span className="truncate">
                        Studying <strong>{entry.studying_subject}</strong> ·{" "}
                        {formatLiveElapsed(entry.studying_started_at, nowMs)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
                <Link
                  href={profileHref}
                  className="rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:border-white/25 hover:text-white"
                >
                  Profile
                </Link>
                {relation && (
                  <button
                    onClick={() =>
                      removeFriendship(
                        relation.id,
                        `Remove @${entry.username} from your friends?`
                      )
                    }
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/45 transition hover:border-red-500/30 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
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

              <Link
                href={profileHref}
                className="hidden h-8 shrink-0 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 text-xs font-medium text-white/80 transition hover:border-white/25 hover:text-white sm:inline-flex sm:items-center"
              >
                Profile
              </Link>

              {relation && (
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
        </div>
      );
    });
  };

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
          <p className="text-sm text-white/55">Loading friends &amp; groups...</p>
        </div>
      </main>
    );
  }

  if (setupRequired) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Friends &amp; Groups</h1>
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
      {/* HEADER + FRIENDS / GROUPS SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Friends &amp; Groups
          </h1>
          <p className="mt-0.5 text-xs text-white/55 sm:text-sm">
            Study together, compete in groups, and claim the #1 Champion Quote.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={effectsDisabled}
            onClick={() => notifyEffectsDisabledUpdated(!effectsDisabled)}
            title="Toggle distraction-free mode (hide all profile effects and banner GIFs)"
            className={`inline-flex h-9 shrink-0 items-center rounded-xl border px-3 text-xs font-semibold transition ${
              effectsDisabled
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-[#111113] text-white/75 hover:border-white/25 hover:text-white"
            }`}
          >
            <span>{effectsDisabled ? "Effects Off" : "Effects On"}</span>
          </button>

          <div className="inline-flex h-9 shrink-0 items-center rounded-xl border border-white/10 bg-[#111113] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("friends")}
              className={`h-7 rounded-lg px-3.5 text-xs font-semibold transition ${
                activeTab === "friends"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Friends
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("groups")}
              className={`h-7 rounded-lg px-3.5 text-xs font-semibold transition ${
                activeTab === "groups"
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Groups{myGroups.length > 0 ? ` (${myGroups.length})` : ""}
            </button>
          </div>
        </div>
      </div>

      {activeTab === "friends" ? (
        <>
          {/* YOUR PROFILE & USERNAME CARD */}
          <section
            className={`relative mt-5 overflow-hidden rounded-2xl border bg-[#111113] sm:mt-7 ${
              !effectsDisabled && myActiveEffect
                ? myActiveEffect.borderClass
                : "border-white/[0.08]"
            }`}
          >
            <ProfileEffectOverlay effectId={myActiveEffect?.id ?? null} />

            <div className="relative z-10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <UserAvatar
                  avatarUrl={myAvatarUrl}
                  name={myUsername || "you"}
                  size="md"
                  effectId={myActiveEffect?.id ?? null}
                />

                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[11px] font-medium text-white/45">
                      Your profile
                    </p>
                    <ProfileEffectPill effectId={myActiveEffect?.id ?? null} />
                  </div>
                  {myUsername && !isEditingUsername ? (
                    <Link
                      href="/profile"
                      className="font-mono text-base font-bold text-white transition hover:underline sm:text-lg"
                    >
                      @{myUsername}
                    </Link>
                  ) : (
                    <p className="text-xs text-white/65">
                      Choose a unique @username so friends can find you.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={avatarInputId}
                  type="file"
                  accept="image/*"
                  disabled={isSavingAvatar}
                  onChange={handleAvatarUpload}
                  className="sr-only"
                />

                <Link
                  href="/profile"
                  className="inline-flex h-9 items-center rounded-xl bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  View Profile
                </Link>

                <button
                  type="button"
                  onClick={() => setIsEffectPickerOpen(true)}
                  className="h-9 rounded-xl border border-white/15 bg-[#09090b]/80 px-3 text-xs font-medium text-white/90 transition hover:border-white/30 hover:bg-white/5"
                >
                  Customize Profile
                </button>

                <label
                  htmlFor={avatarInputId}
                  className={`inline-flex h-9 cursor-pointer items-center rounded-xl border border-white/15 px-3 text-xs font-medium transition hover:bg-white/5 ${
                    isSavingAvatar ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  {isSavingAvatar
                    ? "Uploading..."
                    : myAvatarUrl
                      ? "Change photo"
                      : "Add photo"}
                </label>

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
            </div>
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
                        <Link
                          href={
                            profile.username
                              ? `/profile?u=${encodeURIComponent(profile.username)}`
                              : `/profile?id=${encodeURIComponent(profile.user_id)}`
                          }
                          className="flex min-w-0 items-center gap-2.5 transition hover:opacity-90"
                        >
                          <UserAvatar
                            avatarUrl={profile.avatar_url}
                            name={profile.username}
                            size="xs"
                          />
                          <span className="truncate font-mono text-xs font-medium hover:underline sm:text-sm">
                            @{profile.username}
                          </span>
                        </Link>

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

          {/* FRIENDS #1 DAILY CHAMPION QUOTE */}
          <section className="mt-5 sm:mt-6">
            <ChampionQuoteBanner
              scopeLabel="Friends #1 Today"
              champion={
                friendsDailyChampion
                  ? (() => {
                      const parsedQuote = parseDailyChampionQuote(
                        friendsDailyChampion.champion_quote
                      );
                      return {
                        username: friendsDailyChampion.username,
                        avatarUrl: friendsDailyChampion.avatar_url,
                        effectId: friendsDailyChampion.active_effect,
                        isSelf: friendsDailyChampion.is_self,
                        scoreLabel: formatDuration(
                          friendsDailyChampion.today_seconds
                        ),
                        quote: parsedQuote.text,
                        imageUrl: parsedQuote.imageUrl,
                      };
                    })()
                  : null
              }
              onSaveQuote={handleSaveFriendsQuote}
              isSaving={isSavingQuote}
            />
          </section>

          {/* FRIENDS DAILY & WEEKLY LEADERBOARD */}
          <section className="mt-6 sm:mt-7">
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
              {renderLeaderboardCards(
                sortedFriendsLeaderboard,
                maxFriendsPeriodSeconds,
                true,
                friendsDailyChampion?.user_id ?? null
              )}
            </div>

            {sortedFriendsLeaderboard.length === 1 && (
              <p className="mt-4 text-center text-xs text-white/45">
                Search for a friend&apos;s @username above to add them to your
                leaderboard!
              </p>
            )}
          </section>
        </>
      ) : (
        /* STUDY GROUPS TAB */
        <section className="mt-5 space-y-5 sm:mt-7">
          {groupsSetupRequired ? (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
              <h2 className="text-base font-semibold text-orange-300">
                One-time Groups SQL setup required
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">
                Open your <strong>Supabase Dashboard → SQL Editor</strong>,
                paste <code>supabase-groups-setup.sql</code>, and click{" "}
                <strong>Run</strong>. Then refresh this page.
              </p>
            </div>
          ) : (
            <>
              {/* CREATE OR JOIN GROUP CARDS */}
              <div className="grid gap-4 md:grid-cols-2">
                <form
                  onSubmit={handleCreateGroup}
                  className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5"
                >
                  <h2 className="text-sm font-semibold sm:text-base">
                    Create a Study Group
                  </h2>
                  <p className="mt-0.5 text-xs text-white/50">
                    Start a group for your class, friends, or exam squad.
                  </p>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      maxLength={40}
                      placeholder="e.g. Med School 2026"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#09090b] px-3.5 text-sm outline-none focus:border-white/25"
                    />

                    <button
                      type="submit"
                      disabled={isCreatingGroup}
                      className="h-10 shrink-0 rounded-xl bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50 sm:text-sm"
                    >
                      {isCreatingGroup ? "..." : "Create"}
                    </button>
                  </div>
                </form>

                <form
                  onSubmit={handleJoinGroup}
                  className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5"
                >
                  <h2 className="text-sm font-semibold sm:text-base">
                    Join by Invite Code
                  </h2>
                  <p className="mt-0.5 text-xs text-white/50">
                    Enter a 6-character code shared by a group member.
                  </p>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(e.target.value.toUpperCase())
                      }
                      maxLength={8}
                      placeholder="e.g. K7P2MW"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#09090b] px-3.5 font-mono text-sm uppercase tracking-wider outline-none focus:border-white/25"
                    />

                    <button
                      type="submit"
                      disabled={isJoiningGroup}
                      className="h-10 shrink-0 rounded-xl border border-white/20 bg-white/[0.06] px-4 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 sm:text-sm"
                    >
                      {isJoiningGroup ? "..." : "Join"}
                    </button>
                  </div>
                </form>
              </div>

              {myGroups.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-8 text-center">
                  <p className="text-sm font-medium text-white/80">
                    You haven&apos;t joined any study groups yet.
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    Create a group above or enter a friend&apos;s invite code to
                    join one.
                  </p>
                </div>
              ) : (
                selectedGroup && (
                  <>
                    {/* GROUP SELECTOR PILLS */}
                    <div className="flex flex-wrap items-center gap-2">
                      {myGroups.map((group) => {
                        const isSelected = group.id === selectedGroup.id;
                        const memberCount =
                          groupMembersByGroupId[group.id]?.length ?? 1;

                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => setSelectedGroupId(group.id)}
                            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition ${
                              isSelected
                                ? "border-white/30 bg-white text-black"
                                : "border-white/10 bg-[#111113] text-white/75 hover:border-white/25 hover:text-white"
                            }`}
                          >
                            <span className="max-w-[160px] truncate">
                              {group.name}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                                isSelected
                                  ? "bg-black/10 text-black/80"
                                  : "bg-white/[0.06] text-white/55"
                              }`}
                            >
                              {memberCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* SELECTED GROUP HEADER CARD */}
                    <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                              {selectedGroup.name}
                            </h2>
                            <span className="rounded-full border border-white/10 bg-[#09090b] px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-emerald-300">
                              Code: {selectedGroup.invite_code}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-white/50">
                            {groupMembersByGroupId[selectedGroup.id]?.length ??
                              1}{" "}
                            {(groupMembersByGroupId[selectedGroup.id]?.length ??
                              1) === 1
                              ? "member"
                              : "members"}{" "}
                            · Ranked by study time
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyInvite(selectedGroup, "code")
                            }
                            className="h-8 rounded-lg border border-white/15 bg-[#09090b] px-3 text-xs font-medium text-white/85 transition hover:border-white/30"
                          >
                            Copy Code
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleCopyInvite(selectedGroup, "link")
                            }
                            className="h-8 rounded-lg border border-white/15 bg-[#09090b] px-3 text-xs font-medium text-white/85 transition hover:border-white/30"
                          >
                            Copy Link
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleLeaveOrDeleteGroup(selectedGroup)
                            }
                            className="h-8 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                          >
                            {selectedGroup.created_by === currentUserId
                              ? "Delete"
                              : "Leave"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* GROUP #1 DAILY CHAMPION QUOTE */}
                    <ChampionQuoteBanner
                      scopeLabel="Group #1 Today"
                      champion={
                        groupDailyChampion
                          ? (() => {
                              const isAuthorsQuoteToday =
                                selectedGroup.champion_quote_author_id ===
                                  groupDailyChampion.user_id &&
                                isTodayIso(
                                  selectedGroup.champion_quote_updated_at
                                );
                              const parsedQuote = isAuthorsQuoteToday
                                ? parseDailyChampionQuote(
                                    selectedGroup.champion_quote
                                  )
                                : { text: null, imageUrl: null };
                              return {
                                username: groupDailyChampion.username,
                                avatarUrl: groupDailyChampion.avatar_url,
                                effectId: groupDailyChampion.active_effect,
                                isSelf: groupDailyChampion.is_self,
                                scoreLabel: formatDuration(
                                  groupDailyChampion.today_seconds
                                ),
                                quote: parsedQuote.text,
                                imageUrl: parsedQuote.imageUrl,
                              };
                            })()
                          : null
                      }
                      onSaveQuote={(q) =>
                        handleSaveGroupQuote(selectedGroup.id, q)
                      }
                      isSaving={isSavingQuote}
                    />

                    {/* GROUP DAILY & WEEKLY LEADERBOARD */}
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold sm:text-lg">
                            {leaderboardPeriod === "today"
                              ? "Group Daily Leaderboard"
                              : "Group Weekly Leaderboard"}
                          </h3>
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
                        {renderLeaderboardCards(
                          sortedGroupLeaderboard,
                          maxGroupPeriodSeconds,
                          false,
                          groupDailyChampion?.user_id ?? null
                        )}
                      </div>
                    </div>
                  </>
                )
              )}
            </>
          )}
        </section>
      )}

      <ProfileEffectPicker
        mode="modal"
        open={isEffectPickerOpen}
        onClose={() => setIsEffectPickerOpen(false)}
        userId={currentUserId}
        username={myUsername}
        avatarUrl={myAvatarUrl}
        achievements={myAchievements}
        preference={myEffectPref}
        customGifUrl={myCustomGifUrl}
        onBundleChange={(nextBundle, resolvedEffectId) => {
          setMyEffectPref(nextBundle.effectPref);
          setMyCustomGifUrl(nextBundle.customGifUrl);
          if (currentUserId) {
            const encoded = encodeProfileEffectBundle(
              nextBundle.effectPref,
              nextBundle.customGifUrl
            );
            setCachedProfileLookup((prev) => {
              const existing = prev[currentUserId];
              if (!existing) return prev;
              return {
                ...prev,
                [currentUserId]: { ...existing, profileEffect: encoded },
              };
            });
            setLeaderboard((prev) =>
              prev.map((entry) =>
                entry.is_self
                  ? {
                      ...entry,
                      active_effect: resolvedEffectId,
                      custom_gif_url: nextBundle.customGifUrl,
                    }
                  : entry
              )
            );
          }
        }}
      />
    </main>
  );
}
