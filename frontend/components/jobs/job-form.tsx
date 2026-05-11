"use client";

import { type FormEvent, useEffect, useState } from "react";

import type { Job, JobInput, JobUpdateInput } from "@/lib/api";

const statusOptions = ["draft", "analyzed", "archived"];

type FormValues = {
  title: string;
  description: string;
  required_skills_text: string;
  status: string;
};

function toFormValues(job?: Job): FormValues {
  return {
    title: job?.title ?? "",
    description: job?.description ?? "",
    required_skills_text: job?.required_skills_text ?? "",
    status: job?.status ?? "draft",
  };
}

function buildCreatePayload(values: FormValues): JobInput {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    required_skills_text: values.required_skills_text.trim() || null,
    status: values.status,
  };
}

function buildUpdatePayload(values: FormValues, job: Job): JobUpdateInput {
  const payload: JobUpdateInput = {};

  const title = values.title.trim();
  const description = values.description.trim() || null;
  const requiredSkillsText = values.required_skills_text.trim() || null;

  if (title !== job.title) {
    payload.title = title;
  }

  if (description !== job.description) {
    payload.description = description;
  }

  if (requiredSkillsText !== job.required_skills_text) {
    payload.required_skills_text = requiredSkillsText;
  }

  if (values.status !== job.status) {
    payload.status = values.status;
  }

  return payload;
}

export function JobForm({
  mode,
  job,
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  job?: Job;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (payload: JobInput | JobUpdateInput) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(toFormValues(job));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setValues(toFormValues(job));
    setLocalError(null);
  }, [job, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!values.title.trim()) {
      setLocalError("Title is required.");
      return;
    }

    if (mode === "create") {
      await onSubmit(buildCreatePayload(values));
      return;
    }

    if (!job) {
      setLocalError("Job data is not available.");
      return;
    }

    const payload = buildUpdatePayload(values, job);

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
        <label className="text-sm font-semibold text-[var(--color-text)]" htmlFor="job-title">
          Title
        </label>
        <input
          id="job-title"
          value={values.title}
          onChange={(event) => updateField("title", event.target.value)}
          className="w-full rounded-[14px] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)]"
          placeholder="Senior Frontend Engineer"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="job-description"
        >
          Description
        </label>
        <textarea
          id="job-description"
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          className="min-h-32 w-full rounded-[14px] border border-[var(--color-border)] px-4 py-3 text-sm leading-6 text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)]"
          placeholder="Describe the role, responsibilities, and expectations."
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="job-required-skills"
        >
          Required skills
        </label>
        <textarea
          id="job-required-skills"
          value={values.required_skills_text}
          onChange={(event) => updateField("required_skills_text", event.target.value)}
          className="min-h-28 w-full rounded-[14px] border border-[var(--color-border)] px-4 py-3 text-sm leading-6 text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)]"
          placeholder="React, TypeScript, system design, API integration"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-[var(--color-text)]" htmlFor="job-status">
          Status
        </label>
        <select
          id="job-status"
          value={values.status}
          onChange={(event) => updateField("status", event.target.value)}
          className="w-full rounded-[14px] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)]"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {localError || errorMessage ? (
        <div className="rounded-[16px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-4 py-3 text-sm text-[#8d2020]">
          {localError ?? errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-[14px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Job"
              : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[14px] border border-[var(--color-border)] px-5 py-3 text-sm font-medium text-[var(--color-text)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
