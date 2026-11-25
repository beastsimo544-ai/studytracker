import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download StudyTracker Android App (Free APK)",
  description:
    "Download the free StudyTracker Android app for native Pomodoro notifications, distraction-free study timers, live friend leaderboards, and CSV exports.",
  alternates: {
    canonical: "/download",
  },
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
