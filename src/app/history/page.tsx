"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNotifications } from "@/components/notification-provider";
import { exportSessionsToCsv } from "@/lib/csv-export";
import { resolveSubjectColor } from "@/lib/subject-colors";
import { supabase } from "@/lib/supabase";

type StudySession = {
  id: number;
  subject: string;
  duration: number;
  created_at: string;
  note?: string | null;
};

function getCurrentLocalDateTimeInput() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [colorBySubject, setColorBySubject] = useState<
    Record<string, string | null>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editNote, setEditNote] = useState("");

  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("All");

  // Manual past session logging
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualSubject, setManualSubject] = useState("");
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualDateTime, setManualDateTime] = useState(() =>
    getCurrentLocalDateTimeInput()
  );
  const [manualNote, setManualNote] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  const router = useRouter();
  const { toast, checkNewAchievements } = useNotifications();

  useEffect(() => {
    const fetchSessions = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Load subjects + colors
      const fullSubjectRes = await supabase
        .from("subjects")
        .select("name, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      let subjectRows: { name: string; color?: string | null }[] = [];
      if (fullSubjectRes.error && fullSubjectRes.error.message.includes("color")) {
        const fallbackSubjectRes = await supabase
          .from("subjects")
          .select("name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        subjectRows = fallbackSubjectRes.data || [];
      } else if (!fullSubjectRes.error) {
        subjectRows = fullSubjectRes.data || [];
      }

      const subjectNames = subjectRows.map((s) => s.name);
      const colors: Record<string, string | null> = {};
      subjectRows.forEach((s) => {
        colors[s.name] = s.color ?? null;
      });

      setAvailableSubjects(subjectNames);
      setColorBySubject(colors);
      if (subjectNames.length > 0) {
        setManualSubject(subjectNames[0]);
      }

      // Load study sessions (+ optional note column)
      const fullSessionsRes = await supabase
        .from("study_sessions")
        .select("id, subject, duration, created_at, note")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (
        fullSessionsRes.error &&
        fullSessionsRes.error.message.includes("note")
      ) {
        const fallbackSessionsRes = await supabase
          .from("study_sessions")
          .select("id, subject, duration, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (fallbackSessionsRes.error) {
          console.error(fallbackSessionsRes.error);
          setIsLoading(false);
          return;
        }

        setSessions((fallbackSessionsRes.data || []) as StudySession[]);
        setIsLoading(false);
        return;
      }

      if (fullSessionsRes.error) {
        console.error(fullSessionsRes.error);
        setIsLoading(false);
        return;
      }

      setSessions((fullSessionsRes.data || []) as StudySession[]);
      setIsLoading(false);
    };

    fetchSessions();
  }, [router]);

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const handleAddManualSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingManual) return;

    const cleanedSubject = manualSubject.trim();
    if (!cleanedSubject) {
      toast.error("Please choose or enter a subject.");
      return;
    }

    const totalSeconds =
      Math.max(0, Number(manualHours) || 0) * 3600 +
      Math.max(0, Number(manualMinutes) || 0) * 60;

    if (totalSeconds <= 0) {
      toast.error("Duration must be at least 1 minute.");
      return;
    }

    const parsedDate = manualDateTime ? new Date(manualDateTime) : new Date();
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error("Please enter a valid date and time.");
      return;
    }

    setIsSavingManual(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSavingManual(false);
      router.push("/login");
      return;
    }

    const cleanedNote = manualNote.trim() || null;

    const fullInsert = await supabase
      .from("study_sessions")
      .insert({
        user_id: user.id,
        subject: cleanedSubject,
        duration: totalSeconds,
        created_at: parsedDate.toISOString(),
        note: cleanedNote,
      })
      .select("id, subject, duration, created_at, note")
      .single();

    let createdSession: StudySession | null = null;

    if (fullInsert.error && fullInsert.error.message.includes("note")) {
      const fallbackInsert = await supabase
        .from("study_sessions")
        .insert({
          user_id: user.id,
          subject: cleanedSubject,
          duration: totalSeconds,
          created_at: parsedDate.toISOString(),
        })
        .select("id, subject, duration, created_at")
        .single();

      if (fallbackInsert.error) {
        setIsSavingManual(false);
        toast.error("Could not log session", fallbackInsert.error.message);
        return;
      }

      createdSession = {
        ...(fallbackInsert.data as StudySession),
        note: cleanedNote,
      };
    } else if (fullInsert.error) {
      setIsSavingManual(false);
      toast.error("Could not log session", fullInsert.error.message);
      return;
    } else {
      createdSession = fullInsert.data as StudySession;
    }

    setIsSavingManual(false);

    if (createdSession) {
      setSessions((prev) =>
        [createdSession!, ...prev].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
    }

    setManualNote("");
    setShowManualForm(false);
    toast.success("Past study session logged!", cleanedSubject);
    await checkNewAchievements();
  };

  const deleteSession = async (id: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this study session?"
    );

    if (!confirmed) return;

    const { data: deletedRows, error } = await supabase
      .from("study_sessions")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Delete error:", error);
      alert("Could not delete the session.");
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      alert(
        "The database did not delete the session. Check that a DELETE RLS policy exists on study_sessions."
      );
      return;
    }

    setSessions((currentSessions) =>
      currentSessions.filter((session) => session.id !== id)
    );
  };

  const saveEdit = async (id: number) => {
    const cleanedSubject = editSubject.trim();
    const cleanedNote = editNote.trim() || null;

    if (!cleanedSubject) {
      alert("Subject cannot be empty.");
      return;
    }

    const fullUpdate = await supabase
      .from("study_sessions")
      .update({
        subject: cleanedSubject,
        note: cleanedNote,
      })
      .eq("id", id)
      .select();

    if (fullUpdate.error && fullUpdate.error.message.includes("note")) {
      const fallbackUpdate = await supabase
        .from("study_sessions")
        .update({
          subject: cleanedSubject,
        })
        .eq("id", id)
        .select();

      if (fallbackUpdate.error) {
        alert(`Could not update session: ${fallbackUpdate.error.message}`);
        return;
      }

      if (!fallbackUpdate.data || fallbackUpdate.data.length === 0) {
        alert(
          "The database did not update the session. Check the UPDATE RLS policy."
        );
        return;
      }
    } else if (fullUpdate.error) {
      console.error("Edit error:", fullUpdate.error);
      alert(`Could not update session: ${fullUpdate.error.message}`);
      return;
    } else if (!fullUpdate.data || fullUpdate.data.length === 0) {
      alert(
        "The database did not update the session. Check the UPDATE RLS policy."
      );
      return;
    }

    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === id
          ? { ...session, subject: cleanedSubject, note: cleanedNote }
          : session
      )
    );

    setEditingSessionId(null);
    setEditSubject("");
    setEditNote("");
  };

  const subjects = Array.from(
    new Set(sessions.map((session) => session.subject))
  );

  const today = new Date();

  const filteredSessions = sessions.filter((session) => {
    const matchesSubject =
      selectedSubject === "All" || session.subject === selectedSubject;

    if (!matchesSubject) {
      return false;
    }

    if (selectedPeriod === "All") {
      return true;
    }

    const sessionDate = new Date(session.created_at);

    if (selectedPeriod === "Today") {
      return (
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth() &&
        sessionDate.getDate() === today.getDate()
      );
    }

    if (selectedPeriod === "Week") {
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(today.getDate() - daysSinceMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      return sessionDate >= startOfWeek;
    }

    if (selectedPeriod === "Month") {
      return (
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth()
      );
    }

    return true;
  });

  const filteredTotalSeconds = filteredSessions.reduce(
    (total, session) => total + session.duration,
    0
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Study History</h1>
          <p className="mt-2 text-white/60">
            Review, edit, or manually log past study sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={filteredSessions.length === 0}
            onClick={async () => {
              const res = await exportSessionsToCsv(filteredSessions);
              if (res !== "cancelled") {
                toast.success(
                  "CSV exported!",
                  `${filteredSessions.length} session(s) exported.`
                );
              }
            }}
            className="rounded-xl border border-white/20 px-4 py-3 text-sm font-medium transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              setManualDateTime(getCurrentLocalDateTimeInput());
              setShowManualForm((prev) => !prev);
            }}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            {showManualForm ? "Cancel" : "+ Log Past Session"}
          </button>
        </div>
      </div>

      {/* MANUAL SESSION FORM */}
      {showManualForm && (
        <form
          onSubmit={handleAddManualSession}
          className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-6"
        >
          <h2 className="text-lg font-semibold">Log a Past Study Session</h2>
          <p className="mt-1 text-xs text-white/50">
            Forgot to start the timer? Add your study time manually here.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-white/60">Subject</label>
              {availableSubjects.length > 0 ? (
                <select
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                >
                  {availableSubjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  placeholder="e.g. Mathematics"
                  required
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                />
              )}
            </div>

            <div>
              <label className="text-xs text-white/60">Date & Time</label>
              <input
                type="datetime-local"
                value={manualDateTime}
                onChange={(e) => setManualDateTime(e.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Hours</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={manualHours}
                  onChange={(e) =>
                    setManualHours(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Minutes</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={manualMinutes}
                  onChange={(e) =>
                    setManualMinutes(
                      Math.min(59, Math.max(0, Number(e.target.value) || 0))
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Note (optional)</label>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                maxLength={140}
                placeholder="e.g. TD 3 — Exercices"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={isSavingManual}
              className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {isSavingManual ? "Saving..." : "Save Session"}
            </button>
          </div>
        </form>
      )}

      {/* FILTERS */}
      <div className="mt-8 flex flex-wrap gap-4">
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="rounded-xl border border-white/10 bg-black px-4 py-3"
        >
          <option value="All">All subjects</option>

          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>

        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="rounded-xl border border-white/10 bg-black px-4 py-3"
        >
          <option value="All">All time</option>
          <option value="Today">Today</option>
          <option value="Week">This week</option>
          <option value="Month">This month</option>
        </select>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/50">Total study time</p>
        <p className="mt-2 font-mono text-2xl font-bold">
          {formatDuration(filteredTotalSeconds)}
        </p>
      </div>

      {/* HISTORY LIST */}
      <div className="mt-6">
        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/60">Loading study history...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/60">
              No study sessions match these filters.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {filteredSessions.map((session) => {
              const dotColor = resolveSubjectColor(
                session.subject,
                colorBySubject
              );

              return (
                <div
                  key={session.id}
                  className="flex flex-col gap-4 border-b border-white/10 bg-white/5 px-6 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    {editingSessionId === session.id ? (
                      <div className="space-y-2.5">
                        <select
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
                        >
                          {Array.from(
                            new Set([session.subject, ...availableSubjects])
                          ).map((subject) => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          maxLength={140}
                          placeholder="Session note (optional)"
                          className="block w-full max-w-md rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <p className="text-lg font-semibold">
                            {session.subject}
                          </p>
                        </div>

                        {session.note && (
                          <p className="mt-1 text-sm text-white/75">
                            {session.note}
                          </p>
                        )}
                      </>
                    )}

                    <p className="mt-1 text-xs text-white/45">
                      {formatDate(session.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <p className="font-mono text-lg font-semibold">
                      {formatDuration(session.duration)}
                    </p>

                    {editingSessionId === session.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(session.id)}
                          className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-400 transition hover:bg-green-500/20"
                        >
                          Save
                        </button>

                        <button
                          onClick={() => {
                            setEditingSessionId(null);
                            setEditSubject("");
                            setEditNote("");
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingSessionId(session.id);
                            setEditSubject(session.subject);
                            setEditNote(session.note ?? "");
                          }}
                          className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-400 transition hover:bg-blue-500/20"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteSession(session.id)}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
