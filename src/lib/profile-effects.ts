export type ProfileEffectId =
  | "spark_emerald"
  | "cyber_volt"
  | "ember_blaze"
  | "starlight_aura"
  | "arcane_aurora"
  | "solar_flare"
  | "crystal_prism"
  | "royal_ascension"
  | "sakura_storm"
  | "blackwall_breach"
  | "spartan_chaos"
  | "crimson_eclipse"
  | "domain_void"
  | "ki_surge"
  | "domain_shrine"
  | "golden_grace";

export type ProfileEffectPreference = "auto" | "none" | ProfileEffectId;

export type ProfileEffectBundle = {
  effectPref: ProfileEffectPreference;
  customGifUrl: string | null;
};

export type ProfileEffectCategory = "classic" | "anime_game";

export type ProfileEffectDefinition = {
  id: ProfileEffectId;
  achievementId: string;
  category: ProfileEffectCategory;
  inspiration?: string;
  name: string;
  tier: number;
  description: string;
  icon: string;
  accentHex: string;
  ringGradient: string;
  glowRgba: string;
  borderClass: string;
  badgeClass: string;
};

export const PROFILE_EFFECTS: ProfileEffectDefinition[] = [
  // Classic StudyTracker Effects
  {
    id: "spark_emerald",
    achievementId: "first_session",
    category: "classic",
    name: "Emerald Spark",
    tier: 1,
    description: "Drifting emerald focus motes with a soft neon rim pulse.",
    icon: "🎯",
    accentHex: "#34d399",
    ringGradient:
      "conic-gradient(from 0deg, #10b981, #6ee7b7, #059669, #34d399, #10b981)",
    glowRgba: "rgba(16, 185, 129, 0.35)",
    borderClass: "border-emerald-400/35",
    badgeClass: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
  },
  {
    id: "cyber_volt",
    achievementId: "deep_focus",
    category: "classic",
    name: "Cyber Volt",
    tier: 2,
    description: "High-voltage cyan arcs and sweeping digital scanlines.",
    icon: "⚡",
    accentHex: "#22d3ee",
    ringGradient:
      "conic-gradient(from 0deg, #06b6d4, #67e8f9, #3b82f6, #22d3ee, #06b6d4)",
    glowRgba: "rgba(34, 211, 238, 0.38)",
    borderClass: "border-cyan-400/40",
    badgeClass: "border-cyan-400/35 bg-cyan-500/15 text-cyan-200",
  },
  {
    id: "ember_blaze",
    achievementId: "streak_3",
    category: "classic",
    name: "Ember Blaze",
    tier: 3,
    description: "Rising furnace sparks and a molten orange-red underglow.",
    icon: "🔥",
    accentHex: "#fb923c",
    ringGradient:
      "conic-gradient(from 0deg, #f97316, #fbbf24, #ef4444, #fb923c, #f97316)",
    glowRgba: "rgba(249, 115, 22, 0.4)",
    borderClass: "border-orange-400/45",
    badgeClass: "border-orange-400/35 bg-orange-500/15 text-orange-200",
  },
  {
    id: "starlight_aura",
    achievementId: "streak_7",
    category: "classic",
    name: "Starlight Aura",
    tier: 4,
    description: "Twinkling celestial stars across a deep cosmic indigo halo.",
    icon: "🌟",
    accentHex: "#a78bfa",
    ringGradient:
      "conic-gradient(from 0deg, #8b5cf6, #e879f9, #38bdf8, #a78bfa, #8b5cf6)",
    glowRgba: "rgba(139, 92, 246, 0.4)",
    borderClass: "border-violet-400/45",
    badgeClass: "border-violet-400/35 bg-violet-500/15 text-violet-200",
  },
  {
    id: "arcane_aurora",
    achievementId: "week_10h",
    category: "classic",
    name: "Arcane Aurora",
    tier: 5,
    description: "Shifting northern-lights ribbons in teal, mint, and violet.",
    icon: "📚",
    accentHex: "#2dd4bf",
    ringGradient:
      "conic-gradient(from 0deg, #14b8a6, #38bdf8, #a855f7, #34d399, #14b8a6)",
    glowRgba: "rgba(45, 212, 191, 0.42)",
    borderClass: "border-teal-400/45",
    badgeClass: "border-teal-400/35 bg-teal-500/15 text-teal-200",
  },
  {
    id: "solar_flare",
    achievementId: "total_25h",
    category: "classic",
    name: "Solar Flare",
    tier: 6,
    description: "Radiant golden corona beams and warm floating stardust.",
    icon: "🏅",
    accentHex: "#fbbf24",
    ringGradient:
      "conic-gradient(from 0deg, #f59e0b, #fde047, #fb7185, #fbbf24, #f59e0b)",
    glowRgba: "rgba(251, 191, 36, 0.42)",
    borderClass: "border-amber-400/50",
    badgeClass: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  },
  {
    id: "crystal_prism",
    achievementId: "total_50h",
    category: "classic",
    name: "Crystal Prism",
    tier: 7,
    description: "Iridescent diamond shimmer with refracting holographic facets.",
    icon: "💎",
    accentHex: "#e879f9",
    ringGradient:
      "conic-gradient(from 0deg, #e879f9, #38bdf8, #818cf8, #f472b6, #e879f9)",
    glowRgba: "rgba(232, 121, 249, 0.44)",
    borderClass: "border-fuchsia-400/50",
    badgeClass: "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200",
  },
  {
    id: "royal_ascension",
    achievementId: "total_100h",
    category: "classic",
    name: "Royal Ascension",
    tier: 8,
    description:
      "Mythic gold & violet crown cascade with a double metallic sheen.",
    icon: "👑",
    accentHex: "#fde047",
    ringGradient:
      "conic-gradient(from 0deg, #facc15, #f59e0b, #c084fc, #fef08a, #facc15)",
    glowRgba: "rgba(250, 204, 21, 0.48)",
    borderClass: "border-yellow-400/55",
    badgeClass: "border-yellow-400/45 bg-yellow-400/15 text-yellow-200",
  },

  // Anime & Game Inspired Effects
  {
    id: "sakura_storm",
    achievementId: "first_session",
    category: "anime_game",
    inspiration: "Anime · Drift",
    name: "Sakura Storm",
    tier: 1,
    description: "Drifting twilight cherry blossoms across a calm dusk glow.",
    icon: "🌸",
    accentHex: "#f472b6",
    ringGradient:
      "conic-gradient(from 0deg, #f472b6, #fbcfe8, #c084fc, #ec4899, #f472b6)",
    glowRgba: "rgba(244, 114, 182, 0.4)",
    borderClass: "border-pink-400/45",
    badgeClass: "border-pink-400/40 bg-pink-500/15 text-pink-200",
  },
  {
    id: "blackwall_breach",
    achievementId: "deep_focus",
    category: "anime_game",
    inspiration: "Cyberpunk 2077",
    name: "Blackwall Breach",
    tier: 2,
    description:
      "Rogue crimson netrunner glitch bars and corrupted Blackwall firewall distortion.",
    icon: "🟥",
    accentHex: "#ef4444",
    ringGradient:
      "conic-gradient(from 0deg, #dc2626, #f87171, #18181b, #ef4444, #991b1b, #dc2626)",
    glowRgba: "rgba(239, 68, 68, 0.48)",
    borderClass: "border-red-500/50",
    badgeClass: "border-red-500/45 bg-red-500/15 text-red-200",
  },
  {
    id: "spartan_chaos",
    achievementId: "streak_3",
    category: "anime_game",
    inspiration: "God of War 3",
    name: "Blades of Chaos",
    tier: 3,
    description:
      "Forged Spartan fire chains and Olympus magma embers rising through ash.",
    icon: "⛓️",
    accentHex: "#f97316",
    ringGradient:
      "conic-gradient(from 0deg, #ea580c, #fde047, #b91c1c, #fb923c, #ea580c)",
    glowRgba: "rgba(234, 88, 12, 0.48)",
    borderClass: "border-orange-500/50",
    badgeClass: "border-orange-500/45 bg-orange-500/15 text-orange-200",
  },
  {
    id: "crimson_eclipse",
    achievementId: "streak_7",
    category: "anime_game",
    inspiration: "Anime · Genjutsu",
    name: "Crimson Eclipse",
    tier: 4,
    description:
      "Orbiting blood-moon eclipse rings inside a hypnotic crimson void.",
    icon: "🌙",
    accentHex: "#e11d48",
    ringGradient:
      "conic-gradient(from 0deg, #be123c, #fb7185, #09090b, #e11d48, #881337, #be123c)",
    glowRgba: "rgba(225, 29, 72, 0.45)",
    borderClass: "border-rose-500/50",
    badgeClass: "border-rose-500/40 bg-rose-500/15 text-rose-200",
  },
  {
    id: "domain_void",
    achievementId: "week_10h",
    category: "anime_game",
    inspiration: "JJK · Domain",
    name: "Infinite Void",
    tier: 5,
    description:
      "Limitless cerulean event-horizon waves expanding through cosmic infinity.",
    icon: "🌀",
    accentHex: "#38bdf8",
    ringGradient:
      "conic-gradient(from 0deg, #0284c7, #e0f2fe, #6366f1, #38bdf8, #1e1b4b, #0284c7)",
    glowRgba: "rgba(56, 189, 248, 0.46)",
    borderClass: "border-sky-400/50",
    badgeClass: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  },
  {
    id: "ki_surge",
    achievementId: "total_25h",
    category: "anime_game",
    inspiration: "Anime · Golden Aura",
    name: "Ki Surge",
    tier: 6,
    description:
      "Ascended golden battle aura flames paired with crackling plasma bolts.",
    icon: "⚡",
    accentHex: "#facc15",
    ringGradient:
      "conic-gradient(from 0deg, #eab308, #fef08a, #38bdf8, #facc15, #eab308)",
    glowRgba: "rgba(250, 204, 21, 0.48)",
    borderClass: "border-yellow-400/55",
    badgeClass: "border-yellow-400/45 bg-yellow-400/15 text-yellow-200",
  },
  {
    id: "domain_shrine",
    achievementId: "total_50h",
    category: "anime_game",
    inspiration: "JJK · Domain",
    name: "Malevolent Slash",
    tier: 7,
    description:
      "Relentless crimson cleave slashes slicing across a darkened Shrine abyss.",
    icon: "⛩️",
    accentHex: "#dc2626",
    ringGradient:
      "conic-gradient(from 0deg, #dc2626, #fca5a5, #18181b, #b91c1c, #f87171, #dc2626)",
    glowRgba: "rgba(220, 38, 38, 0.5)",
    borderClass: "border-red-500/55",
    badgeClass: "border-red-500/45 bg-red-500/15 text-red-200",
  },
  {
    id: "golden_grace",
    achievementId: "total_100h",
    category: "anime_game",
    inspiration: "Dark Fantasy",
    name: "Elden Grace",
    tier: 8,
    description:
      "Luminous Site-of-Grace golden mist rising from the Erdtree horizon.",
    icon: "✨",
    accentHex: "#fcd34d",
    ringGradient:
      "conic-gradient(from 0deg, #d97706, #fef08a, #a855f7, #fbbf24, #d97706)",
    glowRgba: "rgba(251, 191, 36, 0.5)",
    borderClass: "border-amber-300/55",
    badgeClass: "border-amber-300/45 bg-amber-400/15 text-amber-200",
  },
];

