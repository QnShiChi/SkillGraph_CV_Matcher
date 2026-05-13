"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export function CvImportForm({
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  isSubmitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (files: File[]) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      return;
    }

    await onSubmit(files);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4 text-sm leading-6 text-[var(--color-muted)]">
        Upload one or more text-based CV PDFs. Each file is parsed independently,
        keeps its own evidence snippets, and syncs graph-safe skills to Neo4j without
        blocking the rest of the batch.
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="cv-pdf-file"
        >
          CV PDFs
        </label>
        <input
          id="cv-pdf-file"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          className="w-full rounded-[14px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)]"
        />
        <p className="text-xs text-[var(--color-muted)]">
          {files.length > 0
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Select one or more PDF resumes."}
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-[16px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-4 py-3 text-sm text-[#8d2020]">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={files.length === 0 || isSubmitting}
          className="rounded-[14px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Importing..." : "Import CV Batch"}
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
