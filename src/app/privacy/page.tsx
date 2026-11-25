export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Privacy Policy
        </h1>
        <p className="mt-1 text-xs text-white/45">Last updated: November 2026</p>

        <div className="mt-6 space-y-5 text-xs leading-relaxed text-white/75 sm:text-sm">
          <section>
            <h2 className="text-sm font-semibold text-white sm:text-base">
              1. Overview
            </h2>
            <p className="mt-1.5">
              StudyTracker helps students track study sessions, organize
              subjects, and compare weekly study progress with friends. We
              respect your privacy and only collect the minimum data needed to
              provide these features.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white sm:text-base">
              2. Data We Collect
            </h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>
                <strong>Account Information:</strong> Your email address,
                encrypted password (managed by Supabase Auth), and optional
                username and profile photo.
              </li>
              <li>
                <strong>Study Activity:</strong> Subjects you create, study
                session durations and timestamps, daily study goals, exam
                countdowns, and friend connections you initiate or accept.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white sm:text-base">
              3. How Your Data Is Used &amp; Shared
            </h2>
            <p className="mt-1.5">
              Your data is used solely to save and display your study progress
              across devices. If you accept a friend request, your chosen
              username and study session totals are visible to your accepted
              friends on the Friends Leaderboard. We never sell your data or
              share it with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white sm:text-base">
              4. Security &amp; Account Deletion
            </h2>
            <p className="mt-1.5">
              All data is transmitted over HTTPS and protected by Supabase Row
              Level Security (RLS). You can export your data to CSV, delete
              individual study sessions, subjects, and friendships at any time,
              or permanently delete your entire account and all associated data
              directly inside the app under{" "}
              <strong>Settings → Delete Account</strong>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
