"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SUBJECT_COLOR_OPTIONS,
  resolveSubjectColor,
} from "@/lib/subject-colors";
import { supabase } from "@/lib/supabase";

type Subject = {
  id: number;
  name: string;
  color?: string | null;
};

export default function SubjectPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [newColor, setNewColor] = useState(SUBJECT_COLOR_OPTIONS[0].hex);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState(
    SUBJECT_COLOR_OPTIONS[0].hex
  );
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const fetchSubjects = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const fullRes = await supabase
        .from("subjects")
        .select("id, name, color")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (fullRes.error && fullRes.error.message.includes("color")) {
        const fallbackRes = await supabase
          .from("subjects")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (fallbackRes.error) {
          console.error("Fetch subjects failed:", fallbackRes.error);
          setIsLoading(false);
          return;
        }

        setSubjects((fallbackRes.data || []) as Subject[]);
        setIsLoading(false);
        return;
      }

      if (fullRes.error) {
        console.error("Fetch subjects failed:", fullRes.error);
        setIsLoading(false);
        return;
      }

      setSubjects((fullRes.data || []) as Subject[]);
      setIsLoading(false);
    };

    fetchSubjects();
  }, [router]);

  const addSubject = async () => {
    const trimmedSubject = newSubject.trim();

    if (!trimmedSubject) return;

    const alreadyExists = subjects.some(
      (subject) => subject.name.toLowerCase() === trimmedSubject.toLowerCase()
    );

    if (alreadyExists) {
      alert("That subject already exists.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to add a subject.");
      return;
    }

    const fullInsert = await supabase
      .from("subjects")
      .insert({
        name: trimmedSubject,
        color: newColor,
        user_id: user.id,
      })
      .select("id, name, color")
      .single();

    if (fullInsert.error && fullInsert.error.message.includes("color")) {
      const fallbackInsert = await supabase
        .from("subjects")
        .insert({
          name: trimmedSubject,
          user_id: user.id,
        })
        .select("id, name")
        .single();

      if (fallbackInsert.error) {
        console.error("Add subject failed:", fallbackInsert.error);
        alert("Could not add subject.");
        return;
      }

      setSubjects((previous) => [
        ...previous,
        { ...(fallbackInsert.data as Subject), color: newColor },
      ]);
      setNewSubject("");
      return;
    }

    if (fullInsert.error) {
      console.error("Add subject failed:", fullInsert.error);
      alert("Could not add subject.");
      return;
    }

    setSubjects((previous) => [...previous, fullInsert.data as Subject]);
    setNewSubject("");
  };

  const deleteSubject = async (subjectId: number) => {
    const targetSubject = subjects.find((s) => s.id === subjectId);
    if (!targetSubject) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${targetSubject.name}"?`
    );
    if (!confirmed) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to delete subjects.");
      return;
    }

    const { data: deletedRows, error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectId)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      console.error("Delete failed:", error);

      if (error.message.includes("FOREIGN KEY")) {
        alert(
          "Could not delete subject because study sessions still reference it."
        );
      } else {
        alert(`Could not delete subject: ${error.message}`);
      }

      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      alert(
        "The database did not delete this subject. Check that a DELETE RLS policy is enabled on the subjects table."
      );
      return;
    }

    setSubjects((previous) =>
      previous.filter((subject) => subject.id !== subjectId)
    );
  };

  const saveSubjectEdit = async (subjectId: number) => {
    const trimmedName = editingName.trim();

    if (!trimmedName) {
      alert("Subject name cannot be empty.");
      return;
    }

    const currentSubject = subjects.find((s) => s.id === subjectId);

    const duplicateExists = subjects.some(
      (subject) =>
        subject.id !== subjectId &&
        subject.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateExists) {
      alert("That subject already exists.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to rename subjects.");
      return;
    }

    let updatedSubject: Subject | null = null;

    const fullUpdate = await supabase
      .from("subjects")
      .update({
        name: trimmedName,
        color: editingColor,
      })
      .eq("id", subjectId)
      .eq("user_id", user.id)
      .select("id, name, color");

    if (fullUpdate.error && fullUpdate.error.message.includes("color")) {
      const fallbackUpdate = await supabase
        .from("subjects")
        .update({
          name: trimmedName,
        })
        .eq("id", subjectId)
        .eq("user_id", user.id)
        .select("id, name");

      if (fallbackUpdate.error) {
        console.error(fallbackUpdate.error);
        alert("Could not update subject.");
        return;
      }

      if (!fallbackUpdate.data || fallbackUpdate.data.length === 0) {
        alert(
          "The database did not update this subject. Check that an UPDATE RLS policy is enabled on the subjects table."
        );
        return;
      }

      updatedSubject = {
        ...(fallbackUpdate.data[0] as Subject),
        color: editingColor,
      };
    } else if (fullUpdate.error) {
      console.error(fullUpdate.error);
      alert("Could not update subject.");
      return;
    } else if (!fullUpdate.data || fullUpdate.data.length === 0) {
      alert(
        "The database did not update this subject. Check that an UPDATE RLS policy is enabled on the subjects table."
      );
      return;
    } else {
      updatedSubject = fullUpdate.data[0] as Subject;
    }

    // Keep past study sessions and any active timer synced with the new subject name
    if (currentSubject && currentSubject.name !== trimmedName) {
      const { error: sessionsUpdateError } = await supabase
        .from("study_sessions")
        .update({ subject: trimmedName })
        .eq("user_id", user.id)
        .eq("subject", currentSubject.name);

      if (sessionsUpdateError) {
        console.error(
          "Could not update past study sessions for renamed subject:",
          sessionsUpdateError
        );
      }

      const savedTimer = localStorage.getItem("studyTimer");
      if (savedTimer) {
        try {
          const parsed = JSON.parse(savedTimer);
          if (parsed.selectedSubject === currentSubject.name) {
            localStorage.setItem(
              "studyTimer",
              JSON.stringify({ ...parsed, selectedSubject: trimmedName })
            );
          }
        } catch {
          // Ignore malformed timer state
        }
      }
    }

    setSubjects((previous) =>
      previous.map((subject) =>
        subject.id === subjectId && updatedSubject ? updatedSubject : subject
      )
    );

    setEditingSubjectId(null);
    setEditingName("");
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Subjects</h1>
        <p className="mt-2 text-white/60">
          Create and color-code the subjects you study.
        </p>
      </div>

      {/* ADD SUBJECT CARD */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addSubject();
              }
            }}
            placeholder="Add a new subject..."
            className="flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 outline-none"
          />

          <button
            onClick={addSubject}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90"
          >
            Add Subject
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-white/50">Color:</span>
          {SUBJECT_COLOR_OPTIONS.map((opt) => {
            const selected = newColor.toLowerCase() === opt.hex.toLowerCase();
            return (
              <button
                key={opt.hex}
                type="button"
                title={opt.label}
                aria-label={`Select ${opt.label} color`}
                onClick={() => setNewColor(opt.hex)}
                className={`h-6 w-6 rounded-full transition ${
                  selected
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]"
                    : "opacity-75 hover:opacity-100"
                }`}
                style={{ backgroundColor: opt.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* SUBJECT LIST */}
      <div className="mt-8 space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/60">Loading subjects...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/60">No subjects yet.</p>
          </div>
        ) : (
          subjects.map((subject) => {
            const activeColor = resolveSubjectColor(subject.name, {
              [subject.name]: subject.color,
            });

            return (
              <div
                key={subject.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {editingSubjectId === subject.id ? (
                  <div className="flex flex-1 flex-col gap-3">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          saveSubjectEdit(subject.id);
                        } else if (e.key === "Escape") {
                          setEditingSubjectId(null);
                          setEditingName("");
                        }
                      }}
                      className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 outline-none"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {SUBJECT_COLOR_OPTIONS.map((opt) => {
                        const selected =
                          editingColor.toLowerCase() === opt.hex.toLowerCase();
                        return (
                          <button
                            key={opt.hex}
                            type="button"
                            title={opt.label}
                            onClick={() => setEditingColor(opt.hex)}
                            className={`h-5 w-5 rounded-full transition ${
                              selected
                                ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]"
                                : "opacity-70 hover:opacity-100"
                            }`}
                            style={{ backgroundColor: opt.hex }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: activeColor }}
                    />
                    <span className="font-medium">{subject.name}</span>
                  </div>
                )}

                <div className="flex gap-2 self-end sm:self-auto">
                  {editingSubjectId === subject.id ? (
                    <>
                      <button
                        onClick={() => saveSubjectEdit(subject.id)}
                        className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm text-green-400"
                      >
                        Save
                      </button>

                      <button
                        onClick={() => {
                          setEditingSubjectId(null);
                          setEditingName("");
                        }}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingSubjectId(subject.id);
                          setEditingName(subject.name);
                          setEditingColor(activeColor);
                        }}
                        className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteSubject(subject.id)}
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
