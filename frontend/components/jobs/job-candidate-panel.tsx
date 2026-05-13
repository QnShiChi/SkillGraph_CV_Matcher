"use client";

import { useState } from "react";

import { CvImportForm } from "@/components/candidates/cv-import-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StateCard } from "@/components/state-card";
import {
  type Candidate,
  type CandidateBulkImportResponse,
  deleteCandidate,
  getJobCandidates,
  importJobCandidatesBulk,
} from "@/lib/api";

function normalizeCandidates(value: Candidate[] | null | undefined): Candidate[] {
  return Array.isArray(value) ? value : [];
}

function formatConfidence(value: number | null) {
  if (value == null) {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

function readStructuredCandidate(candidate: Candidate) {
  if (!candidate.structured_cv_json || typeof candidate.structured_cv_json !== "object") {
    return null;
  }

  return candidate.structured_cv_json as {
    technical_skills?: Array<{ name: string; evidence?: Array<{ text: string; section_origin: string }> }>;
    platforms_cloud?: Array<{ name: string }>;
    tooling_devops?: Array<{ name: string }>;
  };
}

export function JobCandidatePanel({
  jobId,
  initialCandidates,
}: {
  jobId: number;
  initialCandidates: Candidate[];
}) {
  const [candidates, setCandidates] = useState<Candidate[]>(
    normalizeCandidates(initialCandidates),
  );
  const [lastImportResult, setLastImportResult] =
    useState<CandidateBulkImportResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);

  const sortedCandidates = [...normalizeCandidates(candidates)].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  async function refreshCandidates() {
    const nextCandidates = await getJobCandidates(jobId);
    setCandidates(normalizeCandidates(nextCandidates));
  }

  async function handleImport(files: File[]) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await importJobCandidatesBulk(jobId, files);
      setLastImportResult(result);
      await refreshCandidates();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to import candidates for this job.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteCandidate(deleteTarget.id);
      setCandidates((current) =>
        normalizeCandidates(current).filter((candidate) => candidate.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete candidate from this job.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <StateCard
        title="Candidate Import"
        description="Import one or many CV PDFs directly into this job workspace. Each file is parsed and synced independently."
      >
        <CvImportForm
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onCancel={() => setErrorMessage(null)}
          onSubmit={handleImport}
        />
      </StateCard>

      {lastImportResult ? (
        <StateCard
          title="Batch Import Result"
          description={`${lastImportResult.total_files} file${lastImportResult.total_files > 1 ? "s" : ""} processed in the latest batch.`}
        >
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {lastImportResult.success_count} imported / {lastImportResult.failed_count} failed
            </p>
            {lastImportResult.results.map((item) => (
              <div
                key={`${item.filename}-${item.candidate_id ?? "failed"}`}
                className="rounded-[16px] border border-[var(--color-border)] bg-[rgba(148,151,169,0.05)] px-4 py-4"
              >
                <p className="text-sm font-semibold text-[var(--color-text)]">{item.filename}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {item.status === "imported"
                    ? `${item.candidate_name ?? "Candidate"} · ${item.extract_source ?? "unknown_extract"} · ${item.parse_source ?? "unknown"} · graph ${item.graph_sync_status ?? "pending"}`
                    : item.error ?? "Import failed."}
                </p>
              </div>
            ))}
          </div>
        </StateCard>
      ) : null}

      <StateCard
        title="Imported Candidates"
        description="These candidates belong only to the current job workspace and are ready for future matching."
      >
        {sortedCandidates.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            No candidates imported for this job yet.
          </p>
        ) : (
          <div className="space-y-4">
            {sortedCandidates.map((candidate) => {
              const structured = readStructuredCandidate(candidate);
              const technicalSkills = structured?.technical_skills ?? [];
              const cloudSkills = structured?.platforms_cloud ?? [];
              const toolingSkills = structured?.tooling_devops ?? [];
              const topEvidence =
                technicalSkills.find((skill) => skill.evidence?.length)?.evidence?.[0] ?? null;

              return (
                <article
                  key={candidate.id}
                  className="rounded-[20px] border border-[var(--color-border)] bg-white/90 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                        {candidate.full_name}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--color-muted)]">
                        {candidate.extract_source ?? "manual"} · {candidate.parse_source} · confidence {formatConfidence(candidate.parse_confidence)} · graph {candidate.graph_sync_status}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                      {candidate.status}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(candidate)}
                      className="rounded-[12px] bg-[#101114] px-4 py-2 text-sm font-medium text-white"
                    >
                      Delete Candidate
                    </button>
                  </div>

                  <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
                    <p>Technical: {technicalSkills.map((skill) => skill.name).join(", ") || "None"}</p>
                    <p>Cloud: {cloudSkills.map((skill) => skill.name).join(", ") || "None"}</p>
                    <p>Tooling: {toolingSkills.map((skill) => skill.name).join(", ") || "None"}</p>
                    {topEvidence ? (
                      <p>
                        Evidence: {topEvidence.text} <span className="uppercase tracking-[0.14em]">({topEvidence.section_origin})</span>
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </StateCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete candidate from this job?"
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.full_name}" from PostgreSQL, this job workspace, and the candidate graph projection.`
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
