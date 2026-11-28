"use client";

import type { CSSProperties } from "react";
import {
  getProfileEffectById,
  type ProfileEffectId,
} from "@/lib/profile-effects";

type ProfileEffectOverlayProps = {
  effectId: ProfileEffectId | null | undefined;
  intensity?: "normal" | "strong";
};

const RISING_PARTICLES = [
  { left: "8%", size: 4, dur: "3.4s", delay: "0s", drift: "8px" },
  { left: "21%", size: 5, dur: "4.3s", delay: "0.9s", drift: "-7px" },
  { left: "34%", size: 3, dur: "3.7s", delay: "1.6s", drift: "5px" },
  { left: "49%", size: 5, dur: "4.6s", delay: "0.4s", drift: "-9px" },
  { left: "63%", size: 4, dur: "3.9s", delay: "2.1s", drift: "10px" },
  { left: "77%", size: 3, dur: "3.5s", delay: "1.1s", drift: "-6px" },
  { left: "89%", size: 5, dur: "4.2s", delay: "0.7s", drift: "7px" },
];

const STAR_POINTS = [
  { top: "14%", left: "12%", size: 12, dur: "2.6s", delay: "0.1s" },
  { top: "24%", left: "79%", size: 14, dur: "3.1s", delay: "0.8s" },
  { top: "62%", left: "88%", size: 11, dur: "2.4s", delay: "1.3s" },
  { top: "70%", left: "18%", size: 13, dur: "3.3s", delay: "0.5s" },
  { top: "18%", left: "52%", size: 10, dur: "2.9s", delay: "1.7s" },
  { top: "48%", left: "66%", size: 12, dur: "2.7s", delay: "1.1s" },
];

function FourPointStar({
  className = "",
  color,
  size,
}: {
  className?: string;
  color: string;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 1L14.6 9.4L23 12L14.6 14.6L12 23L9.4 14.6L1 12L9.4 9.4L12 1Z"
        fill={color}
      />
    </svg>
  );
}

export function ProfileEffectPill({
  effectId,
}: {
  effectId: ProfileEffectId | null | undefined;
}) {
  const effect = getProfileEffectById(effectId);
  if (!effect) return null;

  return (
    <span
      title={`${effect.name} — ${effect.description}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${effect.badgeClass}`}
    >
      <span aria-hidden="true">{effect.icon}</span>
      <span>{effect.name}</span>
    </span>
  );
}

