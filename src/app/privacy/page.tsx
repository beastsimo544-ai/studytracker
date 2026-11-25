export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-white/50">Last updated: November 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/80">
        <section>
          <h2 className="text-lg font-semibold text-white">1. Overview</h2>
          <p className="mt-2">
            StudyTracker helps students track study sessions, organize subjects,
            and compare weekly study progress with friends. We respect your
            privacy and only collect the minimum data needed to provide these
            features.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">
            2. Data We Collect
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Account Information:</strong> Your email address,
              encrypted password (managed by Supabase Auth), and optional
              username.
            </li>
            <li>
              <strong>Study Activity:</strong> Subjects you create, study
              session durations and timestamps, daily study goals, and friend
              connections you initiate or accept.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">
            3. How Your Data Is Used & Shared
          </h2>
          <p className="mt-2">
            Your data is used solely to save and display your study progress
            across devices. If you accept a friend request, your chosen
            username and study session totals are visible to your accepted
            friends on the Weekly Leaderboard. We never sell your data or share
            it with advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">
            4. Security & Account Deletion
          </h2>
          <p className="mt-2">
            All data is transmitted over HTTPS and protected by Supabase Row
            Level Security (RLS). You can delete individual study sessions,
            subjects, and friendships at any time, or permanently delete your
            entire account and all associated data directly inside the app under{" "}
            <strong>Account Settings → Delete Account</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