const BUNDLE_PREFIX = "STPE1:";
const PREF_STORAGE_KEY = "studytracker_profile_effect_pref";
const CUSTOM_GIF_STORAGE_KEY = "studytracker_profile_custom_gif";
const RESOLVED_STORAGE_KEY = "studytracker_resolved_profile_effect";
export const EFFECTS_DISABLED_STORAGE_KEY = "studytracker_effects_disabled";
const MAX_CUSTOM_GIF_BYTES = Math.round(1.8 * 1024 * 1024); // 1.8 MB animated GIF
const MAX_CUSTOM_STATIC_BYTES = 20 * 1024 * 1024;
const MAX_CUSTOM_BG_DIM = 480;
const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;
const GIF_BASE64_MAGIC = ";base64,R0lGOD";

export function getProfileEffectById(
  id: string | null | undefined
): ProfileEffectDefinition | null {
  if (!id) return null;
  return PROFILE_EFFECTS.find((effect) => effect.id === id) ?? null;
}

export function getProfileEffectForAchievement(
  achievementId: string
): ProfileEffectDefinition | null {
  return (
    PROFILE_EFFECTS.find((effect) => effect.achievementId === achievementId) ??
    null
  );
}

export function getProfileEffectsForAchievement(
  achievementId: string
): ProfileEffectDefinition[] {
  return PROFILE_EFFECTS.filter(
    (effect) => effect.achievementId === achievementId
  );
}

