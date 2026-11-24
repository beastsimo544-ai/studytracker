"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Subject = {
  id: number;
  name: string;
};

export default function SubjectPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
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

      const { data, error } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Fetch subjects failed:", error);
        setIsLoading(false);
        return;
      }

      setSubjects(data || []);
      setIsLoading(false);
    };

    fetchSubjects();
  }, [router]);

  const addSubject = async () => {
    const trimmedSubject = newSubject.trim();

    if (!trimmedSubject) return;

    const alreadyExists = subjects.some(
      (subject) =>
        subject.name.toLowerCase() === trimmedSubject.toLowerCase()
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

    const { data, error } = await supabase
      .from("subjects")
      .insert({
        name: trimmedSubject,
        user_id: user.id,
      })
      .select("id, name")
      .single();

    if (error) {
      console.error("Add subject failed:", error);
      alert("Could not add subject.");
      return;
    }

    setSubjects((previous) => [...previous, data]);
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
    if (currentSubject && currentSubject.name === trimmedName) {
      setEditingSubjectId(null);
      setEditingName("");
      return;
    }

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

    const { data: updatedRows, error } = await supabase
      .from("subjects")
      .update({
        name: trimmedName,
      })
      .eq("id", subjectId)
      .eq("user_id", user.id)
      .select("id, name");

    if (error) {
      console.error(error);
      alert("Could not rename subject.");
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      alert(
        "The database did not update this subject. Check that an UPDATE RLS policy is enabled on the subjects table."
      );
      return;
    }

    const updatedSubject = updatedRows[0];

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
        subject.id === subjectId ? updatedSubject : subject
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
          Create and manage the subjects you study.
        </p>
      </div>

      <div className="mt-10 flex gap-3">
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
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
        />

        <button
          onClick={addSubject}
          className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90"
        >
          Add Subject
        </button>
      </div>

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
          <>
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4"
              >
                {editingSubjectId === subject.id ? (
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
                    className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 outline-none"
                  />
                ) : (
                  <span className="font-medium">{subject.name}</span>
                )}

                <div className="flex gap-2">
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
            ))}
          </>
        )}
      </div>
    </main>
  );
}
