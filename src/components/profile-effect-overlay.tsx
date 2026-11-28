"use client";

import type { CSSProperties } from "react";
import { useEffectsDisabled } from "@/components/use-effects-disabled";
import {
  getProfileEffectById,
  type ProfileEffectId,
} from "@/lib/profile-effects";

type ProfileEffectOverlayProps = {
  effectId: ProfileEffectId | null | undefined;
  intensity?: "normal" | "strong";
  ignoreGlobalDisable?: boolean;
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

const SAKURA_PETALS = [
  { left: "6%", dur: "5.2s", delay: "0s", driftX: "68px", rot: "220deg", size: 11 },
  { left: "22%", dur: "4.8s", delay: "1.1s", driftX: "54px", rot: "-180deg", size: 10 },
  { left: "38%", dur: "5.8s", delay: "0.5s", driftX: "78px", rot: "260deg", size: 12 },
  { left: "56%", dur: "4.6s", delay: "1.8s", driftX: "60px", rot: "-240deg", size: 9 },
  { left: "74%", dur: "5.4s", delay: "0.8s", driftX: "50px", rot: "210deg", size: 11 },
  { left: "88%", dur: "4.9s", delay: "2.1s", driftX: "40px", rot: "-190deg", size: 10 },
];

const BLACKWALL_SLICES = [
  { top: "14%", left: "6%", width: "36%", height: "2px", dur: "2.1s", delay: "0s" },
  { top: "32%", left: "52%", width: "42%", height: "3px", dur: "2.8s", delay: "0.6s" },
  { top: "54%", left: "18%", width: "55%", height: "2px", dur: "1.9s", delay: "1.1s" },
  { top: "72%", left: "44%", width: "48%", height: "3px", dur: "2.5s", delay: "0.3s" },
  { top: "86%", left: "10%", width: "30%", height: "2px", dur: "2.3s", delay: "1.4s" },
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
  ignoreGlobalDisable = false,
}: {
  effectId: ProfileEffectId | null | undefined;
  ignoreGlobalDisable?: boolean;
}) {
  const effectsDisabled = useEffectsDisabled();
  if (effectsDisabled && !ignoreGlobalDisable) return null;

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
  ignoreGlobalDisable = false,
}: ProfileEffectOverlayProps) {
  const effectsDisabled = useEffectsDisabled();
  if (!effectId || (effectsDisabled && !ignoreGlobalDisable)) return null;

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

      {/* ANIME & GAME INSPIRED EFFECTS */}

      {effectId === "sakura_storm" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_15%_20%,rgba(244,114,182,0.26),transparent_58%),radial-gradient(circle_at_85%_85%,rgba(168,85,247,0.18),transparent_58%)]"
                : "bg-[radial-gradient(circle_at_15%_20%,rgba(244,114,182,0.18),transparent_58%),radial-gradient(circle_at_85%_85%,rgba(168,85,247,0.12),transparent_58%)]"
            }`}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-pink-400/40 via-pink-200/80 to-purple-400/40" />
          {SAKURA_PETALS.map((p, idx) => (
            <svg
              key={idx}
              width={p.size}
              height={p.size}
              viewBox="0 0 20 20"
              style={
                {
                  top: "-8px",
                  left: p.left,
                  "--st-dur": p.dur,
                  "--st-delay": p.delay,
                  "--st-drift-x": p.driftX,
                  "--st-rot": p.rot,
                } as CSSProperties
              }
              className="st-effect-petal absolute drop-shadow-[0_0_5px_rgba(244,114,182,0.75)]"
            >
              <path
                d="M10 1 C14 4, 17 9, 10 19 C3 9, 6 4, 10 1 Z"
                fill={idx % 2 === 0 ? "#f9a8d4" : "#fbcfe8"}
              />
            </svg>
          ))}
        </>
      )}

      {effectId === "blackwall_breach" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_80%_20%,rgba(239,68,68,0.28),transparent_60%),linear-gradient(180deg,rgba(127,29,29,0.28),rgba(9,9,11,0.5))]"
                : "bg-[radial-gradient(circle_at_80%_20%,rgba(239,68,68,0.18),transparent_60%),linear-gradient(180deg,rgba(127,29,29,0.18),transparent)]"
            }`}
          />
          {/* Subtle cyberpunk CRT scanline pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(239,68,68,0.22) 0px, rgba(239,68,68,0.22) 1px, transparent 1px, transparent 4px)",
            }}
          />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-red-600/80 via-red-400 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500/85 to-red-700/60" />
          {BLACKWALL_SLICES.map((s, idx) => (
            <span
              key={idx}
              style={
                {
                  top: s.top,
                  left: s.left,
                  width: s.width,
                  height: s.height,
                  "--st-dur": s.dur,
                  "--st-delay": s.delay,
                } as CSSProperties
              }
              className={`st-effect-glitch absolute rounded-full ${
                idx % 2 === 0
                  ? "bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.95)]"
                  : "bg-rose-400/75 shadow-[0_0_8px_rgba(251,113,133,0.9)]"
              }`}
            />
          ))}
        </>
      )}

      {effectId === "spartan_chaos" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_50%_100%,rgba(234,88,12,0.34),transparent_62%),radial-gradient(circle_at_90%_10%,rgba(220,38,38,0.22),transparent_55%)]"
                : "bg-[radial-gradient(circle_at_50%_100%,rgba(234,88,12,0.24),transparent_62%),radial-gradient(circle_at_90%_10%,rgba(220,38,38,0.16),transparent_55%)]"
            }`}
          />
          <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full opacity-35"
          >
            <path
              d="M-10 115 L75 15 M325 110 L410 12"
              stroke="rgba(251,146,60,0.65)"
              strokeWidth="2.5"
              strokeDasharray="6 5"
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-red-500/40 via-orange-400/90 to-red-500/40" />
          {RISING_PARTICLES.map((p, idx) => (
            <span
              key={idx}
              style={
                {
                  left: p.left,
                  bottom: "0px",
                  width: `${p.size + 1}px`,
                  height: `${p.size + 1}px`,
                  "--st-dur": p.dur,
                  "--st-delay": p.delay,
                  "--st-drift": p.drift,
                } as CSSProperties
              }
              className={`st-effect-float-up absolute rounded-full ${
                idx % 2 === 0
                  ? "bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.95)]"
                  : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)]"
              }`}
            />
          ))}
        </>
      )}

      {effectId === "crimson_eclipse" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_82%_26%,rgba(225,29,72,0.34),transparent_56%)]"
                : "bg-[radial-gradient(circle_at_82%_26%,rgba(225,29,72,0.24),transparent_56%)]"
            }`}
          />
          {/* Blood moon eclipse silhouette */}
          <div className="absolute right-5 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full border border-rose-500/50 bg-[#09090b]/85 shadow-[0_0_28px_rgba(225,29,72,0.55)]" />
          <div
            className="st-effect-ring-spin absolute right-3 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full border border-dashed border-rose-400/55"
            style={{ animationDuration: "11s" }}
          />
          {RISING_PARTICLES.slice(0, 4).map((p, idx) => (
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
              className="st-effect-float-up absolute rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]"
            />
          ))}
        </>
      )}

      {effectId === "domain_void" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_75%_50%,rgba(56,189,248,0.28),transparent_60%),radial-gradient(circle_at_20%_25%,rgba(99,102,241,0.26),transparent_60%)]"
                : "bg-[radial-gradient(circle_at_75%_50%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(circle_at_20%_25%,rgba(99,102,241,0.18),transparent_60%)]"
            }`}
          />
          {[0, 1, 2].map((ringIdx) => (
            <span
              key={ringIdx}
              style={
                {
                  left: "76%",
                  top: "50%",
                  width: "120px",
                  height: "120px",
                  "--st-dur": "3.6s",
                  "--st-delay": `${ringIdx * 1.2}s`,
                } as CSSProperties
              }
              className="st-effect-domain absolute rounded-full border border-sky-300/65 shadow-[0_0_16px_rgba(56,189,248,0.55)]"
            />
          ))}
          {STAR_POINTS.slice(0, 5).map((s, idx) => (
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
              className="st-effect-twinkle absolute drop-shadow-[0_0_6px_rgba(125,211,252,0.95)]"
            >
              <FourPointStar
                size={s.size}
                color={idx % 2 === 0 ? "#e0f2fe" : "#a5b4fc"}
              />
            </div>
          ))}
        </>
      )}

      {effectId === "ki_surge" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_50%_100%,rgba(250,204,21,0.34),transparent_65%)]"
                : "bg-[radial-gradient(circle_at_50%_100%,rgba(250,204,21,0.22),transparent_65%)]"
            }`}
          />
          {/* Rising golden Ki pillars */}
          {[
            { left: "14%", width: "26px", dur: "2.1s", delay: "0s" },
            { left: "44%", width: "40px", dur: "2.6s", delay: "0.5s" },
            { left: "74%", width: "30px", dur: "2.3s", delay: "0.9s" },
          ].map((pillar, idx) => (
            <span
              key={idx}
              style={
                {
                  left: pillar.left,
                  bottom: "-10px",
                  width: pillar.width,
                  height: "100%",
                  "--st-dur": pillar.dur,
                  "--st-delay": pillar.delay,
                } as CSSProperties
              }
              className="st-effect-ki absolute rounded-full bg-gradient-to-t from-yellow-400/35 via-amber-300/18 to-transparent blur-md"
            />
          ))}
          <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            className="st-effect-volt absolute inset-0 h-full w-full"
          >
            <path
              d="M42 110 L58 76 L49 66 L70 30 M320 105 L336 68 L326 56 L348 20"
              stroke="rgba(125,211,252,0.72)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </>
      )}

      {effectId === "domain_shrine" && (
        <>
          <div
            className={`absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.26),rgba(9,9,11,0.6)_75%)]"
                : "bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.18),transparent_72%)]"
            }`}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/85 to-transparent" />
          {/* Animated Cleave / Dismantle razor slashes */}
          <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            style={{ "--st-dur": "2.6s", "--st-delay": "0s" } as CSSProperties}
            className="st-effect-slash absolute inset-0 h-full w-full"
          >
            <path
              d="M25 105 L195 10"
              stroke="rgba(254,202,202,0.9)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M190 112 L370 14"
              stroke="rgba(239,68,68,0.85)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M70 18 L290 104"
              stroke="rgba(254,226,226,0.8)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
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
              className="st-effect-float-up absolute rounded-full bg-red-400 shadow-[0_0_9px_rgba(248,113,113,0.95)]"
            />
          ))}
        </>
      )}

      {effectId === "golden_grace" && (
        <>
          <div
            className={`st-effect-breathe absolute inset-0 ${
              isStrong
                ? "bg-[radial-gradient(circle_at_50%_95%,rgba(251,191,36,0.34),transparent_60%),radial-gradient(circle_at_15%_15%,rgba(245,158,11,0.2),transparent_55%)]"
                : "bg-[radial-gradient(circle_at_50%_95%,rgba(251,191,36,0.22),transparent_60%),radial-gradient(circle_at_15%_15%,rgba(245,158,11,0.14),transparent_55%)]"
            }`}
          />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/90 to-transparent" />
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
              className="st-effect-float-up absolute rounded-full bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.95)]"
            />
          ))}
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
              className="st-effect-twinkle absolute drop-shadow-[0_0_7px_rgba(253,224,71,0.95)]"
            >
              <FourPointStar size={s.size} color="#fef08a" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
