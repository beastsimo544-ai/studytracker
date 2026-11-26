import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

export type MusicPlatform = "spotify" | "youtube_music" | "soundcloud" | "other";

export type NowPlayingTrack = {
  title: string;
  artist: string | null;
  platform: MusicPlatform;
  url: string | null;
  source: "android" | "link" | "manual";
};

type NowPlayingNativeResult = {
  isPlaying: boolean;
  granted: boolean;
  title?: string;
  artist?: string;
  platform?: string;
  packageName?: string;
};

interface NowPlayingNativePlugin {
  hasPermission(): Promise<{ granted: boolean }>;
  openPermissionSettings(): Promise<void>;
  getNowPlaying(): Promise<NowPlayingNativeResult>;
}

const NowPlayingNative = registerPlugin<NowPlayingNativePlugin>("NowPlaying");

const SHARE_MUSIC_STORAGE_KEY = "studyShareMusicEnabled";
const MANUAL_TRACK_STORAGE_KEY = "studyManualMusicTrack";

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function getPlatformMeta(platform: string | null | undefined) {
  switch (platform) {
    case "spotify":
      return {
        label: "Spotify",
        dotColor: "#1DB954",
        badgeClass: "border-[#1DB954]/30 bg-[#1DB954]/10 text-[#4ade80]",
      };
    case "youtube_music":
      return {
        label: "YouTube Music",
        dotColor: "#FF0033",
        badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      };
    case "soundcloud":
      return {
        label: "SoundCloud",
        dotColor: "#FF5500",
        badgeClass: "border-orange-500/30 bg-orange-500/10 text-orange-300",
      };
    default:
      return {
        label: "Music",
        dotColor: "#a1a1aa",
        badgeClass: "border-white/15 bg-white/[0.06] text-white/80",
      };
  }
}

