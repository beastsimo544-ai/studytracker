export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold">
          Study Tracker
        </h1>

        <p className="mt-4 text-lg">
          Track your study time. Understand your progress.
        </p>

        <button className="mt-8 rounded-lg bg-white px-6 py-3 font-semibold text-black">
          Start Studying
        </button>
      </div>
    </main>
  );
}