export function parseProfileEffectPreference(
  raw: string | null | undefined
): ProfileEffectPreference {
  if (!raw) return "auto";
  if (raw === "auto" || raw === "none") return raw;
  const matched = getProfileEffectById(raw);
  return matched ? matched.id : "auto";
}

export function encodeProfileEffectBundle(
  effectPref: ProfileEffectPreference,
  customGifUrl: string | null
): string {
  const safeGif =
    typeof customGifUrl === "string" && customGifUrl.startsWith("data:image/")
      ? customGifUrl
      : null;

  if (!safeGif) {
    return effectPref;
  }

  return `${BUNDLE_PREFIX}${JSON.stringify({
    e: effectPref,
    g: safeGif,
  })}`;
}

export function parseProfileEffectBundle(
  raw: string | null | undefined
): ProfileEffectBundle {
  if (!raw) {
    return { effectPref: "auto", customGifUrl: null };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { effectPref: "auto", customGifUrl: null };
  }

  if (trimmed.startsWith(BUNDLE_PREFIX)) {
    try {
      const parsed = JSON.parse(trimmed.slice(BUNDLE_PREFIX.length)) as {
        e?: unknown;
        g?: unknown;
      };
      const effectPref =
        typeof parsed?.e === "string"
          ? parseProfileEffectPreference(parsed.e)
          : "auto";
      const customGifUrl =
        typeof parsed?.g === "string" && parsed.g.startsWith("data:image/")
          ? parsed.g
          : null;
      return { effectPref, customGifUrl };
    } catch {
      return { effectPref: "auto", customGifUrl: null };
    }
  }

  // Upgrade legacy `gif:data:image/...` strings smoothly so users keep both
  if (trimmed.startsWith("gif:data:image/")) {
    return {
      effectPref: "auto",
      customGifUrl: trimmed.slice(4),
    };
  }

  return {
    effectPref: parseProfileEffectPreference(trimmed),
    customGifUrl: null,
  };
}

