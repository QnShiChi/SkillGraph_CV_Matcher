"use client";

import { useState } from "react";

import { CandidateForm } from "@/components/candidates/candidate-form";
import { CandidateJobImportForm } from "@/components/candidates/candidate-job-import-form";
import { CandidateList } from "@/components/candidates/candidate-list";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DrawerPanel } from "@/components/drawer-panel";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";
import {
  type Candidate,
  type CandidateInput,
  type CandidateUpdateInput,
  type Job,
  createCandidate,
  deleteCandidate,
  getCandidates,
  importJobCandidatesBulk,
  updateCandidate,
} from "@/lib/api";

function normalizeCandidates(value: Candidate[] | null | undefined): Candidate[] {
  return Array.isArray(value) ? value : [];
}

type DrawerState =
  | { open: false; mode: "create"; candidate?: undefined }
  | { open: true; mode: "create"; candidate?: undefined }
  | { open: true; mode: "edit"; candidate: Candidate };

export function CandidateAdminClient({
  initialCandidates,
  initialJobs,
}: {
  initialCandidates: Candidate[];
  initialJobs: Job[];
}) {
  const [candidates, setCandidates] = useState<Candidate[]>(
    normalizeCandidates(initialCandidates),
  );
  const [drawerState, setDrawerState] = useState<DrawerState>({
    open: false,
    mode: "create",
  });
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const sortedCandidates = [...normalizeCandidates(candidates)].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  function openCreateDrawer() {
    setFormError(null);
    setDrawerState({ open: true, mode: "create" });
  }

  function openImportDrawer() {
    setImportError(null);
    setIsImportOpen(true);
  }

  function openEditDrawer(candidate: Candidate) {
    setFormError(null);
    setDrawerState({ open: true, mode: "edit", candidate });
  }

  function closeDrawer() {
    if (isSubmitting) {
      return;
    }

    setDrawerState({ open: false, mode: "create" });
    setFormError(null);
  }

  function closeImportDrawer() {
    if (isSubmitting) {
      return;
    }

    setIsImportOpen(false);
    setImportError(null);
  }

  async function handleSubmit(payload: CandidateInput | CandidateUpdateInput) {
    setIsSubmitting(true);
    setFormError(null);
    setListError(null);

    try {
      if (drawerState.mode === "create") {
        const createdCandidate = await createCandidate(payload as CandidateInput);
        setCandidates((current) => [createdCandidate, ...current]);
      } else {
        const updatedCandidate = await updateCandidate(
          drawerState.candidate.id,
          payload as CandidateUpdateInput,
        );
        setCandidates((current) =>
          current.map((candidate) =>
            candidate.id === updatedCandidate.id ? updatedCandidate : candidate,
          ),
        );
      }

      setDrawerState({ open: false, mode: "create" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save candidate.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.job_id) {
      setListError(
        `Candidate "${deleteTarget.full_name}" belongs to job ${deleteTarget.job_id}. Delete it from that job workspace instead.`,
      );
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    setListError(null);

    try {
      await deleteCandidate(deleteTarget.id);
      setCandidates((current) =>
        current.filter((candidate) => candidate.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to delete candidate.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleImport(jobId: number, files: File[]) {
    setIsSubmitting(true);
    setImportError(null);
    setListError(null);

    try {
      await importJobCandidatesBulk(jobId, files);
      const refreshedCandidates = await getCandidates();
      setCandidates(normalizeCandidates(refreshedCandidates));
      setIsImportOpen(false);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Unable to import CV batch.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Candidates"
        description="Review candidate records imported from job workspaces, launch CV imports from here, and maintain manual entries when needed."
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openImportDrawer}
              className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)] transition hover:opacity-95"
            >
              Import CV Batch
            </button>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="rounded-full border border-white/70 bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white"
            >
              Create Candidate
            </button>
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StateCard
          title="Persisted candidates"
          description="This reflects the global candidate pool persisted in PostgreSQL."
        >
          <p className="text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
            {candidates.length}
          </p>
        </StateCard>
        <StateCard
          title="Workflow"
          description="CV import is available directly from this page, but each imported candidate still belongs to a selected job workspace."
        />
        <StateCard
          title="Storage"
          description="Candidate text, grouped skills, provenance, and graph sync metadata remain queryable here."
        />
      </div>

      {listError ? (
        <div className="rounded-[18px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-5 py-4 text-sm text-[#8d2020]">
          {listError}
        </div>
      ) : null}

      <CandidateList
        candidates={sortedCandidates}
        jobs={initialJobs}
        onEdit={openEditDrawer}
        onDelete={setDeleteTarget}
      />

      <DrawerPanel
        open={isImportOpen}
        title="Import Candidates"
        onClose={closeImportDrawer}
      >
        <CandidateJobImportForm
          jobs={initialJobs}
          isSubmitting={isSubmitting}
          errorMessage={importError}
          onCancel={closeImportDrawer}
          onSubmit={handleImport}
        />
      </DrawerPanel>

      <DrawerPanel
        open={drawerState.open}
        title={drawerState.mode === "create" ? "Create Candidate" : "Edit Candidate"}
        onClose={closeDrawer}
      >
        <CandidateForm
          mode={drawerState.mode}
          candidate={drawerState.mode === "edit" ? drawerState.candidate : undefined}
          isSubmitting={isSubmitting}
          errorMessage={formError}
          onCancel={closeDrawer}
          onSubmit={handleSubmit}
        />
      </DrawerPanel>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete candidate permanently?"
        description={
          deleteTarget
            ? deleteTarget.job_id
              ? `"${deleteTarget.full_name}" belongs to job ${deleteTarget.job_id} and cannot be deleted from Admin Candidates.`
              : `This will permanently remove "${deleteTarget.full_name}" from PostgreSQL.`
            : ""
        }
        confirmLabel={
          deleteTarget?.job_id
            ? "Delete in Job Workspace"
            : isDeleting
              ? "Deleting..."
              : "Delete Candidate"
        }
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
