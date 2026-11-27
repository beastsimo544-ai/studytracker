"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@/components/notification-provider";

export type StudyCardSubject = {
  subject: string;
  seconds: number;
  color: string;
};

export type StudyCardDay = {
  day: string;
  seconds: number;
  color: string;
};

export type StudyCardData = {
  username: string | null;
  avatarUrl: string | null;
  todaySeconds: number;
  weekSeconds: number;
  dailyAvgSeconds: number;
  dailyGoalSeconds: number;
  currentStreak: number;
  longestStreak: number;
  unlockedIcons: string[];
  unlockedCount: number;
  totalBadges: number;
  todaySubjects: StudyCardSubject[];
  weekSubjects: StudyCardSubject[];
  weekDays: StudyCardDay[];
};

type CardPeriod = "week" | "today";
type CardFormat = "story" | "square";
type CardTheme = "emerald" | "violet" | "amber";

const THEMES: Record<
  CardTheme,
  { label: string; accent: string; glowRgba: string; pillBg: string }
> = {
  emerald: {
    label: "Emerald",
    accent: "#10b981",
    glowRgba: "rgba(16, 185, 129, 0.22)",
    pillBg: "rgba(16, 185, 129, 0.14)",
  },
  violet: {
    label: "Violet",
    accent: "#8b5cf6",
    glowRgba: "rgba(139, 92, 246, 0.24)",
    pillBg: "rgba(139, 92, 246, 0.16)",
  },
  amber: {
    label: "Amber",
    accent: "#f59e0b",
    glowRgba: "rgba(245, 158, 11, 0.22)",
    pillBg: "rgba(245, 158, 11, 0.14)",
  },
};

const SITE_HOST = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://studytracker-e2vs.vercel.app"
)
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "");

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  if (safe > 0) return `${safe}s`;
  return "0m";
}

