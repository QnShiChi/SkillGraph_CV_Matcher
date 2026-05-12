"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export function JdImportForm({
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  isSubmitting: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      return;
    }

    await onSubmit(file);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4 text-sm leading-6 text-[var(--color-muted)]">
        Upload a text-based JD PDF. Scanned PDFs are not supported in this phase,
        and the system will reject unreadable files.
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="jd-pdf-file"
        >
          JD PDF
        </label>
        <input
          id="jd-pdf-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-[14px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)]"
        />
      </div>

      {errorMessage ? (
        <div className="rounded-[16px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-4 py-3 text-sm text-[#8d2020]">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!file || isSubmitting}
          className="rounded-[14px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Importing..." : "Import JD PDF"}
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
