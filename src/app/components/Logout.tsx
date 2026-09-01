"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="border-b border-white/10">
      <nav className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            StudyTracker
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-6 md:flex">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/timer">Timer</Link>
            <Link href="/subject">Subjects</Link>
            <Link href="/history">History</Link>

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

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen((current) => !current)}
            className="rounded-lg border border-white/20 px-3 py-2 md:hidden"
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>

        {/* Mobile navigation */}
        {isOpen && (
          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 md:hidden">
            <Link href="/dashboard" onClick={() => setIsOpen(false)}>
              Dashboard
            </Link>

            <Link href="/timer" onClick={() => setIsOpen(false)}>
              Timer
            </Link>

            <Link href="/subject" onClick={() => setIsOpen(false)}>
              Subjects
            </Link>

            <Link href="/history" onClick={() => setIsOpen(false)}>
              History
            </Link>

            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-white/20 px-4 py-2 text-center"
            >
              Login
            </Link>

            <Link
              href="/register"
              onClick={() => setIsOpen(false)}
              className="rounded-lg bg-white px-4 py-2 text-center text-black"
            >
              Sign Up
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}