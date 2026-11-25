import { Capacitor } from "@capacitor/core";

export type CsvSessionRow = {
  subject: string;
  duration: number;
  created_at: string;
  note?: string | null;
};

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function buildSessionsCsvContent(sessions: CsvSessionRow[]): string {
  const headers = [
    "Date",
    "Time",
    "Subject",
    "Duration (Seconds)",
    "Duration (Minutes)",
    "Duration (HH:MM:SS)",
    "Note",
  ];

  const lines = [headers.map(escapeCsvCell).join(",")];

  sessions.forEach((session) => {
    const dt = new Date(session.created_at);
    const dateStr = Number.isNaN(dt.getTime())
      ? session.created_at
      : dt.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const timeStr = Number.isNaN(dt.getTime())
      ? ""
      : dt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    const secs = Math.max(0, Math.floor(Number(session.duration) || 0));
    const mins = Number((secs / 60).toFixed(2));

    const row = [
      dateStr,
      timeStr,
      session.subject,
      secs,
      mins,
      formatHms(secs),
      session.note ?? "",
    ];

    lines.push(row.map(escapeCsvCell).join(","));
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel preserves French/Unicode accents properly
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function exportSessionsToCsv(
  sessions: CsvSessionRow[],
  filenamePrefix = "studytracker-sessions"
): Promise<"downloaded" | "shared" | "cancelled"> {
  const csvContent = buildSessionsCsvContent(sessions);
  const todayStr = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}-${todayStr}.csv`;

  // On native Android APK, use native Web Share sheet (Save to Files / Drive / Gmail / WhatsApp)
  if (
    Capacitor.isNativePlatform() &&
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      const file = new File([csvContent], filename, {
        type: "text/csv;charset=utf-8",
      });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "StudyTracker CSV Export",
          files: [file],
        });
        return "shared";
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return "cancelled";
      }
      // Fall through to standard anchor download if share fails
    }
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