export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeUrlInput(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function detectMusicPlatformFromUrl(
  rawUrl: string
): MusicPlatform | null {
  const normalized = normalizeUrlInput(rawUrl);
  if (!normalized) return null;

  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (
      host === "open.spotify.com" ||
      host === "spotify.link" ||
      host === "play.spotify.com" ||
      host.endsWith(".spotify.com")
    ) {
      return "spotify";
    }
    if (
      host === "music.youtube.com" ||
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    ) {
      return "youtube_music";
    }
    if (
      host === "soundcloud.com" ||
      host === "www.soundcloud.com" ||
      host === "m.soundcloud.com" ||
      host === "on.soundcloud.com"
    ) {
      return "soundcloud";
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout(
  endpoint: string,
  timeoutMs = 4000
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function defaultTitleForPlatform(platform: MusicPlatform): string {
  if (platform === "spotify") return "Spotify Track";
  if (platform === "youtube_music") return "YouTube Music";
  if (platform === "soundcloud") return "SoundCloud Track";
  return "Study Music";
}

function normalizePlatform(value: unknown): MusicPlatform {
  if (
    value === "spotify" ||
    value === "youtube_music" ||
    value === "soundcloud"
  ) {
    return value;
  }
  return "other";
}

export async function resolveMusicLink(
  rawUrl: string
): Promise<NowPlayingTrack | null> {
  const normalizedUrl = normalizeUrlInput(rawUrl);
  if (!normalizedUrl) return null;

  const platform = detectMusicPlatformFromUrl(normalizedUrl);
  if (!platform) return null;

  let title = "";
  let artist: string | null = null;

  if (platform === "spotify") {
    const data = await fetchJsonWithTimeout(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(normalizedUrl)}`
    );
    if (data && typeof data.title === "string") {
      title = data.title.trim();
    }
    if (data && typeof data.author_name === "string" && data.author_name.trim()) {
      artist = data.author_name.trim();
    }
  } else if (platform === "soundcloud") {
    let data = await fetchJsonWithTimeout(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(normalizedUrl)}`
    );
    if (!data) {
      data = await fetchJsonWithTimeout(
        `https://noembed.com/embed?url=${encodeURIComponent(normalizedUrl)}`
      );
    }
    if (data && typeof data.title === "string") {
      title = data.title.trim();
    }
    if (data && typeof data.author_name === "string" && data.author_name.trim()) {
      artist = data.author_name.trim();
    }
  } else if (platform === "youtube_music") {
    let lookupUrl = normalizedUrl;
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.hostname.toLowerCase() === "music.youtube.com") {
        parsed.hostname = "www.youtube.com";
        lookupUrl = parsed.toString();
      }
    } catch {
      lookupUrl = normalizedUrl;
    }

    const data = await fetchJsonWithTimeout(
      `https://noembed.com/embed?url=${encodeURIComponent(lookupUrl)}`
    );
    if (data && typeof data.title === "string") {
      title = data.title.trim();
    }
    if (data && typeof data.author_name === "string" && data.author_name.trim()) {
      artist = data.author_name.replace(/\s*-\s*Topic$/i, "").trim() || null;
    }
  }

  return {
    title: (title || defaultTitleForPlatform(platform)).slice(0, 140),
    artist: artist ? artist.slice(0, 100) : null,
    platform,
    url: normalizedUrl,
    source: "link",
  };
}

export async function hasAndroidNowPlayingPermission(): Promise<boolean> {
  if (!isAndroidNative()) return false;
  try {
    const res = await NowPlayingNative.hasPermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

export async function openAndroidNowPlayingSettings(): Promise<void> {
  if (!isAndroidNative()) return;
  try {
    await NowPlayingNative.openPermissionSettings();
  } catch {
    // Ignore if unavailable
  }
}

export async function getAndroidNowPlaying(): Promise<NowPlayingTrack | null> {
  if (!isAndroidNative()) return null;
  try {
    const res = await NowPlayingNative.getNowPlaying();
    if (!res?.isPlaying || !res.title || !res.title.trim()) {
      return null;
    }
    return {
      title: res.title.trim().slice(0, 140),
      artist: res.artist?.trim() ? res.artist.trim().slice(0, 100) : null,
      platform: normalizePlatform(res.platform),
      url: null,
      source: "android",
    };
  } catch {
    return null;
  }
}

export function loadShareMusicEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(SHARE_MUSIC_STORAGE_KEY);
  return raw !== "false";
}

export function saveShareMusicEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHARE_MUSIC_STORAGE_KEY, enabled ? "true" : "false");
}

export function loadSavedManualTrack(): NowPlayingTrack | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(MANUAL_TRACK_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<NowPlayingTrack>;
    if (!parsed || typeof parsed.title !== "string" || !parsed.title.trim()) {
      return null;
    }
    return {
      title: parsed.title.trim().slice(0, 140),
      artist:
        typeof parsed.artist === "string" && parsed.artist.trim()
          ? parsed.artist.trim().slice(0, 100)
          : null,
      platform: normalizePlatform(parsed.platform),
      url: isSafeHttpUrl(parsed.url) ? parsed.url! : null,
      source: parsed.source === "link" ? "link" : "manual",
    };
  } catch {
    localStorage.removeItem(MANUAL_TRACK_STORAGE_KEY);
    return null;
  }
}

export function saveManualTrack(track: NowPlayingTrack | null): void {
  if (typeof window === "undefined") return;
  if (!track) {
    localStorage.removeItem(MANUAL_TRACK_STORAGE_KEY);
    return;
  }
  localStorage.setItem(MANUAL_TRACK_STORAGE_KEY, JSON.stringify(track));
}

export async function syncListeningToProfile(
  track: NowPlayingTrack | null
): Promise<{ ok: boolean; missingColumns?: boolean }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const payload = track
      ? {
          listening_title: track.title.slice(0, 140),
          listening_artist: track.artist ? track.artist.slice(0, 100) : null,
          listening_platform: track.platform,
          listening_url: isSafeHttpUrl(track.url) ? track.url : null,
        }
      : {
          listening_title: null,
          listening_artist: null,
          listening_platform: null,
          listening_url: null,
        };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id);

    if (error) {
      if (error.message.includes("listening_") || error.code === "42703") {
        return { ok: false, missingColumns: true };
      }
      return { ok: false };
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}
