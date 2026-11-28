"use client";

import { useEffect, useState } from "react";
import { useEffectsDisabled } from "@/components/use-effects-disabled";

type CustomGifBannerProps = {
  gifUrl: string | null | undefined;
  username?: string | null;
  sizeClass?: string;
  ignoreGlobalDisable?: boolean;
};

export default function CustomGifBanner({
  gifUrl,
  username,
  sizeClass = "h-32 w-full sm:h-auto sm:w-28 md:w-32",
  ignoreGlobalDisable = false,
}: CustomGifBannerProps) {
  const effectsDisabled = useEffectsDisabled();
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

  if (!gifUrl || (effectsDisabled && !ignoreGlobalDisable)) {
    return null;
  }

  const cleanName = (username || "student").replace(/^@+/, "");

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label={`View full GIF for @${cleanName}`}
        className={`group relative shrink-0 overflow-hidden rounded-xl border border-white/15 bg-[#09090b]/90 shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition hover:border-white/30 focus:outline-none ${sizeClass}`}
      >
        {/* Ambient blurred fill using the GIF's own palette */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gifUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-lg"
        />

        {/* Full uncropped GIF */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gifUrl}
          alt={`@${cleanName} animated GIF`}
          className="relative z-10 h-full w-full object-contain"
        />

        <span className="pointer-events-none absolute right-1.5 top-1.5 z-20 inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/20 bg-black/70 text-[10px] font-semibold text-white/85 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          ↗
        </span>
      </button>

      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`@${cleanName} full GIF`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#111113] shadow-2xl"
          >
            <div className="bg-[#09090b] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gifUrl}
                alt={`@${cleanName} full GIF`}
                className="mx-auto max-h-[75vh] w-full rounded-xl object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-white/65">
                <span className="font-mono font-semibold text-white">
                  @{cleanName}
                </span>
                <span>·</span>
                <span>Profile GIF</span>
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
      )}
    </>
  );
}
