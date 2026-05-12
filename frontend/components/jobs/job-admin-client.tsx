"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DrawerPanel } from "@/components/drawer-panel";
import { JdImportForm } from "@/components/jobs/jd-import-form";
import { JobForm } from "@/components/jobs/job-form";
import { JobList } from "@/components/jobs/job-list";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";
import {
  createJob,
  deleteJob,
  importJobPdf,
  type Job,
  type JobInput,
  type JobUpdateInput,
  updateJob,
} from "@/lib/api";

type DrawerState =
  | { open: false; mode: "create"; job?: undefined }
  | { open: true; mode: "create"; job?: undefined }
  | { open: true; mode: "edit"; job: Job };

export function JobAdminClient({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [drawerState, setDrawerState] = useState<DrawerState>({
    open: false,
    mode: "create",
  });
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const sortedJobs = [...jobs].sort(
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

  function openEditDrawer(job: Job) {
    setFormError(null);
    setDrawerState({ open: true, mode: "edit", job });
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

  async function handleSubmit(payload: JobInput | JobUpdateInput) {
    setIsSubmitting(true);
    setFormError(null);
    setListError(null);

    try {
      if (drawerState.mode === "create") {
        const createdJob = await createJob(payload as JobInput);
        setJobs((current) => [createdJob, ...current]);
      } else {
        const updatedJob = await updateJob(drawerState.job.id, payload as JobUpdateInput);
        setJobs((current) =>
          current.map((job) => (job.id === updatedJob.id ? updatedJob : job)),
        );
      }

      setDrawerState({ open: false, mode: "create" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save job.");
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
      await deleteJob(deleteTarget.id);
      setJobs((current) => current.filter((job) => job.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to delete job.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleImport(file: File) {
    setIsSubmitting(true);
    setImportError(null);
    setListError(null);

    try {
      const importedJob = await importJobPdf(file);
      setJobs((current) => [importedJob, ...current]);
      setIsImportOpen(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import JD PDF.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Jobs"
        description="Create, edit, and delete job descriptions from a dedicated workspace backed by PostgreSQL."
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openImportDrawer}
              className="rounded-[14px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)]"
            >
              Import JD PDF
            </button>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="rounded-[14px] border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text)]"
            >
              Create Job
            </button>
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StateCard
          title="Persisted jobs"
          description="This total updates immediately after create, edit, or hard delete."
        >
          <p className="text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
            {jobs.length}
          </p>
        </StateCard>
        <StateCard
          title="Workflow"
          description="Draft jobs can be refined before moving to analysis and downstream matching."
        />
        <StateCard
          title="Storage"
          description="All changes write directly to PostgreSQL through the FastAPI CRUD endpoints."
        />
      </div>

      {listError ? (
        <div className="rounded-[18px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-5 py-4 text-sm text-[#8d2020]">
          {listError}
        </div>
      ) : null}

      <JobList jobs={sortedJobs} onEdit={openEditDrawer} onDelete={setDeleteTarget} />

      <DrawerPanel
        open={drawerState.open}
        title={drawerState.mode === "create" ? "Create Job" : "Edit Job"}
        onClose={closeDrawer}
      >
        <JobForm
          mode={drawerState.mode}
          job={drawerState.mode === "edit" ? drawerState.job : undefined}
          isSubmitting={isSubmitting}
          errorMessage={formError}
          onCancel={closeDrawer}
          onSubmit={handleSubmit}
        />
      </DrawerPanel>

      <DrawerPanel
        open={isImportOpen}
        title="Import JD PDF"
        onClose={closeImportDrawer}
      >
        <JdImportForm
          isSubmitting={isSubmitting}
          errorMessage={importError}
          onCancel={closeImportDrawer}
          onSubmit={handleImport}
        />
      </DrawerPanel>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete job permanently?"
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.title}" from PostgreSQL.`
            : ""
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete Job"}
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
