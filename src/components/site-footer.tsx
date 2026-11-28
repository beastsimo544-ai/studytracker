import Link from "next/link";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site-config";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.08] py-8 text-xs text-white/55">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span>{SITE_NAME}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/60">
              Web &amp; Android
            </span>
          </div>
          <p className="leading-relaxed text-white/50">
            Track study hours by subject, build daily streaks, and stay focused
            with Pomodoro timers and friend leaderboards.
          </p>
          <p className="leading-relaxed text-white/45">
            Payments, billing, and tax compliance are securely handled by{" "}
            <a
              href="https://www.paddle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/75 underline decoration-white/25 underline-offset-2 hover:text-white"
            >
              Paddle.com
            </a>{" "}
            as our Merchant of Record.
          </p>
          <p className="text-white/60">
            Support:{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:gap-12">
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-white/80">
              Product
            </h3>
            <ul className="space-y-1.5">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/timer" className="hover:text-white">
                  Study Timer
                </Link>
              </li>
              <li>
                <Link href="/download" className="hover:text-white">
                  Android App
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-white/80">
              Legal
            </h3>
            <ul className="space-y-1.5">
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/refund" className="hover:text-white">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 pt-5 text-[11px] text-white/40 sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
        <p>14-day money-back guarantee &middot; Cancel anytime</p>
      </div>
    </footer>
  );
}