export default function ProfileEffectOverlay({
  effectId,
  intensity = "normal",
}: ProfileEffectOverlayProps) {
  if (!effectId) return null;

  const isStrong = intensity === "strong";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      {effectId === "spark_emerald" && (
        <>
          <div
            className={`st-effect-breathe absolute -right-10 -top-12 h-40 w-40 rounded-full blur-2xl ${
              isStrong ? "bg-emerald-400/25" : "bg-emerald-500/15"
            }`}
          />
          <div className="st-effect-breathe absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-teal-400/12 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          {RISING_PARTICLES.slice(0, 5).map((p, idx) => (
            <span
              key={idx}
              style={
                {
                  left: p.left,
                  bottom: "4px",
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  "--st-dur": p.dur,
                  "--st-delay": p.delay,
                  "--st-drift": p.drift,
                } as CSSProperties
              }
              className="st-effect-float-up absolute rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
            />
          ))}
        </>
      )}

      {effectId === "cyber_volt" && (
        <>
          <div
            className={`st-effect-breathe absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.22),transparent_58%)]"
                : "bg-[radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.14),transparent_58%)]"
            }`}
          />
          <div
            className="st-effect-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-300/18 to-transparent"
            style={{ "--st-dur": "4.2s" } as CSSProperties}
          />
          <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            className="st-effect-volt absolute inset-0 h-full w-full"
          >
            <path
              d="M0 18 H88 L104 34 H196 L210 14 H320 L338 28 H400"
              stroke="rgba(34,211,238,0.45)"
              strokeWidth="1.25"
              fill="none"
            />
            <path
              d="M270 104 L286 82 L302 96 L326 62"
              stroke="rgba(103,232,249,0.55)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </>
      )}

      {effectId === "ember_blaze" && (
        <>
          <div
            className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t ${
              isStrong
                ? "from-orange-500/24 via-amber-500/10 to-transparent"
                : "from-orange-500/16 via-red-500/6 to-transparent"
            }`}
          />
          <div className="st-effect-breathe absolute -bottom-10 right-6 h-32 w-40 rounded-full bg-orange-500/20 blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-400/70 to-transparent" />
          {RISING_PARTICLES.map((p, idx) => (
            <span
              key={idx}
              style={
                {
                  left: p.left,
                  bottom: "2px",
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  "--st-dur": p.dur,
                  "--st-delay": p.delay,
                  "--st-drift": p.drift,
                } as CSSProperties
              }
              className={`st-effect-float-up absolute rounded-full ${
                idx % 2 === 0
                  ? "bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.95)]"
                  : "bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.95)]"
              }`}
            />
          ))}
        </>
      )}

      {effectId === "starlight_aura" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.24),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(232,121,249,0.18),transparent_55%)]"
                : "bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.16),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(232,121,249,0.12),transparent_55%)]"
            }`}
          />
          {STAR_POINTS.map((s, idx) => (
            <div
              key={idx}
              style={
                {
                  top: s.top,
                  left: s.left,
                  "--st-dur": s.dur,
                  "--st-delay": s.delay,
                } as CSSProperties
              }
              className="st-effect-twinkle absolute drop-shadow-[0_0_6px_rgba(196,181,253,0.9)]"
            >
              <FourPointStar
                size={s.size}
                color={idx % 2 === 0 ? "#ddd6fe" : "#f5d0fe"}
              />
            </div>
          ))}
        </>
      )}

      {effectId === "arcane_aurora" && (
        <>
          <div
            className={`st-effect-aurora absolute -inset-x-10 -top-10 h-44 rounded-full blur-2xl ${
              isStrong
                ? "bg-gradient-to-r from-teal-400/28 via-cyan-400/22 to-violet-500/28"
                : "bg-gradient-to-r from-teal-400/18 via-sky-400/14 to-purple-500/20"
            }`}
          />
          <div
            className="st-effect-aurora absolute -bottom-14 right-0 h-32 w-2/3 rounded-full bg-gradient-to-r from-emerald-400/14 via-teal-400/14 to-indigo-500/18 blur-2xl"
            style={{ animationDelay: "-4s" }}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-teal-400/40 via-cyan-300/75 to-purple-400/50" />
        </>
      )}

      {effectId === "solar_flare" && (
        <>
          <div
            className={`st-effect-breathe absolute -right-12 -top-12 h-48 w-48 rounded-full blur-2xl ${
              isStrong ? "bg-amber-400/28" : "bg-amber-400/18"
            }`}
          />
          <div
            className="st-effect-ring-spin absolute -right-20 -top-20 h-60 w-60 opacity-25"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.55) 28deg, transparent 60deg, transparent 140deg, rgba(253,224,71,0.45) 170deg, transparent 210deg, transparent 290deg, rgba(251,146,60,0.45) 320deg, transparent 360deg)",
              animationDuration: "18s",
            }}
          />
          {RISING_PARTICLES.slice(1, 6).map((p, idx) => (
            <span
              key={idx}
              style={
                {
                  left: p.left,
                  bottom: "4px",
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  "--st-dur": p.dur,
                  "--st-delay": p.delay,
                  "--st-drift": p.drift,
                } as CSSProperties
              }
              className="st-effect-float-up absolute rounded-full bg-yellow-200 shadow-[0_0_8px_rgba(253,224,71,0.9)]"
            />
          ))}
        </>
      )}

      {effectId === "crystal_prism" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[linear-gradient(125deg,rgba(232,121,249,0.20),transparent_42%,rgba(56,189,248,0.18))]"
                : "bg-[linear-gradient(125deg,rgba(232,121,249,0.13),transparent_45%,rgba(56,189,248,0.12))]"
            }`}
          />
          <div
            className="st-effect-shimmer absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-fuchsia-200/20 via-50% to-transparent"
            style={{ "--st-dur": "4.8s" } as CSSProperties}
          />
          {STAR_POINTS.slice(0, 4).map((s, idx) => (
            <div
              key={idx}
              style={
                {
                  top: s.top,
                  left: s.left,
                  "--st-dur": s.dur,
                  "--st-delay": s.delay,
                } as CSSProperties
              }
              className="st-effect-twinkle absolute drop-shadow-[0_0_6px_rgba(240,171,252,0.9)]"
            >
              <FourPointStar
                size={s.size}
                color={idx % 2 === 0 ? "#f5d0fe" : "#bae6fd"}
              />
            </div>
          ))}
        </>
      )}

      {effectId === "royal_ascension" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_90%_12%,rgba(250,204,21,0.28),transparent_55%),radial-gradient(circle_at_12%_88%,rgba(168,85,247,0.24),transparent_55%)]"
                : "bg-[radial-gradient(circle_at_90%_12%,rgba(250,204,21,0.19),transparent_55%),radial-gradient(circle_at_12%_88%,rgba(168,85,247,0.16),transparent_55%)]"
            }`}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-purple-400/50 via-yellow-300/90 to-amber-400/50" />
          <div
            className="st-effect-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-yellow-200/20 to-transparent"
            style={{ "--st-dur": "5.2s" } as CSSProperties}
          />
          {STAR_POINTS.map((s, idx) => (
            <div
              key={idx}
              style={
                {
                  top: s.top,
                  left: s.left,
                  "--st-dur": s.dur,
                  "--st-delay": s.delay,
                } as CSSProperties
              }
              className="st-effect-twinkle absolute drop-shadow-[0_0_7px_rgba(250,204,21,0.95)]"
            >
              <FourPointStar
                size={s.size}
                color={idx % 2 === 0 ? "#fef08a" : "#e9d5ff"}
              />
            </div>
          ))}
          {RISING_PARTICLES.slice(0, 5).map((p, idx) => (
            <span
              key={idx}
              style={
                {
                  left: p.left,
                  bottom: "2px",
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  "--st-dur": p.dur,
                  "--st-delay": p.delay,
                  "--st-drift": p.drift,
                } as CSSProperties
              }
              className="st-effect-float-up absolute rounded-full bg-yellow-300 shadow-[0_0_9px_rgba(250,204,21,0.95)]"
            />
          ))}
        </>
      )}
    </div>
  );
}
