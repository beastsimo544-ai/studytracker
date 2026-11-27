"use client";

import { useState } from "react";
import UserAvatar from "@/components/user-avatar";

export type ChampionQuoteInfo = {
  username: string;
  avatarUrl: string | null;
  isSelf: boolean;
  weekSecondsLabel: string;
  quote: string | null;
};

export default function ChampionQuoteBanner({
  scopeLabel,
  champion,
  onSaveQuote,
  isSaving,
}: {
  scopeLabel: string;
  champion: ChampionQuoteInfo | null;
  onSaveQuote: (nextQuote: string) => Promise<boolean>;
  isSaving: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!champion) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3.5 text-xs text-amber-200/80">
        👑 Study this week to claim <strong>#1</strong> and post a Champion
        Quote for everyone to see.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const ok = await onSaveQuote(draft);
    if (ok) {
      setIsEditing(false);
    }
  };

  return (
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
              className="!h-5 !w-5 !text-[10px]"
            />
            <span className="font-mono text-xs font-semibold text-white">
              @{champion.username}
            </span>
            <span className="text-[11px] tabular-nums text-amber-200/80">
              · {champion.weekSecondsLabel}
            </span>
          </div>
        </div>

        {champion.isSelf && !isEditing && (
          <button
            type="button"
            onClick={() => {
              setDraft(champion.quote ?? "");
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
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={140}
            autoFocus
            placeholder="Drop a quote for everyone to see..."
            className="h-10 w-full rounded-xl border border-amber-400/25 bg-[#09090b] px-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-400/50"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] tabular-nums text-white/40">
              {draft.trim().length}/140
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-8 rounded-lg border border-white/12 px-3 text-xs text-white/70 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-8 rounded-lg bg-amber-400 px-3.5 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Quote"}
              </button>
            </div>
          </div>
        </form>
      ) : champion.quote ? (
        <p className="mt-3 text-sm font-medium leading-relaxed text-white sm:text-base">
          &ldquo;{champion.quote}&rdquo;
        </p>
      ) : champion.isSelf ? (
        <p className="mt-2.5 text-xs text-white/55">
          You&apos;re #1! Write a quote to motivate your friends.
        </p>
      ) : (
        <p className="mt-2.5 text-xs text-white/45">
          @{champion.username} hasn&apos;t written a champion quote yet.
        </p>
      )}
    </div>
  );
}
