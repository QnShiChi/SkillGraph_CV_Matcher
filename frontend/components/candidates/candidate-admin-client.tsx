"use client";

import { useState } from "react";

import { CandidateForm } from "@/components/candidates/candidate-form";
import { CandidateList } from "@/components/candidates/candidate-list";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DrawerPanel } from "@/components/drawer-panel";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";
import {
  type Candidate,
  type CandidateInput,
  type CandidateUpdateInput,
  createCandidate,
  deleteCandidate,
  updateCandidate,
} from "@/lib/api";

type DrawerState =
  | { open: false; mode: "create"; candidate?: undefined }
  | { open: true; mode: "create"; candidate?: undefined }
  | { open: true; mode: "edit"; candidate: Candidate };

export function CandidateAdminClient({
  initialCandidates,
}: {
  initialCandidates: Candidate[];
}) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [drawerState, setDrawerState] = useState<DrawerState>({
    open: false,
    mode: "create",
  });
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortedCandidates = [...candidates].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  function openCreateDrawer() {
    setFormError(null);
    setDrawerState({ open: true, mode: "create" });
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Candidates"
        description="Review candidate records imported from job workspaces and maintain manual entries when needed."
        action={
          <button
            type="button"
            onClick={openCreateDrawer}
            className="rounded-[14px] border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text)]"
          >
            Create Candidate
          </button>
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
          description="Candidates are now imported from job workspaces, then reviewed here as a supporting admin view."
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
        onEdit={openEditDrawer}
        onDelete={setDeleteTarget}
      />

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
            ? `This will permanently remove "${deleteTarget.full_name}" from PostgreSQL.`
            : ""
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete Candidate"}
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
