"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import ProfileEffectOverlay from "@/components/profile-effect-overlay";
import UserAvatar from "@/components/user-avatar";
import type { Achievement } from "@/lib/achievements";
import {
  getProfileEffectById,
  notifyProfileEffectUpdated,
  PROFILE_EFFECTS,
  resolveActiveProfileEffect,
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
  onPreferenceChange: (
    nextPref: ProfileEffectPreference,
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
  onPreferenceChange,
}: ProfileEffectPickerProps) {
  const { toast } = useNotifications();
  const [previewLockedId, setPreviewLockedId] =
    useState<ProfileEffectId | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const activeEffect = resolveActiveProfileEffect(
    preference,
    unlockedAchievementIds
  );
  const previewEffect = previewLockedId
    ? getProfileEffectById(previewLockedId)
    : activeEffect;

  const unlockedBadges = achievements.filter((a) => a.unlocked);

  const persistPreference = async (nextPref: ProfileEffectPreference) => {
    setPreviewLockedId(null);
    const nextResolved =
      resolveActiveProfileEffect(nextPref, unlockedAchievementIds)?.id ?? null;

    notifyProfileEffectUpdated(nextPref, nextResolved);
    onPreferenceChange(nextPref, nextResolved);

    if (!userId) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ profile_effect: nextPref })
      .eq("user_id", userId);
    setIsSaving(false);

    if (error && !error.message.includes("profile_effect") && error.code !== "42703") {
      toast.error("Could not sync profile effect", error.message);
      return;
    }

    if (nextPref === "none") {
      toast.info("Profile effect turned off");
    } else if (nextPref === "auto") {
      toast.success("Auto effect enabled", "Shows your highest unlocked effect.");
    } else {
      const chosen = getProfileEffectById(nextPref);
      if (chosen) {
        toast.success(`${chosen.icon} ${chosen.name} equipped!`);
      }
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Live Discord-style Profile Preview Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border bg-[#09090b] p-4 sm:p-5 transition-colors ${
          previewEffect ? previewEffect.borderClass : "border-white/[0.08]"
        }`}
      >
        <ProfileEffectOverlay
          effectId={previewEffect?.id ?? null}
          intensity="strong"
        />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <UserAvatar
              avatarUrl={avatarUrl}
              name={username || "you"}
              size="lg"
              effectId={previewEffect?.id ?? null}
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-mono text-sm font-bold text-white sm:text-base">
                  @{username || "student"}
                </span>
                {unlockedBadges.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[11px]">
                    {unlockedBadges.map((b) => (
                      <span key={b.id} title={b.title}>
                        {b.icon}
                      </span>
                    ))}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {previewLockedId && previewEffect ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${previewEffect.badgeClass}`}
                  >
                    🔒 Previewing locked: {previewEffect.name}
                  </span>
                ) : previewEffect ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${previewEffect.badgeClass}`}
                  >
                    {previewEffect.icon} Active: {previewEffect.name}
                    {preference === "auto" ? " (Auto)" : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-white/60">
                    No effect equipped
                  </span>
                )}
              </div>
            </div>
          </div>

          {previewLockedId && (
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

      {/* Mode Selector Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => persistPreference("auto")}
            className={`h-8 rounded-xl border px-3 text-xs font-semibold transition ${
              preference === "auto"
                ? "border-white/35 bg-white text-black"
                : "border-white/12 bg-[#09090b] text-white/75 hover:border-white/25 hover:text-white"
            }`}
          >
            ✨ Auto (Highest Unlocked)
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => persistPreference("none")}
            className={`h-8 rounded-xl border px-3 text-xs font-semibold transition ${
              preference === "none"
                ? "border-white/35 bg-white text-black"
                : "border-white/12 bg-[#09090b] text-white/75 hover:border-white/25 hover:text-white"
            }`}
          >
            None
          </button>
        </div>

        <span className="text-[11px] text-white/45 tabular-nums">
          {unlockedBadges.length} / {PROFILE_EFFECTS.length} unlocked
        </span>
      </div>

      {/* 8 Achievement Profile Effects Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {PROFILE_EFFECTS.map((effect) => {
          const achievement = achievementById.get(effect.achievementId);
          const isUnlocked = Boolean(achievement?.unlocked);
          const isEquipped =
            preference !== "none" && activeEffect?.id === effect.id;
          const isPreviewingLocked = previewLockedId === effect.id;

          return (
            <button
              key={effect.id}
              type="button"
              disabled={isSaving}
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
                  persistPreference(effect.id);
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
                    🔒 Preview
                  </span>
                )}
              </div>

              <div className="relative z-10 mt-2.5">
                <p className="text-xs font-semibold text-white">{effect.name}</p>
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
              Profile Effects ✨
            </h2>
            <p className="mt-0.5 text-xs text-white/55">
              Unlock animated Discord-style profile effects by earning
              study achievements. Tap a locked effect to preview it live.
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
