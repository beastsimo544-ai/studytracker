import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online Study Timer & Pomodoro Clock",
  description:
    "Free distraction-free study stopwatch and Pomodoro timer (25/5, 50/10, or custom). Track study hours by subject with screen wake-lock and session notes.",
  alternates: {
    canonical: "/timer",
  },
};

export default function TimerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
