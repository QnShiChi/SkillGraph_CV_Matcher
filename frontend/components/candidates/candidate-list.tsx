"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Candidate, Job } from "@/lib/api";

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

function truncateText(value: string | null | undefined, limit: number) {
  if (!value) {
    return null;
  }

  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trim()}...`;
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

type CandidateGroup = {
  key: string;
  title: string;
  description: string;
  candidates: Candidate[];
  jobId: number | null;
};

function readStructuredCv(candidate: Candidate): StructuredCv | null {
  if (!candidate.structured_cv_json || typeof candidate.structured_cv_json !== "object") {
    return null;
  }

  return candidate.structured_cv_json as StructuredCv;
}

function readSkills(candidate: Candidate, structured: StructuredCv | null) {
  const structuredSkills = [
    ...(structured?.technical_skills ?? []).map((skill) => skill.name),
    ...(structured?.platforms_cloud ?? []).map((skill) => skill.name),
    ...(structured?.tooling_devops ?? []).map((skill) => skill.name),
  ];

  if (structuredSkills.length > 0) {
    return [...new Set(structuredSkills)];
  }

  return (candidate.skills_text ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function groupCandidates(candidates: Candidate[], jobs: Job[]): CandidateGroup[] {
  const jobTitleById = new Map(jobs.map((job) => [job.id, job.title]));
  const grouped = new Map<string, CandidateGroup>();

  for (const candidate of candidates) {
    const key = candidate.job_id == null ? "global" : `job:${candidate.job_id}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.candidates.push(candidate);
      continue;
    }

    const title =
      candidate.job_id == null
        ? "Global Candidates"
        : jobTitleById.get(candidate.job_id) ?? `Job #${candidate.job_id}`;

    grouped.set(key, {
      key,
      title,
      description:
        candidate.job_id == null
          ? "Candidates not attached to any job workspace yet."
          : "Click to review candidates imported under this job.",
      candidates: [candidate],
      jobId: candidate.job_id,
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      candidates: [...group.candidates].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    }))
    .sort((left, right) => {
      if (left.jobId == null && right.jobId != null) {
        return 1;
      }
      if (left.jobId != null && right.jobId == null) {
        return -1;
      }
      return left.title.localeCompare(right.title);
    });
}

