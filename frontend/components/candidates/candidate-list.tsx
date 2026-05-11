import type { Candidate } from "@/lib/api";

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

export function CandidateList({
  candidates,
  onEdit,
  onDelete,
}: {
  candidates: Candidate[];
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
}) {
  if (candidates.length === 0) {
    return (
      <StateCard
        title="No candidates yet"
        description="Create the first candidate profile to start testing CV persistence and downstream ranking."
      />
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {candidates.map((candidate) => (
        <article
          key={candidate.id}
          className="rounded-[22px] border border-[var(--color-border)] bg-white p-6 shadow-micro"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                {candidate.status}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
                {candidate.full_name}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {candidate.email ?? "No email captured."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(candidate)}
                className="rounded-[12px] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(candidate)}
                className="rounded-[12px] bg-[#101114] px-4 py-2 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 text-sm leading-6 text-[var(--color-muted)]">
            <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                Resume text
              </p>
              <p className="mt-2">{candidate.resume_text ?? "No resume text captured yet."}</p>
            </div>
            <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                Skills
              </p>
              <p className="mt-2">{candidate.skills_text ?? "No skills captured yet."}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
            <span>Created {formatDate(candidate.created_at)}</span>
            <span>Updated {formatDate(candidate.updated_at)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
