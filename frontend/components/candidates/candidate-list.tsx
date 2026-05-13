import Link from "next/link";

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

function formatConfidence(value: number | null) {
  if (value == null) {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

function formatGraphStatus(status: Candidate["graph_sync_status"]) {
  switch (status) {
    case "synced":
      return "Graph synced";
    case "failed":
      return "Graph failed";
    default:
      return "Graph pending";
  }
}

type StructuredSkill = {
  name: string;
  canonical: string;
  evidence?: Array<{ text: string; section_origin: string }>;
};

type StructuredCv = {
  summary?: string | null;
  technical_skills?: StructuredSkill[];
  platforms_cloud?: StructuredSkill[];
  tooling_devops?: StructuredSkill[];
};

function readStructuredCv(candidate: Candidate): StructuredCv | null {
  if (!candidate.structured_cv_json || typeof candidate.structured_cv_json !== "object") {
    return null;
  }

  return candidate.structured_cv_json as StructuredCv;
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
        <article key={candidate.id} className="rounded-[22px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
          {(() => {
            const structured = readStructuredCv(candidate);
            const technicalSkills = structured?.technical_skills ?? [];
            const platformSkills = structured?.platforms_cloud ?? [];
            const toolingSkills = structured?.tooling_devops ?? [];
            const topEvidence =
              technicalSkills.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
              platformSkills.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
              toolingSkills.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
              null;

            return (
              <>
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
              {candidate.job_id ? (
                <Link
                  href={`/jobs/${candidate.job_id}`}
                  className="rounded-[12px] bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
                >
                  Open Job
                </Link>
              ) : null}
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
                disabled={Boolean(candidate.job_id)}
                className="rounded-[12px] bg-[#101114] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[rgba(16,17,20,0.2)]"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 text-sm leading-6 text-[var(--color-muted)]">
            {structured?.summary ? (
              <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                  Summary
                </p>
                <p className="mt-2">{structured.summary}</p>
              </div>
            ) : null}
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
            {technicalSkills.length || platformSkills.length || toolingSkills.length ? (
              <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                  Structured groups
                </p>
                <div className="mt-2 space-y-1">
                  <p>Technical: {technicalSkills.map((skill) => skill.name).join(", ") || "None"}</p>
                  <p>Cloud: {platformSkills.map((skill) => skill.name).join(", ") || "None"}</p>
                  <p>Tooling: {toolingSkills.map((skill) => skill.name).join(", ") || "None"}</p>
                </div>
              </div>
            ) : null}
            {topEvidence ? (
              <div className="rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                  Evidence sample
                </p>
                <p className="mt-2">{topEvidence.text}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.14em]">
                  Source {topEvidence.section_origin}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
              <span>Source {candidate.source_type}</span>
              {candidate.job_id ? <span>Owned by job {candidate.job_id}</span> : <span>Global candidate</span>}
              {candidate.extract_source ? <span>Extract {candidate.extract_source}</span> : null}
              <span>Parse {candidate.parse_status}</span>
              <span>Engine {candidate.parse_source}</span>
              <span>Confidence {formatConfidence(candidate.parse_confidence)}</span>
              <span>{formatGraphStatus(candidate.graph_sync_status)}</span>
              {candidate.source_file_name ? <span>File {candidate.source_file_name}</span> : null}
            </div>
            {candidate.graph_sync_status === "failed" && candidate.graph_sync_error ? (
              <p className="text-xs leading-5 text-[#8b2d2d]">
                Graph sync error: {candidate.graph_sync_error}
              </p>
            ) : null}
            {candidate.job_id ? (
              <p className="text-xs leading-5 text-[var(--color-muted)]">
                This candidate belongs to job workspace {candidate.job_id}. Delete it from that workspace to avoid accidental data loss.
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
            <span>Created {formatDate(candidate.created_at)}</span>
            <span>Updated {formatDate(candidate.updated_at)}</span>
          </div>
              </>
            );
          })()}
        </article>
      ))}
    </div>
  );
}