export function CandidateList({
  candidates,
  jobs,
  onEdit,
  onDelete,
}: {
  candidates: Candidate[];
  jobs: Job[];
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const groupedCandidates = useMemo(() => groupCandidates(candidates, jobs), [candidates, jobs]);

  if (candidates.length === 0) {
    return (
      <StateCard
        title="No candidates yet"
        description="Create the first candidate profile to start testing CV persistence and downstream ranking."
      />
    );
  }

  function toggleExpanded(candidateId: number) {
    setExpandedIds((current) => ({
      ...current,
      [candidateId]: !current[candidateId],
    }));
  }

  return (
    <div className="space-y-5">
      {groupedCandidates.map((group, index) => (
        <details
          key={group.key}
          open={index === 0}
          className="group overflow-hidden rounded-[28px] border border-white/70 bg-white/84 shadow-[0_20px_60px_rgba(10,20,40,0.07)] backdrop-blur-xl"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-5 marker:hidden">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#14b8a6_100%)]" />
                <h3 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[var(--color-text)]">
                  {group.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                {group.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                {group.candidates.length} candidates
              </span>
              <span className="material-symbols-outlined mt-0.5 text-[20px] text-[var(--color-brand-dark)] transition group-open:rotate-180">
                expand_more
              </span>
            </div>
          </summary>

          <div className="border-t border-[rgba(134,155,189,0.18)] px-6 py-5">
            <div className="space-y-4">
              {group.candidates.map((candidate) => {
                const structured = readStructuredCv(candidate);
                const skills = readSkills(candidate, structured);
                const summary =
                  structured?.summary ??
                  candidate.verification_summary ??
                  candidate.match_summary ??
                  null;
                const topEvidence =
                  structured?.technical_skills?.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
                  structured?.platforms_cloud?.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
                  structured?.tooling_devops?.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
                  null;
                const expanded = Boolean(expandedIds[candidate.id]);

                return (
                  <article
                    key={candidate.id}
                    className="rounded-[24px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.04)] p-5"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                              {candidate.status}
                            </span>
                            <span className="inline-flex rounded-full border border-[rgba(134,155,189,0.18)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                              {formatGraphStatus(candidate.graph_sync_status)}
                            </span>
                          </div>
                          <h4 className="mt-3 text-[1.35rem] font-bold tracking-[-0.03em] text-[var(--color-text)]">
                            {candidate.full_name}
                          </h4>
                          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
                            {candidate.email ?? "No email captured."}
                          </p>
                          {summary ? (
                            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                              {expanded ? summary : truncateText(summary, 150)}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/candidates/${candidate.id}`}
                            className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(75,65,225,0.22)]"
                          >
                            Profile
                          </Link>
                          {candidate.job_id ? (
                            <Link
                              href={`/jobs/${candidate.job_id}`}
                              className="rounded-full border border-white/70 bg-white/80 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text)] transition hover:bg-white"
                            >
                              Job
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onEdit(candidate)}
                            className="rounded-full border border-white/70 bg-white/80 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text)] transition hover:bg-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(candidate)}
                            disabled={Boolean(candidate.job_id)}
                            className="rounded-full bg-[var(--color-brand-deep)] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_12px_28px_rgba(11,28,48,0.18)] disabled:cursor-not-allowed disabled:bg-[rgba(11,28,48,0.25)]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/82 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                            Skills
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(candidate.id)}
                            className="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text)] transition hover:bg-white"
                          >
                            {expanded ? "Hide details" : "Show details"}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {skills.length > 0 ? (
                            skills.slice(0, expanded ? 8 : 4).map((skill) => (
                              <span
                                key={`${candidate.id}-${skill}`}
                                className="rounded-full bg-[rgba(75,65,225,0.05)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]"
                              >
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-[var(--color-muted)]">
                              No skills captured yet.
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        <span>Source {candidate.source_type}</span>
                        <span>Parse {candidate.parse_status}</span>
                        <span>Confidence {formatConfidence(candidate.parse_confidence)}</span>
                      </div>

                      {expanded ? (
                        <div className="space-y-4 border-t border-[rgba(134,155,189,0.18)] pt-4 text-sm leading-6 text-[var(--color-muted)]">
                          {candidate.resume_text ? (
                            <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/70 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                                Resume text
                              </p>
                              <p className="mt-2 max-h-36 overflow-auto">{candidate.resume_text}</p>
                            </div>
                          ) : null}

                          {topEvidence ? (
                            <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/70 p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                                Evidence sample
                              </p>
                              <p className="mt-2">{topEvidence.text}</p>
                              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                                Source {topEvidence.section_origin}
                              </p>
                            </div>
                          ) : null}

                          <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/70 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                              Metadata
                            </p>
                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                              {candidate.extract_source ? <span>Extract {candidate.extract_source}</span> : null}
                              <span>Engine {candidate.parse_source}</span>
                              <span>{formatGraphStatus(candidate.graph_sync_status)}</span>
                              {candidate.source_file_name ? <span>File {candidate.source_file_name}</span> : null}
                              <span>Created {formatDate(candidate.created_at)}</span>
                              <span>Updated {formatDate(candidate.updated_at)}</span>
                            </div>
                            {candidate.graph_sync_status === "failed" && candidate.graph_sync_error ? (
                              <p className="mt-3 text-xs leading-5 text-[#8b2d2d]">
                                Graph sync error: {candidate.graph_sync_error}
                              </p>
                            ) : null}
                            {candidate.job_id ? (
                              <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
                                This candidate belongs to {group.title}. Delete it from that workspace to avoid accidental data loss.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
