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
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      if (!data || data.length === 0) {
        const defaultSubjects = [
          { name: "Mathematics" },
          { name: "Programming" },
          { name: "German" },
        ];

        const { data: insertedSubjects, error: insertError } =
          await supabase
            .from("subjects")
            .insert(defaultSubjects)
            .select("id, name");

        if (insertError) {
          console.error(insertError);
          return;
        }

        setSubjects(insertedSubjects || []);
        return;
      }

      setSubjects(data);
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

    if (alreadyExists) return;

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
      })
      .select("id, name")
      .single();

    if (error) {
      console.error(error);
      alert("Could not add subject.");
      return;
    }

    setSubjects((previous) => [...previous, data]);
    setNewSubject("");
  };

  const deleteSubject = async (subjectId: number) => {
    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectId);

    if (error) {
      console.error(error);
      alert("Could not delete subject.");
      return;
    }

    setSubjects((previous) =>
      previous.filter((subject) => subject.id !== subjectId)
    );
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
            key={subject.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4"
          >
            <span className="font-medium">{subject.name}</span>

            <button
              onClick={() => deleteSubject(subject.id)}
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