export function getHighestUnlockedEffect(
  unlockedAchievementIds: Iterable<string>
): ProfileEffectDefinition | null {
  const unlockedSet = new Set(unlockedAchievementIds);
  let best: ProfileEffectDefinition | null = null;
  for (const effect of PROFILE_EFFECTS) {
    if (unlockedSet.has(effect.achievementId)) {
      if (!best || effect.tier >= best.tier) {
        best = effect;
      }
    }
  }
  return best;
}

export function resolveActiveProfileEffect(
  preference: ProfileEffectPreference | string | null | undefined,
  unlockedAchievementIds: Iterable<string>
): ProfileEffectDefinition | null {
  const unlockedSet = new Set(unlockedAchievementIds);
  const pref = parseProfileEffectPreference(preference);

  if (pref === "none") {
    return null;
  }

  if (pref !== "auto") {
    const specific = getProfileEffectById(pref);
    if (specific && unlockedSet.has(specific.achievementId)) {
      return specific;
    }
  }

  return getHighestUnlockedEffect(unlockedSet);
}

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "" || file.type === "application/octet-stream") {
    return true;
  }
  return IMAGE_EXT_REGEX.test(file.name || "");
}

function isLikelyGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name || "");
}

function normalizeImageDataUrl(raw: string, forceGif: boolean): string {
  if (raw.includes(GIF_BASE64_MAGIC)) {
    return raw.replace(
      /^data:[^;]*;base64,/i,
      "data:image/gif;base64,"
    );
  }
  if (forceGif && /^data:application\/octet-stream;base64,/i.test(raw)) {
    return raw.replace(
      /^data:application\/octet-stream;base64,/i,
      "data:image/gif;base64,"
    );
  }
  return raw;
}

