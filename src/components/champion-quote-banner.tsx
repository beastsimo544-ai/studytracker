"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/user-avatar";
import {
  resizeQuoteImageFile,
  type ChampionQuoteDraft,
} from "@/lib/champion-quote";
import type { ProfileEffectValue } from "@/lib/profile-effects";

export type ChampionQuoteInfo = {
  username: string;
  avatarUrl: string | null;
  effectId?: ProfileEffectValue | null;
  isSelf: boolean;
  scoreLabel: string;
  quote: string | null;
  imageUrl: string | null;
};

export default function ChampionQuoteBanner({
  scopeLabel,
  champion,
  onSaveQuote,
  isSaving,
}: {
  scopeLabel: string;
  champion: ChampionQuoteInfo | null;
  onSaveQuote: (draft: ChampionQuoteDraft) => Promise<boolean>;
  isSaving: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [imageDraft, setImageDraft] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen]);

  if (!champion) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3.5 text-xs text-amber-200/80">
        👑 Study today to claim <strong>#1</strong> and post today&apos;s
        Champion Quote for everyone to see.
      </div>
    );
  }

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageError("");
    setIsProcessingImage(true);
    try {
      const resized = await resizeQuoteImageFile(file);
      setImageDraft(resized);
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Could not process image."
      );
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isProcessingImage) return;

    const cleanedText = draft.trim();
    const ok = await onSaveQuote({
      text: cleanedText,
      imageUrl: cleanedText ? imageDraft : null,
    });
    if (ok) {
      setIsEditing(false);
      setImageError("");
    }
  };

  const handleClearQuote = async () => {
    if (isSaving || isProcessingImage) return;
    const ok = await onSaveQuote({ text: "", imageUrl: null });
    if (ok) {
      setDraft("");
      setImageDraft(null);
      setImageError("");
      setIsEditing(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.10] via-[#111113] to-[#111113] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              👑 {scopeLabel}
            </span>

            <div className="flex items-center gap-1.5">
              <UserAvatar
                avatarUrl={champion.avatarUrl}
                name={champion.username}
                size="xs"
                effectId={champion.effectId ?? null}
                className="!h-5 !w-5 !text-[10px]"
              />
              <span className="font-mono text-xs font-semibold text-white">
                @{champion.username}
              </span>
              <span className="text-[11px] tabular-nums text-amber-200/80">
                · {champion.scoreLabel}
              </span>
            </div>
          </div>

          {champion.isSelf && !isEditing && (
            <button
              type="button"
              onClick={() => {
                setDraft(champion.quote ?? "");
                setImageDraft(champion.imageUrl ?? null);
                setImageError("");
                setIsEditing(true);
              }}
              className="h-8 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20"
            >
              {champion.quote ? "Edit Quote" : "Write Quote"}
            </button>
          )}
        </div>

        {champion.isSelf && isEditing ? (
          <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={140}
                autoFocus
                placeholder="Drop today's quote for everyone to see..."
                className="h-10 min-w-0 flex-1 rounded-xl border border-amber-400/25 bg-[#09090b] px-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/50"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              <button
                type="button"
                disabled={isProcessingImage || isSaving}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-[#09090b] px-3.5 text-xs font-semibold text-amber-200 transition hover:border-amber-400/55 hover:bg-amber-400/10 disabled:opacity-50"
              >
                <span aria-hidden="true">📷</span>
                <span>
                  {isProcessingImage
                    ? "Processing..."
                    : imageDraft
                      ? "Change Photo"
                      : "Add Photo"}
                </span>
              </button>
            </div>

            {imageDraft && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-[#09090b] p-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageDraft}
                    alt="Temporary quote attachment preview"
                    className="h-14 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-amber-200">
                      Temporary quote photo attached
                    </p>
                    <p className="text-[11px] text-white/50">
                      Auto-removes when today&apos;s quote resets or is cleared.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setImageDraft(null)}
                  className="h-7 shrink-0 rounded-lg border border-white/12 px-2.5 text-[11px] text-white/65 transition hover:border-red-400/35 hover:text-red-300"
                >
                  Remove photo
                </button>
              </div>
            )}

            {imageDraft && !draft.trim() && (
              <p className="text-[11px] text-amber-300/85">
                Write a short quote above — clearing the quote removes the
                picture too.
              </p>
            )}

            {imageError && (
              <p className="text-xs text-red-400">{imageError}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] tabular-nums text-white/40">
                {draft.trim().length}/140
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {champion.quote && (
                  <button
                    type="button"
                    disabled={isSaving || isProcessingImage}
                    onClick={handleClearQuote}
                    className="h-8 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Clear Quote
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setImageError("");
                    setIsEditing(false);
                  }}
                  className="h-8 rounded-lg border border-white/12 px-3 text-xs text-white/70 transition hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isProcessingImage}
                  className="h-8 rounded-lg bg-amber-400 px-3.5 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Quote"}
                </button>
              </div>
            </div>
          </form>
        ) : champion.quote ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium leading-relaxed text-white sm:text-base">
              &ldquo;{champion.quote}&rdquo;
            </p>

            {champion.imageUrl && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                title="View temporary photo"
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-amber-400/35 bg-[#09090b] transition hover:border-amber-300 sm:h-20 sm:w-20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={champion.imageUrl}
                  alt={`Temporary photo by @${champion.username}`}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[9px] font-medium text-amber-200">
                  Today
                </span>
              </button>
            )}
          </div>
        ) : champion.isSelf ? (
          <p className="mt-2.5 text-xs text-white/55">
            You&apos;re #1 today! Write today&apos;s quote and optionally attach
            a temporary daily picture.
          </p>
        ) : (
          <p className="mt-2.5 text-xs text-white/45">
            @{champion.username} hasn&apos;t written today&apos;s quote yet.
          </p>
        )}
      </div>

      {lightboxOpen && champion.imageUrl && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Temporary champion quote photo"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#111113] shadow-2xl"
          >
            <div className="bg-[#09090b] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={champion.imageUrl}
                alt={`Temporary quote photo by @${champion.username}`}
                className="max-h-[65vh] w-full rounded-xl object-contain"
              />
            </div>

            <div className="space-y-3 p-4">
              {champion.quote && (
                <p className="text-sm font-medium leading-relaxed text-white">
                  &ldquo;{champion.quote}&rdquo;
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span className="font-mono font-semibold text-white">
                    @{champion.username}
                  </span>
                  <span>·</span>
                  <span className="text-amber-200/80">
                    Temporary today · resets with quote
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="h-8 rounded-lg border border-white/15 px-3 text-xs font-medium text-white/80 transition hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
