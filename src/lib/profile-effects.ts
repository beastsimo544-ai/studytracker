export type ProfileEffectId =
  | "spark_emerald"
  | "cyber_volt"
  | "ember_blaze"
  | "starlight_aura"
  | "arcane_aurora"
  | "solar_flare"
  | "crystal_prism"
  | "royal_ascension";

export type ProfileEffectPreference = "auto" | "none" | ProfileEffectId;

export type ProfileEffectDefinition = {
  id: ProfileEffectId;
  achievementId: string;
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
  {
    id: "spark_emerald",
    achievementId: "first_session",
    name: "Emerald Spark",
    tier: 1,
    description: "Drifting emerald focus motes with a soft neon rim pulse.",
    icon: "🎯",
    accentHex: "#34d399",
    ringGradient:
      "conic-gradient(from 0deg, #10b981, #6ee7b7, #059669, #34d399, #10b981)",
    glowRgba: "rgba(16, 185, 129, 0.35)",
    borderClass: "border-emerald-400/35",
    badgeClass:
      "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
  },
  {
    id: "cyber_volt",
    achievementId: "deep_focus",
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
    name: "Crystal Prism",
    tier: 7,
    description: "Iridescent diamond shimmer with refracting holographic facets.",
    icon: "💎",
    accentHex: "#e879f9",
    ringGradient:
      "conic-gradient(from 0deg, #e879f9, #38bdf8, #818cf8, #f472b6, #e879f9)",
    glowRgba: "rgba(232, 121, 249, 0.44)",
    borderClass: "border-fuchsia-400/50",
    badgeClass:
      "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200",
  },
  {
    id: "royal_ascension",
    achievementId: "total_100h",
    name: "Royal Ascension",
    tier: 8,
    description: "Mythic gold & violet crown cascade with a double metallic sheen.",
    icon: "👑",
    accentHex: "#fde047",
    ringGradient:
      "conic-gradient(from 0deg, #facc15, #f59e0b, #c084fc, #fef08a, #facc15)",
    glowRgba: "rgba(250, 204, 21, 0.48)",
    borderClass: "border-yellow-400/55",
    badgeClass: "border-yellow-400/45 bg-yellow-400/15 text-yellow-200",
  },
];

const PREF_STORAGE_KEY = "studytracker_profile_effect_pref";
const RESOLVED_STORAGE_KEY = "studytracker_resolved_profile_effect";

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

export function parseProfileEffectPreference(
  raw: string | null | undefined
): ProfileEffectPreference {
  if (!raw) return "auto";
  if (raw === "auto" || raw === "none") return raw;
  const matched = getProfileEffectById(raw);
  return matched ? matched.id : "auto";
}

export function getHighestUnlockedEffect(
  unlockedAchievementIds: Iterable<string>
): ProfileEffectDefinition | null {
  const unlockedSet = new Set(unlockedAchievementIds);
  for (let i = PROFILE_EFFECTS.length - 1; i >= 0; i -= 1) {
    if (unlockedSet.has(PROFILE_EFFECTS[i].achievementId)) {
      return PROFILE_EFFECTS[i];
    }
  }
  return null;
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

export function loadLocalProfileEffectPref(): ProfileEffectPreference {
  if (typeof window === "undefined") return "auto";
  try {
    return parseProfileEffectPreference(
      window.localStorage.getItem(PREF_STORAGE_KEY)
    );
  } catch {
    return "auto";
  }
}

export function saveLocalProfileEffectPref(pref: ProfileEffectPreference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_STORAGE_KEY, pref);
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

export function notifyProfileEffectUpdated(
  pref: ProfileEffectPreference,
  resolvedEffectId: ProfileEffectId | null
) {
  saveLocalProfileEffectPref(pref);
  saveResolvedActiveEffectId(resolvedEffectId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("profile-effect-updated", {
        detail: { preference: pref, resolvedEffectId },
      })
    );
  }
}
