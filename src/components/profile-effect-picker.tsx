"use client";

import { useEffect, useId, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import ProfileEffectOverlay from "@/components/profile-effect-overlay";
import { useEffectsDisabled } from "@/components/use-effects-disabled";
import UserAvatar from "@/components/user-avatar";
import type { Achievement } from "@/lib/achievements";
import {
  encodeProfileEffectBundle,
  getProfileEffectById,
  notifyEffectsDisabledUpdated,
  notifyProfileEffectBundleUpdated,
  processCustomGifFile,
  PROFILE_EFFECTS,
  resolveActiveProfileEffect,
  type ProfileEffectBundle,
  type ProfileEffectCategory,
  type ProfileEffectId,
  type ProfileEffectPreference,
} from "@/lib/profile-effects";
import { supabase } from "@/lib/supabase";

type ProfileEffectPickerProps = {
  open?: boolean;
  onClose?: () => void;
  mode: "inline" | "modal";
  userId: string | null;
  username: string | null;
  avatarUrl: string | null;
  achievements: Achievement[];
  preference: ProfileEffectPreference;
  customGifUrl: string | null;
  onBundleChange: (
    nextBundle: ProfileEffectBundle,
    resolvedEffectId: ProfileEffectId | null
  ) => void;
};

export default function ProfileEffectPicker({
  open = true,
  onClose,
  mode,
  userId,
  username,
  avatarUrl,
  achievements,
  preference,
  customGifUrl,
  onBundleChange,
}: ProfileEffectPickerProps) {
  const { toast } = useNotifications();
  const effectsDisabled = useEffectsDisabled();
  const customFileInputId = useId();
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | ProfileEffectCategory
  >("all");
  const [previewLockedId, setPreviewLockedId] =
    useState<ProfileEffectId | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingCustom, setIsProcessingCustom] = useState(false);
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    if (mode !== "modal" || !open || !onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewLockedId(null);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, open, onClose]);

  if (mode === "modal" && !open) {
    return null;
  }

  const achievementById = new Map(achievements.map((a) => [a.id, a]));
  const unlockedAchievementIds = achievements
    .filter((a) => a.unlocked)
    .map((a) => a.id);
  const unlockedSet = new Set(unlockedAchievementIds);

  const activeEffect = resolveActiveProfileEffect(
    preference,
    unlockedAchievementIds
  );
  const previewEffect = effectsDisabled
    ? null
    : previewLockedId
      ? getProfileEffectById(previewLockedId)
      : activeEffect;

  const unlockedBadges = achievements.filter((a) => a.unlocked);
  const unlockedEffectsCount = PROFILE_EFFECTS.filter((e) =>
    unlockedSet.has(e.achievementId)
  ).length;

  const visibleEffects = PROFILE_EFFECTS.filter((effect) =>
    categoryFilter === "all" ? true : effect.category === categoryFilter
  );

  const handleToggleEffectsDisabled = () => {
    const nextDisabled = !effectsDisabled;
    notifyEffectsDisabledUpdated(nextDisabled);
    if (nextDisabled) {
      toast.info(
        "Distraction-free mode enabled",
        "All profile effects and GIF panels are now hidden for you."
      );
    } else {
      toast.success("Profile effects re-enabled");
    }
  };

  const persistBundle = async (
    nextEffectPref: ProfileEffectPreference,
    nextCustomGifUrl: string | null,
    toastLabel?: "gif_saved" | "gif_removed" | "effect"
  ) => {
    setPreviewLockedId(null);
    setCustomError("");

    const nextBundle: ProfileEffectBundle = {
      effectPref: nextEffectPref,
      customGifUrl: nextCustomGifUrl,
    };
    const nextResolved =
      resolveActiveProfileEffect(nextEffectPref, unlockedAchievementIds)?.id ??
      null;

    notifyProfileEffectBundleUpdated(nextBundle, nextResolved);
    onBundleChange(nextBundle, nextResolved);

    if (effectsDisabled && (nextEffectPref !== "none" || nextCustomGifUrl)) {
      notifyEffectsDisabledUpdated(false);
    }

    if (!userId) return;

    setIsSaving(true);
    const encoded = encodeProfileEffectBundle(nextEffectPref, nextCustomGifUrl);
    const { error } = await supabase
      .from("profiles")
      .update({ profile_effect: encoded })
      .eq("user_id", userId);
    setIsSaving(false);

    if (
      error &&
      !error.message.includes("profile_effect") &&
      error.code !== "42703"
    ) {
      toast.error("Could not sync profile effect", error.message);
      return;
    }

    if (toastLabel === "gif_saved") {
      toast.success("Profile banner GIF updated!");
      return;
    }
    if (toastLabel === "gif_removed") {
      toast.info("Profile GIF removed");
      return;
    }

    if (nextEffectPref === "none") {
      toast.info("Background effect turned off");
    } else if (nextEffectPref === "auto") {
      toast.success("Auto effect enabled", "Shows your highest unlocked effect.");
    } else {
      const chosen = getProfileEffectById(nextEffectPref);
      if (chosen) {
        toast.success(`${chosen.icon} ${chosen.name} equipped!`);
      }
    }
  };

  const handleCustomGifUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setCustomError("");
    setIsProcessingCustom(true);
    try {
      const dataUrl = await processCustomGifFile(file);
      await persistBundle(preference, dataUrl, "gif_saved");
    } catch (err) {
      setCustomError(
        err instanceof Error ? err.message : "Could not process selected GIF."
      );
    } finally {
      input.value = "";
      setIsProcessingCustom(false);
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Global Distraction-Free Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">
            Distraction-free mode (Disable all effects)
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">
            Hides all animated background effects, avatar rings, and profile
            GIFs for a clean minimal view.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={effectsDisabled}
          onClick={handleToggleEffectsDisabled}
          className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
            effectsDisabled
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-white/15 bg-white/[0.05] text-white/80 hover:border-white/30 hover:text-white"
          }`}
        >
          <span>{effectsDisabled ? "Effects Off ✓" : "Disable All"}</span>
        </button>
      </div>

      {/* Live Discord-style Profile Banner Preview Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border bg-[#09090b] transition-colors ${
          previewEffect ? previewEffect.borderClass : "border-white/[0.08]"
        }`}
      >
        <ProfileEffectOverlay
          effectId={previewEffect?.id ?? null}
          intensity="strong"
        />

        {/* Banner Background */}
        <div className="relative h-28 w-full overflow-hidden">
          {!effectsDisabled && customGifUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customGifUrl}
              alt={`@${username || "student"} banner preview`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-full w-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%),linear-gradient(180deg,#18181b_0%,#09090b_100%)]"
            />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/30 to-transparent"
          />
        </div>

        {/* Overlapping Avatar + Identity */}
        <div className="relative z-10 px-4 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 items-end gap-3.5">
              <div className="-mt-9 rounded-full bg-[#09090b] p-1 shadow-xl">
                <UserAvatar
                  avatarUrl={avatarUrl}
                  name={username || "you"}
                  size="lg"
                  effectId={previewEffect?.id ?? null}
                />
              </div>

              <div className="min-w-0 pb-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-mono text-sm font-bold text-white sm:text-base">
                    @{username || "student"}
                  </span>
                  <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60 tabular-nums">
                    {unlockedBadges.length} badges
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {effectsDisabled ? (
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-white/65">
                      Distraction-free mode ON · all effects hidden
                    </span>
                  ) : previewLockedId && previewEffect ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${previewEffect.badgeClass}`}
                    >
                      Locked Preview: {previewEffect.name}
                    </span>
                  ) : previewEffect ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${previewEffect.badgeClass}`}
                    >
                      Active: {previewEffect.name}
                      {preference === "auto" ? " (Auto)" : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-white/60">
                      No background effect
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!effectsDisabled && previewLockedId && (
              <button
                type="button"
                onClick={() => setPreviewLockedId(null)}
                className="h-8 rounded-lg border border-white/15 bg-black/40 px-3 text-xs font-medium text-white/80 transition hover:text-white"
              >
                Reset preview
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mode Selector + Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSaving || isProcessingCustom}
            onClick={() => persistBundle("auto", customGifUrl, "effect")}
            className={`h-8 rounded-xl border px-3 text-xs font-semibold transition ${
              preference === "auto"
                ? "border-white/35 bg-white text-black"
                : "border-white/12 bg-[#09090b] text-white/75 hover:border-white/25 hover:text-white"
            }`}
          >
            Auto (Highest Unlocked)
          </button>

          <button
            type="button"
            disabled={isSaving || isProcessingCustom}
            onClick={() => persistBundle("none", customGifUrl, "effect")}
            className={`h-8 rounded-xl border px-3 text-xs font-semibold transition ${
              preference === "none"
                ? "border-white/35 bg-white text-black"
                : "border-white/12 bg-[#09090b] text-white/75 hover:border-white/25 hover:text-white"
            }`}
          >
            No Background Effect
          </button>
        </div>

        <span className="text-[11px] tabular-nums text-white/45">
          {unlockedEffectsCount} / {PROFILE_EFFECTS.length} effects unlocked
        </span>
      </div>

      {/* Profile Banner GIF Upload (Discord-style banner background) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">
            Profile Banner GIF
          </p>
          <p className="mt-0.5 text-[11px] text-white/55">
            Displayed as your Discord-style animated profile banner background
            (up to 1.8 MB).
          </p>
          {customError && (
            <p className="mt-1 text-[11px] text-red-400">{customError}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            id={customFileInputId}
            type="file"
            accept="image/*"
            disabled={isSaving || isProcessingCustom}
            onChange={handleCustomGifUpload}
            className="sr-only"
          />

          <label
            htmlFor={customFileInputId}
            className={`inline-flex h-8 cursor-pointer items-center rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15 ${
              isSaving || isProcessingCustom
                ? "pointer-events-none opacity-50"
                : ""
            }`}
          >
            {isProcessingCustom
              ? "Processing..."
              : customGifUrl
                ? "Change Banner GIF"
                : "Upload Banner GIF"}
          </label>

          {customGifUrl && (
            <button
              type="button"
              disabled={isSaving || isProcessingCustom}
              onClick={() => persistBundle(preference, null, "gif_removed")}
              className="h-8 rounded-lg border border-white/15 px-3 text-xs text-white/75 transition hover:border-red-400/35 hover:text-red-300 disabled:opacity-50"
            >
              Remove GIF
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#09090b] p-1">
        {(
          [
            { key: "all", label: `All (${PROFILE_EFFECTS.length})` },
            {
              key: "anime_game",
              label: `Anime & Games (${PROFILE_EFFECTS.filter((e) => e.category === "anime_game").length})`,
            },
            {
              key: "classic",
              label: `Classic (${PROFILE_EFFECTS.filter((e) => e.category === "classic").length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategoryFilter(tab.key)}
            className={`h-7 rounded-lg px-3 text-xs font-semibold transition ${
              categoryFilter === tab.key
                ? "bg-white text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Built-In Achievement Profile Effects Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {visibleEffects.map((effect) => {
          const achievement = achievementById.get(effect.achievementId);
          const isUnlocked = Boolean(achievement?.unlocked);
          const isEquipped =
            preference !== "none" && activeEffect?.id === effect.id;
          const isPreviewingLocked = previewLockedId === effect.id;

          return (
            <button
              key={effect.id}
              type="button"
              disabled={isSaving || isProcessingCustom}
              onMouseEnter={() => {
                if (!isUnlocked) setPreviewLockedId(effect.id);
              }}
              onMouseLeave={() => {
                if (!isUnlocked && previewLockedId === effect.id) {
                  setPreviewLockedId(null);
                }
              }}
              onClick={() => {
                if (isUnlocked) {
                  persistBundle(effect.id, customGifUrl, "effect");
                } else {
                  setPreviewLockedId((prev) =>
                    prev === effect.id ? null : effect.id
                  );
                }
              }}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 text-left transition ${
                isEquipped
                  ? `${effect.borderClass} bg-white/[0.06] ring-1 ring-white/40`
                  : isPreviewingLocked
                    ? `${effect.borderClass} bg-white/[0.04]`
                    : isUnlocked
                      ? "border-white/12 bg-[#09090b] hover:border-white/30"
                      : "border-white/[0.07] bg-[#09090b]/80 opacity-75 hover:opacity-100"
              }`}
            >
              <ProfileEffectOverlay
                effectId={effect.id}
                ignoreGlobalDisable
                intensity={isEquipped || isPreviewingLocked ? "strong" : "normal"}
              />

              <div className="relative z-10 flex items-center justify-between gap-1">
                <span className="text-lg">{effect.icon}</span>
                {isEquipped ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">
                    Active
                  </span>
                ) : isUnlocked ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                    Unlocked
                  </span>
                ) : (
                  <span className="rounded-full border border-white/15 bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                    Preview
                  </span>
                )}
              </div>

              <div className="relative z-10 mt-2.5">
                {effect.inspiration && (
                  <span className="inline-block rounded border border-white/15 bg-black/45 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/75">
                    {effect.inspiration}
                  </span>
                )}
                <p className="mt-1 text-xs font-semibold text-white">
                  {effect.name}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-white/60">
                  {isUnlocked
                    ? effect.description
                    : `${achievement?.title ?? "Achievement"} · ${
                        achievement?.progressText ?? "Locked"
                      }`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (mode === "inline") {
    return content;
  }

  return (
    <div
      onClick={() => {
        setPreviewLockedId(null);
        onClose?.();
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-effect-picker-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/12 bg-[#111113] p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="profile-effect-picker-title"
              className="text-lg font-bold text-white"
            >
              Profile Effects
            </h2>
            <p className="mt-0.5 text-xs text-white/55">
              Equip your unlocked Classic or Anime &amp; Game background effect,
              pair it with a Discord-style banner GIF, or switch to
              distraction-free mode.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPreviewLockedId(null);
              onClose?.();
            }}
            className="h-8 shrink-0 rounded-lg border border-white/12 px-3 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white"
          >
            Done
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}
