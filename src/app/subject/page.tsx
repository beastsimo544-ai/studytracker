"use client";

import { useEffect, useState } from "react";

export default function SubjectPage() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");

  useEffect(() => {
    const savedSubjects = JSON.parse(
      localStorage.getItem("studySubjects") || "[]"
    );

    if (savedSubjects.length === 0) {
      const defaultSubjects = ["Mathematics", "Programming", "German"];

      localStorage.setItem(
        "studySubjects",
        JSON.stringify(defaultSubjects)
      );

      setSubjects(defaultSubjects);
    } else {
      setSubjects(savedSubjects);
    }
  }, []);

  const saveSubjects = (updatedSubjects: string[]) => {
    setSubjects(updatedSubjects);

    localStorage.setItem(
      "studySubjects",
      JSON.stringify(updatedSubjects)
    );
  };

  const addSubject = () => {
    const trimmedSubject = newSubject.trim();

    if (!trimmedSubject) return;

    if (subjects.includes(trimmedSubject)) return;

    const updatedSubjects = [...subjects, trimmedSubject];

    saveSubjects(updatedSubjects);
    setNewSubject("");
  };

  const deleteSubject = (subjectToDelete: string) => {
    const updatedSubjects = subjects.filter(
      (subject) => subject !== subjectToDelete
    );

    saveSubjects(updatedSubjects);
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
          className="rounded-xl bg-white px-6 py-3 font-semibold text-black"
        >
          Add Subject
        </button>
      </div>

      <div className="mt-8 space-y-3">
        {subjects.map((subject) => (
          <div
            key={subject}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4"
          >
            <span className="font-medium">{subject}</span>

            <button
              onClick={() => deleteSubject(subject)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}