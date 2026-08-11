import Link from "next/link";
const stats = [
  {
    label: "Today",
    value: "2h 35m",
  },
  {
    label: "This week",
    value: "14h 20m",
  },
  {
    label: "Daily average",
    value: "2h 03m",
  },
];

const sessions = [
  {
    subject: "Mathematics",
    duration: "1h 20m",
    date: "Today",
  },
  {
    subject: "German",
    duration: "45m",
    date: "Today",
  },
  {
    subject: "Programming",
    duration: "2h 10m",
    date: "Yesterday",
  },
];

export default function Dashboard() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <section className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold">Dashboard</h1>

    <p className="mt-2 text-white/60">
      Here&apos;s your study progress.
    </p>
  </div>

  <Link
    href="/timer"
    className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90"
  >
    Start Studying
  </Link>
</section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <p className="text-sm text-white/50">{stat.label}</p>

            <p className="mt-3 text-3xl font-bold">{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Study this week</h2>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex h-56 items-end justify-between gap-4">
            {[
              ["Mon", 45],
              ["Tue", 70],
              ["Wed", 35],
              ["Thu", 90],
              ["Fri", 55],
              ["Sat", 75],
              ["Sun", 50],
            ].map(([day, height]) => (
              <div
                key={day}
                className="flex h-full flex-1 flex-col items-center justify-end gap-3"
              >
                <div
                  className="w-full max-w-12 rounded-t-lg bg-white"
                  style={{ height: `${height}%` }}
                />

                <span className="text-sm text-white/50">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent sessions</h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          {sessions.map((session) => (
            <div
              key={`${session.subject}-${session.date}`}
              className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 last:border-b-0"
            >
              <div>
                <p className="font-medium">{session.subject}</p>
                <p className="mt-1 text-sm text-white/50">{session.date}</p>
              </div>

              <p className="font-semibold">{session.duration}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}