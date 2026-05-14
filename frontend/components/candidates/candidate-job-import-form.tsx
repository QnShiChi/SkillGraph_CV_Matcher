"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import type { Job } from "@/lib/api";

export function CandidateJobImportForm({
  jobs,
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  jobs: Job[];
  isSubmitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (jobId: number, files: File[]) => Promise<void>;
}) {
  const [jobId, setJobId] = useState<string>(jobs[0] ? String(jobs[0].id) : "");
  const [files, setFiles] = useState<File[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!jobId || files.length === 0) {
      return;
    }

    await onSubmit(Number(jobId), files);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4 text-sm leading-6 text-[var(--color-muted)]">
        Import CV PDFs directly from the Candidates admin page, but assign them to a job
        workspace first. The backend currently parses and stores imported candidates under
        the selected job.
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-[var(--color-text)]" htmlFor="candidate-import-job">
          Target job
        </label>
        <select
          id="candidate-import-job"
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
          className="w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm text-[var(--color-text)] shadow-[0_10px_24px_rgba(10,20,40,0.04)] outline-none"
        >
          {jobs.length ? (
            jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))
          ) : (
            <option value="">No jobs available</option>
          )}
        </select>
        <p className="text-xs text-[var(--color-muted)]">
          Imported candidates will belong to the selected job workspace.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-[var(--color-text)]" htmlFor="candidate-import-files">
          CV PDFs
        </label>
        <input
          id="candidate-import-files"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          className="w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm text-[var(--color-text)] shadow-[0_10px_24px_rgba(10,20,40,0.04)]"
        />
        <p className="text-xs text-[var(--color-muted)]">
          {files.length > 0
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Select one or more text-based PDF resumes with selectable text."}
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-[20px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-4 py-3 text-sm text-[#8d2020]">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!jobId || files.length === 0 || isSubmitting || jobs.length === 0}
          className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Importing..." : "Import CV Batch"}
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
