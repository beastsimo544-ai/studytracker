"use client";

type AvatarSize = "xs" | "sm" | "md" | "lg";

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  size?: AvatarSize;
  className?: string;
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-xs",
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-16 w-16 text-xl",
};

const FALLBACK_PALETTES = [
  "from-indigo-500/40 to-purple-500/40 text-indigo-200",
  "from-emerald-500/40 to-teal-500/40 text-emerald-200",
  "from-amber-500/40 to-orange-500/40 text-amber-200",
  "from-sky-500/40 to-blue-500/40 text-sky-200",
  "from-rose-500/40 to-pink-500/40 text-rose-200",
  "from-violet-500/40 to-fuchsia-500/40 text-violet-200",
];

function getPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTES[Math.abs(hash) % FALLBACK_PALETTES.length];
}

export default function UserAvatar({
  avatarUrl,
  name,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const cleanName = (name || "?").replace(/^@+/, "").trim();
  const initial = (cleanName[0] || "?").toUpperCase();
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={cleanName ? `${cleanName} avatar` : "User avatar"}
        className={`${sizeClass} shrink-0 rounded-full border border-white/15 object-cover ${className}`}
      />
    );
  }

  const palette = getPalette(cleanName.toLowerCase());

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} flex shrink-0 select-none items-center justify-center rounded-full border border-white/15 bg-gradient-to-br font-semibold ${palette} ${className}`}
    >
      {initial}
    </div>
  );
}
