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

        <Link
          href="/timer"
          className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90"
        >
          Start Studying
        </Link>
      </div>
    </main>
  );
}