function formatCompact(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h${minutes}`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
}

function getPeriodDateLabel(period: CardPeriod) {
  const now = new Date();
  if (period === "today") {
    return `TODAY · ${now
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toUpperCase()}`;
  }

  const day = now.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - daysSinceMonday);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const fmt = (d: Date) =>
    d
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toUpperCase();
  return `THIS WEEK · ${fmt(mon)} – ${fmt(sun)}`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function loadImageWithTimeout(
  src: string,
  timeoutMs = 2000
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    img.src = src;
  });
}

async function renderCardCanvas(
  data: StudyCardData,
  period: CardPeriod,
  format: CardFormat,
  themeKey: CardTheme
): Promise<string> {
  const width = 1080;
  const height = format === "story" ? 1920 : 1080;
  const isStory = format === "story";
  const theme = THEMES[themeKey];

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const fontSans =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const fontMono =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  // Background & top-right ambient glow
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.85,
    height * 0.12,
    40,
    width * 0.85,
    height * 0.12,
    isStory ? 850 : 620
  );
  glow.addColorStop(0, theme.glowRgba);
  glow.addColorStop(1, "rgba(9, 9, 11, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Subtle bottom-left secondary glow
  const glowBottom = ctx.createRadialGradient(
    width * 0.15,
    height * 0.92,
    30,
    width * 0.15,
    height * 0.92,
    520
  );
  glowBottom.addColorStop(0, "rgba(255, 255, 255, 0.045)");
  glowBottom.addColorStop(1, "rgba(9, 9, 11, 0)");
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, width, height);

  // Outer card frame
  const padX = isStory ? 72 : 60;
  const padY = isStory ? 96 : 52;
  const innerW = width - padX * 2;
  const frameInset = isStory ? 34 : 26;

  drawRoundedRect(
    ctx,
    frameInset,
    frameInset,
    width - frameInset * 2,
    height - frameInset * 2,
    42
  );
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  let cursorY = padY;

  // 1. Header: Brand badge + Period date pill
  ctx.font = `700 22px ${fontSans}`;
  const brandLabel = "STUDYTRACKER";
  const brandW = ctx.measureText(brandLabel).width + 64;
  drawRoundedRect(ctx, padX, cursorY, brandW, 48, 24);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(padX + 26, cursorY + 24, 7, 0, Math.PI * 2);
  ctx.fillStyle = theme.accent;
  ctx.fill();

  ctx.fillStyle = "#f4f4f5";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(brandLabel, padX + 44, cursorY + 25);

  const dateLabel = getPeriodDateLabel(period);
  ctx.font = `600 20px ${fontSans}`;
  const dateW = ctx.measureText(dateLabel).width + 40;
  drawRoundedRect(ctx, padX + innerW - dateW, cursorY + 2, dateW, 44, 22);
  ctx.fillStyle = theme.pillBg;
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.textAlign = "center";
  ctx.fillText(dateLabel, padX + innerW - dateW / 2, cursorY + 24);

  cursorY += isStory ? 96 : 74;

  // 2. Identity Row: Avatar + @username + Streak pill
  const avatarSize = isStory ? 84 : 68;
  const displayName = data.username ? `@${data.username}` : "Student";
  const avatarImg = data.avatarUrl
    ? await loadImageWithTimeout(data.avatarUrl)
    : null;

  const avatarCx = padX + avatarSize / 2;
  const avatarCy = cursorY + avatarSize / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImg) {
    const scale = Math.max(
      avatarSize / avatarImg.width,
      avatarSize / avatarImg.height
    );
    const drawW = avatarImg.width * scale;
    const drawH = avatarImg.height * scale;
    ctx.drawImage(
      avatarImg,
      avatarCx - drawW / 2,
      avatarCy - drawH / 2,
      drawW,
      drawH
    );
  } else {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(padX, cursorY, avatarSize, avatarSize);
    ctx.fillStyle = theme.accent;
    ctx.font = `700 ${Math.round(avatarSize * 0.44)}px ${fontSans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initial = (data.username || "S")[0].toUpperCase();
    ctx.fillText(initial, avatarCx, avatarCy + 2);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const textX = padX + avatarSize + 22;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${isStory ? 34 : 28}px ${fontSans}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(
    truncateText(ctx, displayName, innerW - avatarSize - 250),
    textX,
    avatarCy - 12
  );

  ctx.font = `500 ${isStory ? 22 : 19}px ${fontSans}`;
  ctx.fillStyle = "rgba(244, 244, 245, 0.55)";
  ctx.fillText(
    data.currentStreak > 0
      ? `🔥 ${data.currentStreak} day streak`
      : "Focused study session",
    textX,
    avatarCy + 18
  );

  cursorY += avatarSize + (isStory ? 54 : 32);

  // 3. Hero Stat Panel
  const heroTotalSeconds =
    period === "week" ? data.weekSeconds : data.todaySeconds;
  const heroH = isStory ? 236 : 164;
  drawRoundedRect(ctx, padX, cursorY, innerW, heroH, 32);
  ctx.fillStyle = "#111113";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 ${isStory ? 22 : 18}px ${fontSans}`;
  ctx.fillStyle = "rgba(244, 244, 245, 0.52)";
  ctx.fillText(
    period === "week" ? "STUDIED THIS WEEK" : "STUDIED TODAY",
    padX + 40,
    cursorY + (isStory ? 38 : 26)
  );

  ctx.font = `700 ${isStory ? 112 : 84}px ${fontMono}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(
    formatDuration(heroTotalSeconds),
    padX + 38,
    cursorY + (isStory ? 84 : 58)
  );

  cursorY += heroH + (isStory ? 36 : 24);

  // 4. Visual Panel (7-day bar chart for Week, Daily Goal bar for Today)
  if (period === "week") {
    const chartH = isStory ? 330 : 210;
    drawRoundedRect(ctx, padX, cursorY, innerW, chartH, 32);
    ctx.fillStyle = "#111113";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `600 20px ${fontSans}`;
    ctx.fillStyle = "rgba(244, 244, 245, 0.52)";
    ctx.textBaseline = "top";
    ctx.fillText("DAILY BREAKDOWN", padX + 40, cursorY + 28);

    const maxSec = Math.max(...data.weekDays.map((d) => d.seconds), 1);
    const barAreaTop = cursorY + (isStory ? 96 : 74);
    const barAreaH = isStory ? 168 : 88;
    const barSlotW = (innerW - 80) / 7;
    const barW = isStory ? 54 : 46;

    data.weekDays.forEach((d, idx) => {
      const cx = padX + 40 + idx * barSlotW + barSlotW / 2;
      const barX = cx - barW / 2;
      const ratio = d.seconds > 0 ? Math.max(d.seconds / maxSec, 0.08) : 0;
      const fillH = Math.round(barAreaH * ratio);

      // Background track bar
      drawRoundedRect(ctx, barX, barAreaTop, barW, barAreaH, 12);
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.fill();

      if (fillH > 0) {
        drawRoundedRect(
          ctx,
          barX,
          barAreaTop + barAreaH - fillH,
          barW,
          fillH,
          12
        );
        ctx.fillStyle = d.color || theme.accent;
        ctx.fill();

        ctx.font = `600 18px ${fontMono}`;
        ctx.fillStyle = "rgba(244, 244, 245, 0.78)";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(
          formatCompact(d.seconds),
          cx,
          barAreaTop + barAreaH - fillH - 8
        );
      }

      ctx.font = `600 20px ${fontSans}`;
      ctx.fillStyle = "rgba(244, 244, 245, 0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(d.day, cx, barAreaTop + barAreaH + 14);
    });

    cursorY += chartH + (isStory ? 36 : 24);
  } else {
    const goalH = isStory ? 190 : 140;
    const goalPct =
      data.dailyGoalSeconds > 0
        ? Math.min(
            Math.round((data.todaySeconds / data.dailyGoalSeconds) * 100),
            999
          )
        : 0;
    const barFillPct = Math.min(goalPct, 100) / 100;

    drawRoundedRect(ctx, padX, cursorY, innerW, goalH, 32);
    ctx.fillStyle = "#111113";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `600 20px ${fontSans}`;
    ctx.fillStyle = "rgba(244, 244, 245, 0.52)";
    ctx.fillText("DAILY GOAL PROGRESS", padX + 40, cursorY + 30);

    ctx.textAlign = "right";
    ctx.font = `700 26px ${fontMono}`;
    ctx.fillStyle = theme.accent;
    ctx.fillText(
      `${goalPct}% · ${formatDuration(data.dailyGoalSeconds)}`,
      padX + innerW - 40,
      cursorY + 28
    );

    const trackY = cursorY + (isStory ? 104 : 78);
    drawRoundedRect(ctx, padX + 40, trackY, innerW - 80, 26, 13);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.fill();

    if (barFillPct > 0) {
      drawRoundedRect(
        ctx,
        padX + 40,
        trackY,
        Math.max(26, (innerW - 80) * barFillPct),
        26,
        13
      );
      ctx.fillStyle = theme.accent;
      ctx.fill();
    }

    cursorY += goalH + (isStory ? 36 : 24);
  }

  // 5. Top Subjects Panel
  const subjects = (
    period === "week" ? data.weekSubjects : data.todaySubjects
  ).slice(0, isStory ? 4 : 3);
  const subjectsBoxH = isStory ? 420 : 254;
  drawRoundedRect(ctx, padX, cursorY, innerW, subjectsBoxH, 32);
  ctx.fillStyle = "#111113";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 20px ${fontSans}`;
  ctx.fillStyle = "rgba(244, 244, 245, 0.52)";
  ctx.fillText("TOP SUBJECTS", padX + 40, cursorY + 28);

  if (subjects.length === 0) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 24px ${fontSans}`;
    ctx.fillStyle = "rgba(244, 244, 245, 0.35)";
    ctx.fillText(
      "Start a session to fill your card",
      padX + innerW / 2,
      cursorY + subjectsBoxH / 2 + 12
    );
  } else {
    const topMaxSec = Math.max(...subjects.map((s) => s.seconds), 1);
    const rowStep = isStory ? 84 : 62;
    let rowY = cursorY + (isStory ? 82 : 68);

    subjects.forEach((sub) => {
      // Color dot
      ctx.beginPath();
      ctx.arc(padX + 48, rowY + 14, 8, 0, Math.PI * 2);
      ctx.fillStyle = sub.color || theme.accent;
      ctx.fill();

      // Subject name
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${isStory ? 28 : 24}px ${fontSans}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(
        truncateText(ctx, sub.subject, innerW - 260),
        padX + 74,
        rowY + 15
      );

      // Duration
      ctx.textAlign = "right";
      ctx.font = `700 ${isStory ? 26 : 22}px ${fontMono}`;
      ctx.fillStyle = "rgba(244, 244, 245, 0.85)";
      ctx.fillText(formatDuration(sub.seconds), padX + innerW - 40, rowY + 15);

      // Progress track + fill
      const barY = rowY + (isStory ? 44 : 36);
      const barTrackW = innerW - 80;
      drawRoundedRect(ctx, padX + 40, barY, barTrackW, 10, 5);
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.fill();

      const fillW = Math.max(12, barTrackW * (sub.seconds / topMaxSec));
      drawRoundedRect(ctx, padX + 40, barY, fillW, 10, 5);
      ctx.fillStyle = sub.color || theme.accent;
      ctx.fill();

      rowY += rowStep;
    });
  }

  cursorY += subjectsBoxH + (isStory ? 36 : 22);

  // 6. Bottom 3 KPI Boxes
  const kpiGap = 20;
  const kpiW = (innerW - kpiGap * 2) / 3;
  const kpiH = isStory ? 160 : 124;

  const kpis = [
    {
      label: "CURRENT STREAK",
      value: `${data.currentStreak}d 🔥`,
    },
    period === "week"
      ? {
          label: "DAILY AVG",
          value: formatDuration(data.dailyAvgSeconds),
        }
      : {
          label: "BEST STREAK",
          value: `${data.longestStreak}d`,
        },
    {
      label: "BADGES",
      value: `${data.unlockedCount}/${data.totalBadges}`,
    },
  ];

  kpis.forEach((item, index) => {
    const bx = padX + index * (kpiW + kpiGap);
    drawRoundedRect(ctx, bx, cursorY, kpiW, kpiH, 28);
    ctx.fillStyle = "#111113";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `600 17px ${fontSans}`;
    ctx.fillStyle = "rgba(244, 244, 245, 0.48)";
    ctx.fillText(item.label, bx + 26, cursorY + (isStory ? 30 : 22));

    ctx.font = `700 ${isStory ? 40 : 32}px ${fontMono}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(item.value, bx + 26, cursorY + (isStory ? 76 : 58));
  });

  // 7. Viral Footer Watermark
  const footerY = height - (isStory ? 96 : 62);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 22px ${fontSans}`;
  ctx.fillStyle = "rgba(244, 244, 245, 0.42)";
  ctx.fillText(`Track your study hours free · ${SITE_HOST}`, width / 2, footerY);

  return canvas.toDataURL("image/png");
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export default function StudyCardModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: StudyCardData;
}) {
  const { toast } = useNotifications();
  const [period, setPeriod] = useState<CardPeriod>("week");
  const [format, setFormat] = useState<CardFormat>("story");
  const [theme, setTheme] = useState<CardTheme>("emerald");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const renderPreview = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIsRendering(true);
      const url = await renderCardCanvas(data, period, format, theme);
      if (!cancelled) {
        setPreviewUrl(url);
        setIsRendering(false);
      }
    };

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [open, data, period, format, theme]);

  if (!open) return null;

  const fileName = `studytracker-${period}-${format}.png`;

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Study card downloaded!", fileName);
  };

  const handleShare = async () => {
    if (!previewUrl) return;
    try {
      const blob = dataUrlToBlob(previewUrl);
      const file = new File([blob], fileName, { type: "image/png" });
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "My StudyTracker Card",
          text:
            period === "week"
              ? `Studied ${formatDuration(data.weekSeconds)} this week on StudyTracker!`
              : `Studied ${formatDuration(data.todaySeconds)} today on StudyTracker!`,
        });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
    }

    handleDownload();
  };

  const handleCopyImage = async () => {
    if (!previewUrl) return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blob = dataUrlToBlob(previewUrl);
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast.success("Card copied!", "Paste anywhere with Ctrl+V.");
        return;
      }
      toast.info(
        "Image copy unavailable in this browser",
        "Use Download PNG or Share instead."
      );
    } catch {
      toast.info(
        "Could not copy image directly",
        "Use Download PNG or Share instead."
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shareable Study Card"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#111113] shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">
              Share Study Card
            </h2>
            <p className="text-[11px] text-white/50">
              Post your progress to Stories, Discord, or WhatsApp.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Share Card modal"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Options Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0c0c0e] px-5 py-2.5">
          {/* Period */}
          <div className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-[#09090b] p-0.5">
            {(
              [
                { id: "week", label: "This Week" },
                { id: "today", label: "Today" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition ${
                  period === opt.id
                    ? "bg-white text-black"
                    : "text-white/55 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Format */}
          <div className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-[#09090b] p-0.5">
            {(
              [
                { id: "story", label: "Story 9:16" },
                { id: "square", label: "1:1" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFormat(opt.id)}
                className={`h-7 rounded-md px-2.5 text-[11px] font-semibold transition ${
                  format === opt.id
                    ? "bg-white text-black"
                    : "text-white/55 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Accent Theme Swatches */}
          <div className="flex items-center gap-1.5">
            {(Object.keys(THEMES) as CardTheme[]).map((key) => (
              <button
                key={key}
                type="button"
                title={THEMES[key].label}
                aria-label={`${THEMES[key].label} theme`}
                onClick={() => setTheme(key)}
                className={`h-5 w-5 rounded-full transition ${
                  theme === key
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0c0c0e]"
                    : "opacity-65 hover:opacity-100"
                }`}
                style={{ backgroundColor: THEMES[key].accent }}
              />
            ))}
          </div>
        </div>

        {/* Live Canvas Preview */}
        <div className="flex items-center justify-center bg-[#09090b] px-5 py-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Shareable StudyTracker card preview"
              className={`max-h-[46vh] w-auto rounded-2xl border border-white/10 shadow-2xl transition ${
                isRendering ? "opacity-60" : "opacity-100"
              }`}
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-[#111113]">
              <p className="text-xs text-white/45">Generating study card...</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 border-t border-white/[0.08] px-5 py-3.5">
          <button
            type="button"
            disabled={!previewUrl}
            onClick={handleShare}
            className="h-10 rounded-xl bg-white text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
          >
            Share
          </button>

          <button
            type="button"
            disabled={!previewUrl}
            onClick={handleDownload}
            className="h-10 rounded-xl border border-white/15 bg-[#09090b] text-xs font-semibold text-white transition hover:border-white/30 disabled:opacity-40"
          >
            Download PNG
          </button>

          <button
            type="button"
            disabled={!previewUrl}
            onClick={handleCopyImage}
            className="h-10 rounded-xl border border-white/15 bg-[#09090b] text-xs font-medium text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            Copy Image
          </button>
        </div>
      </div>
    </div>
  );
}
