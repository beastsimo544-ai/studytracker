export type SubjectColorOption = {
  label: string;
  hex: string;
};

export const SUBJECT_COLOR_OPTIONS: SubjectColorOption[] = [
  { label: "Indigo", hex: "#6366f1" },
  { label: "Emerald", hex: "#10b981" },
  { label: "Sky", hex: "#0ea5e9" },
  { label: "Amber", hex: "#f59e0b" },
  { label: "Rose", hex: "#f43f5e" },
  { label: "Violet", hex: "#a855f7" },
  { label: "Cyan", hex: "#06b6d4" },
  { label: "Orange", hex: "#f97316" },
];

export function getFallbackSubjectColor(subjectName: string): string {
  const clean = (subjectName || "study").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = (hash * 31 + clean.charCodeAt(i)) | 0;
  }
  return SUBJECT_COLOR_OPTIONS[Math.abs(hash) % SUBJECT_COLOR_OPTIONS.length]
    .hex;
}

export function resolveSubjectColor(
  subjectName: string,
  colorBySubject?: Record<string, string | null | undefined>
): string {
  const explicit = colorBySubject?.[subjectName];
  if (explicit && /^#[0-9a-fA-F]{6}$/.test(explicit)) {
    return explicit;
  }
  return getFallbackSubjectColor(subjectName);
}
