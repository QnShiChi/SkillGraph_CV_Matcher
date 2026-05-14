"use client";

import { type FormEvent, useEffect, useState } from "react";

import type {
  Candidate,
  CandidateInput,
  CandidateUpdateInput,
} from "@/lib/api";

const statusOptions = ["new", "reviewed", "matched"];

type FormValues = {
  full_name: string;
  email: string;
  resume_text: string;
  skills_text: string;
  status: string;
};

function toFormValues(candidate?: Candidate): FormValues {
  return {
    full_name: candidate?.full_name ?? "",
    email: candidate?.email ?? "",
    resume_text: candidate?.resume_text ?? "",
    skills_text: candidate?.skills_text ?? "",
    status: candidate?.status ?? "new",
  };
}

function buildCreatePayload(values: FormValues): CandidateInput {
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim() || null,
    resume_text: values.resume_text.trim() || null,
    skills_text: values.skills_text.trim() || null,
    status: values.status,
  };
}

function buildUpdatePayload(
  values: FormValues,
  candidate: Candidate,
): CandidateUpdateInput {
  const payload: CandidateUpdateInput = {};
  const fullName = values.full_name.trim();
  const email = values.email.trim() || null;
  const resumeText = values.resume_text.trim() || null;
  const skillsText = values.skills_text.trim() || null;

  if (fullName !== candidate.full_name) {
    payload.full_name = fullName;
  }

  if (email !== candidate.email) {
    payload.email = email;
  }

  if (resumeText !== candidate.resume_text) {
    payload.resume_text = resumeText;
  }

  if (skillsText !== candidate.skills_text) {
    payload.skills_text = skillsText;
  }

  if (values.status !== candidate.status) {
    payload.status = values.status;
  }

  return payload;
}

export function CandidateForm({
  mode,
  candidate,
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  candidate?: Candidate;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (payload: CandidateInput | CandidateUpdateInput) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(toFormValues(candidate));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setValues(toFormValues(candidate));
    setLocalError(null);
  }, [candidate, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!values.full_name.trim()) {
      setLocalError("Full name is required.");
      return;
    }

    if (mode === "create") {
      await onSubmit(buildCreatePayload(values));
      return;
    }

    if (!candidate) {
      setLocalError("Candidate data is not available.");
      return;
    }

    const payload = buildUpdatePayload(values, candidate);

    if (Object.keys(payload).length === 0) {
      setLocalError("No changes to save.");
      return;
    }

    await onSubmit(payload);
  }

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="candidate-name"
        >
          Full name
        </label>
        <input
          id="candidate-name"
          value={values.full_name}
          onChange={(event) => updateField("full_name", event.target.value)}
          className="w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm text-[var(--color-text)] outline-none shadow-[0_10px_24px_rgba(10,20,40,0.04)] transition focus:border-[var(--color-brand)]"
          placeholder="Nguyen Van A"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="candidate-email"
        >
          Email
        </label>
        <input
          id="candidate-email"
          type="email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          className="w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm text-[var(--color-text)] outline-none shadow-[0_10px_24px_rgba(10,20,40,0.04)] transition focus:border-[var(--color-brand)]"
          placeholder="candidate@example.com"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="candidate-resume"
        >
          Resume text
        </label>
        <textarea
          id="candidate-resume"
          value={values.resume_text}
          onChange={(event) => updateField("resume_text", event.target.value)}
          className="min-h-32 w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm leading-6 text-[var(--color-text)] outline-none shadow-[0_10px_24px_rgba(10,20,40,0.04)] transition focus:border-[var(--color-brand)]"
          placeholder="Summarized resume content or parsed CV text."
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="candidate-skills"
        >
          Skills
        </label>
        <textarea
          id="candidate-skills"
          value={values.skills_text}
          onChange={(event) => updateField("skills_text", event.target.value)}
          className="min-h-28 w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm leading-6 text-[var(--color-text)] outline-none shadow-[0_10px_24px_rgba(10,20,40,0.04)] transition focus:border-[var(--color-brand)]"
          placeholder="Python, NLP, PostgreSQL, Neo4j"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="candidate-status"
        >
          Status
        </label>
        <select
          id="candidate-status"
          value={values.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm text-[var(--color-text)] outline-none shadow-[0_10px_24px_rgba(10,20,40,0.04)] transition focus:border-[var(--color-brand)]"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {localError || errorMessage ? (
        <div className="rounded-[20px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-4 py-3 text-sm text-[#8d2020]">
          {localError ?? errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Candidate"
              : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/70 bg-white/80 px-5 py-3 text-sm font-medium text-[var(--color-text)] transition hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
