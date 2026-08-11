import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-white/10">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

        <Link href="/" className="text-xl font-bold">
          StudyTracker
        </Link>

        <div className="flex gap-6">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/timer">Timer</Link>
          <Link href="/subject">Subjects</Link>
          <Link href="/history">History</Link>
        </div>

        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-white/20 px-4 py-2"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-lg bg-white px-4 py-2 text-black"
          >
            Sign Up
          </Link>
        </div>

      </nav>
    </header>
  );
}