import Link from "next/link";

import type { Job } from "@/lib/api";

import { StateCard } from "@/components/state-card";

function formatDate(value: string) {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes} UTC`;
}

function formatConfidence(value: number | null) {
  if (value == null) {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

function formatGraphStatus(status: Job["graph_sync_status"]) {
  switch (status) {
    case "synced":
      return "Graph synced";
    case "failed":
      return "Graph failed";
    default:
      return "Graph pending";
  }
}

export function JobList({
  jobs,
  onEdit,
  onDelete,
}: {
  jobs: Job[];
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
}) {
  if (jobs.length === 0) {
    return (
      <StateCard
        title="No jobs yet"
        description="Create the first job to start storing real hiring demand in PostgreSQL."
      />
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {jobs.map((job) => (
        <article
          key={job.id}
          className="rounded-[22px] border border-[var(--color-border)] bg-white p-6 shadow-micro"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                {job.status}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
                {job.title}
              </h3>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/jobs/${job.id}`}
                className="rounded-[12px] bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
              >
                Open Workspace
              </Link>
              <button
                type="button"
                onClick={() => onEdit(job)}
                className="rounded-[12px] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(job)}
                className="rounded-[12px] bg-[#101114] px-4 py-2 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm leading-6 text-[var(--color-muted)]">
            <p>{job.description ?? "No description yet."}</p>
            <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                Required skills
              </p>
              <p className="mt-2">{job.required_skills_text ?? "No required skills captured yet."}</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
              <span>Source {job.source_type}</span>
              {job.extract_source ? <span>Extract {job.extract_source}</span> : null}
              <span>Parse {job.parse_status}</span>
              <span>Engine {job.parse_source}</span>
              <span>Confidence {formatConfidence(job.parse_confidence)}</span>
              <span>{formatGraphStatus(job.graph_sync_status)}</span>
              {job.source_file_name ? <span>File {job.source_file_name}</span> : null}
            </div>
            {job.graph_sync_status === "failed" && job.graph_sync_error ? (
              <p className="text-xs leading-5 text-[#8b2d2d]">
                Graph sync error: {job.graph_sync_error}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
            <span>Created {formatDate(job.created_at)}</span>
            <span>Updated {formatDate(job.updated_at)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
