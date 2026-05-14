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
      <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4 text-sm leading-6 text-[var(--color-muted)]">
        Upload a text-based JD PDF with selectable text. Scanned PDFs are not
        supported in this phase, and the system will reject unreadable files.
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
          className="w-full rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-sm text-[var(--color-text)] shadow-[0_10px_24px_rgba(10,20,40,0.04)]"
        />
      </div>

      {errorMessage ? (
        <div className="rounded-[20px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-4 py-3 text-sm text-[#8d2020]">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!file || isSubmitting}
          className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Importing..." : "Import JD PDF"}
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
