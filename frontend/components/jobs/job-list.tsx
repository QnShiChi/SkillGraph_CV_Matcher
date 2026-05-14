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
    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {jobs.map((job) => {
        return (
          <article
            key={job.id}
            className="group relative overflow-hidden rounded-[22px] border border-white/70 bg-white/88 p-4 shadow-[0_16px_42px_rgba(10,20,40,0.07)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(10,20,40,0.11)]"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full bg-[var(--color-brand-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                      {job.status}
                    </span>
                    <span className="inline-flex rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {formatGraphStatus(job.graph_sync_status)}
                    </span>
                  </div>
                  <h3 className="truncate text-[1.05rem] font-bold leading-6 tracking-[-0.03em] text-[var(--color-text)]">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="relative z-10 inline transition group-hover:text-[var(--color-brand-dark)] group-hover:underline"
                    >
                      {job.title}
                    </Link>
                  </h3>
                </div>

                <div className="relative z-20 flex shrink-0 flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(job);
                    }}
                    className="rounded-full border border-white/70 bg-white/92 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text)] transition hover:bg-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(job);
                    }}
                    className="rounded-full bg-[var(--color-brand-deep)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_22px_rgba(11,28,48,0.16)]"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <Link
                href={`/jobs/${job.id}`}
                aria-label={`Open job ${job.title}`}
                className="block rounded-[18px] transition hover:bg-[rgba(75,65,225,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(75,65,225,0.28)]"
              >
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                  <span>Source {job.source_type}</span>
                  <span>Parse {job.parse_status}</span>
                  <span>Confidence {formatConfidence(job.parse_confidence)}</span>
                  <span>Created {formatDate(job.created_at)}</span>
                  {job.source_file_name ? <span>File {job.source_file_name}</span> : null}
                </div>

                {job.graph_sync_status === "failed" && job.graph_sync_error ? (
                  <p className="mt-2 text-xs leading-5 text-[#8b2d2d]">
                    Graph sync error: {job.graph_sync_error}
                  </p>
                ) : null}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