export function processCustomGifFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isLikelyImageFile(file)) {
      reject(
        new Error("Please select an image or animated GIF (GIF, PNG, JPG, WebP).")
      );
      return;
    }

    const declaredGif = isLikelyGifFile(file);
    if (declaredGif && file.size > MAX_CUSTOM_GIF_BYTES) {
      reject(new Error("Custom animated GIF must be under 1.8 MB."));
      return;
    }

    if (!declaredGif && file.size > MAX_CUSTOM_STATIC_BYTES) {
      reject(new Error("Image must be smaller than 20 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Could not read the selected image."));
    };
    reader.onload = () => {
      const raw = reader.result;
      if (typeof raw !== "string" || !raw.startsWith("data:")) {
        reject(new Error("Invalid or unsupported image format."));
        return;
      }

      const hasGifMagic = raw.includes(GIF_BASE64_MAGIC);
      if (declaredGif || hasGifMagic) {
        if (file.size > MAX_CUSTOM_GIF_BYTES) {
          reject(new Error("Custom animated GIF must be under 1.8 MB."));
          return;
        }
        resolve(normalizeImageDataUrl(raw, true));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        reject(new Error("Invalid or unsupported image format."));
      };
      img.onload = () => {
        const largestDim = Math.max(img.width, img.height, 1);
        const scale = Math.min(1, MAX_CUSTOM_BG_DIM / largestDim);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not initialize image canvas."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL("image/webp", 0.78);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        }
        resolve(dataUrl);
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

export function loadLocalProfileEffectBundle(): ProfileEffectBundle {
  if (typeof window === "undefined") {
    return { effectPref: "auto", customGifUrl: null };
  }
  try {
    const rawPref = window.localStorage.getItem(PREF_STORAGE_KEY);
    const rawGif = window.localStorage.getItem(CUSTOM_GIF_STORAGE_KEY);
    if (rawPref && rawPref.startsWith("gif:data:image/")) {
      return {
        effectPref: "auto",
        customGifUrl: rawPref.slice(4),
      };
    }
    return {
      effectPref: parseProfileEffectPreference(rawPref),
      customGifUrl:
        rawGif && rawGif.startsWith("data:image/") ? rawGif : null,
    };
  } catch {
    return { effectPref: "auto", customGifUrl: null };
  }
}

export function saveLocalProfileEffectBundle(bundle: ProfileEffectBundle) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_STORAGE_KEY, bundle.effectPref);
    if (bundle.customGifUrl) {
      window.localStorage.setItem(CUSTOM_GIF_STORAGE_KEY, bundle.customGifUrl);
    } else {
      window.localStorage.removeItem(CUSTOM_GIF_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / private-mode errors
  }
}

export function loadResolvedActiveEffectId(): ProfileEffectId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RESOLVED_STORAGE_KEY);
    return getProfileEffectById(raw)?.id ?? null;
  } catch {
    return null;
  }
}

export function saveResolvedActiveEffectId(effectId: ProfileEffectId | null) {
  if (typeof window === "undefined") return;
  try {
    if (effectId) {
      window.localStorage.setItem(RESOLVED_STORAGE_KEY, effectId);
    } else {
      window.localStorage.removeItem(RESOLVED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function notifyProfileEffectBundleUpdated(
  bundle: ProfileEffectBundle,
  resolvedEffectId: ProfileEffectId | null
) {
  saveLocalProfileEffectBundle(bundle);
  saveResolvedActiveEffectId(resolvedEffectId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("profile-effect-updated", {
        detail: {
          preference: bundle.effectPref,
          customGifUrl: bundle.customGifUrl,
          resolvedEffectId,
        },
      })
    );
  }
}

export function loadEffectsDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EFFECTS_DISABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveEffectsDisabled(disabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (disabled) {
      window.localStorage.setItem(EFFECTS_DISABLED_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(EFFECTS_DISABLED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function notifyEffectsDisabledUpdated(disabled: boolean) {
  saveEffectsDisabled(disabled);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("profile-effects-disabled-updated", {
        detail: { disabled },
      })
    );
  }
}
