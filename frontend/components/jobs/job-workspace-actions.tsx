"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { DrawerPanel } from "@/components/drawer-panel";
import { CandidateForm } from "@/components/candidates/candidate-form";
import {
  createCandidate,
  importJobCandidatesBulk,
  type CandidateInput,
  type CandidateUpdateInput,
} from "@/lib/api";

function JobCandidateImportForm({
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
      <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4 text-sm leading-6 text-[var(--color-muted)]">
        Upload one or more text-based CV PDFs with selectable text. Scanned PDFs are not
        supported in this phase, and parsed candidates will be attached directly to this
        job workspace.
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-[var(--color-text)]"
          htmlFor="job-candidate-import-files"
        >
          CV PDFs
        </label>
        <input
          id="job-candidate-import-files"
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
          disabled={files.length === 0 || isSubmitting}
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

export function JobWorkspaceActions({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleImport(files: File[]) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await importJobCandidatesBulk(jobId, files);
      setIsImportOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to import CV batch.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreate(payload: CandidateInput | CandidateUpdateInput) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createCandidate({
        ...(payload as CandidateInput),
        job_id: jobId,
      });
      setIsCreateOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create candidate.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeImportDrawer() {
    if (isSubmitting) {
      return;
    }

    setIsImportOpen(false);
    setErrorMessage(null);
  }

  function closeCreateDrawer() {
    if (isSubmitting) {
      return;
    }

    setIsCreateOpen(false);
    setErrorMessage(null);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsImportOpen(true);
          }}
          className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)]"
        >
          Import CV Batch
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsCreateOpen(true);
          }}
          className="rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white"
        >
          Create Candidate
        </button>
        <Link
          href={`/jobs/${jobId}/benchmarking`}
          className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)]"
        >
          Open Benchmarking
        </Link>
        <Link
          href="/admin/jobs"
          className="rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white"
        >
          Back to Admin Jobs
        </Link>
      </div>

      <DrawerPanel open={isImportOpen} title="Import CV Batch" onClose={closeImportDrawer}>
        <JobCandidateImportForm
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onCancel={closeImportDrawer}
          onSubmit={handleImport}
        />
      </DrawerPanel>

      <DrawerPanel open={isCreateOpen} title="Create Candidate" onClose={closeCreateDrawer}>
        <CandidateForm
          mode="create"
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onCancel={closeCreateDrawer}
          onSubmit={handleCreate}
        />
      </DrawerPanel>
    </>
  );
}
