import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="text-center">
        <h1 className="text-5xl font-bold">
          Study Tracker
        </h1>

        <p className="mt-4 text-lg">
          Track your study time. Understand your progress.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/timer"
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90"
          >
            Start Studying
          </Link>

          <Link
            href="/download"
            className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Download App
          </Link>
        </div>
      </div>
    </main>
  );
}