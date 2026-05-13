"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import { CvImportForm } from "@/components/candidates/cv-import-form";
import { CandidateListItem } from "@/components/jobs/candidate-list-item";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StateCard } from "@/components/state-card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  type Candidate,
  type CandidateBulkImportResponse,
  type CandidateRankingResponse,
  deleteCandidate,
  getJobCandidates,
  getJobRanking,
  importJobCandidatesBulk,
  screenAndRankJobCandidates,
} from "@/lib/api";
import {
  expandedCandidateIdsKey,
  openCandidateSectionsKey,
  readSessionValue,
  writeSessionValue,
} from "@/lib/job-workspace-ui-state";

type CandidateSectionKey = "ranked" | "rejected" | "imported";

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

function readVerifiedLinks(candidate: Candidate) {
  if (!Array.isArray(candidate.verified_links_json)) {
    return [];
  }

  return candidate.verified_links_json as Array<{
    final_url?: string;
    url?: string;
    claim_title?: string | null;
    fetched_title?: string | null;
    fetched_excerpt?: string | null;
    claim_match_status?: string;
    claim_match_score?: number;
    matched_terms?: string[];
    mismatch_notes?: string | null;
  }>;
}

function renderVerifiedLinks(
  verifiedLinks: ReturnType<typeof readVerifiedLinks>,
  title: string,
) {
  if (!verifiedLinks.length) {
    return null;
  }

  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[rgba(148,151,169,0.05)] px-4 py-3">
      <p className="font-medium text-[var(--color-text)]">{title}</p>
      <div className="mt-2 space-y-2 text-sm leading-6 text-[var(--color-muted)]">
        {verifiedLinks.map((link, index) => (
          <div key={`${link.final_url ?? link.url ?? title}-${index}`}>
            <p>
              {(link.claim_title ?? link.final_url ?? link.url ?? "Project link")} ·{" "}
              {link.claim_match_status ?? "unchecked"} · score{" "}
              {link.claim_match_score ?? "N/A"}
            </p>
            {link.fetched_title ? <p>Fetched title: {link.fetched_title}</p> : null}
            {Array.isArray(link.matched_terms) && link.matched_terms.length > 0 ? (
              <p>Matched terms: {link.matched_terms.join(", ")}</p>
            ) : null}
            {link.final_url ?? link.url ? <p>{link.final_url ?? link.url}</p> : null}
            {link.fetched_excerpt ? <p>Excerpt: {link.fetched_excerpt}</p> : null}
            {link.mismatch_notes ? <p>Mismatch: {link.mismatch_notes}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
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
  const [rankingResult, setRankingResult] = useState<CandidateRankingResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRanking, setIsRanking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [openSections, setOpenSections] = useState<CandidateSectionKey[]>([
    "ranked",
  ]);
  const [expandedRankedIds, setExpandedRankedIds] = useState<number[]>([]);
  const [expandedRejectedIds, setExpandedRejectedIds] = useState<number[]>([]);
  const [expandedImportedIds, setExpandedImportedIds] = useState<number[]>([]);

  const sortedCandidates = [...normalizeCandidates(candidates)].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  function toggleSection(section: CandidateSectionKey) {
    setOpenSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  }

  function toggleExpandedId(
    id: number,
    setter: Dispatch<SetStateAction<number[]>>,
  ) {
    setter((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function refreshCandidates() {
    const nextCandidates = await getJobCandidates(jobId);
    setCandidates(normalizeCandidates(nextCandidates));
  }

  useEffect(() => {
    setOpenSections(readSessionValue(openCandidateSectionsKey(jobId), ["ranked"]));
    setExpandedRankedIds(
      readSessionValue(expandedCandidateIdsKey(jobId, "ranked"), []),
    );
    setExpandedRejectedIds(
      readSessionValue(expandedCandidateIdsKey(jobId, "rejected"), []),
    );
    setExpandedImportedIds(
      readSessionValue(expandedCandidateIdsKey(jobId, "imported"), []),
    );
  }, [jobId]);

  useEffect(() => {
    writeSessionValue(openCandidateSectionsKey(jobId), openSections);
  }, [jobId, openSections]);

  useEffect(() => {
    writeSessionValue(expandedCandidateIdsKey(jobId, "ranked"), expandedRankedIds);
  }, [expandedRankedIds, jobId]);

  useEffect(() => {
    writeSessionValue(
      expandedCandidateIdsKey(jobId, "rejected"),
      expandedRejectedIds,
    );
  }, [expandedRejectedIds, jobId]);

  useEffect(() => {
    writeSessionValue(
      expandedCandidateIdsKey(jobId, "imported"),
      expandedImportedIds,
    );
  }, [expandedImportedIds, jobId]);

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      const result = await getJobRanking(jobId);
      if (active) {
        setRankingResult(result);
      }
    }

    void loadRanking();
    return () => {
      active = false;
    };
  }, [jobId]);

  async function handleImport(files: File[]) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await importJobCandidatesBulk(jobId, files);
      setLastImportResult(result);
      setRankingResult(null);
      await refreshCandidates();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to import candidates for this job.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleScreenAndRank() {
    setIsRanking(true);
    setErrorMessage(null);

    try {
      const result = await screenAndRankJobCandidates(jobId);
      setRankingResult(result);
      await refreshCandidates();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to screen and rank candidates for this job.",
      );
    } finally {
      setIsRanking(false);
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

      <StateCard
        title="Verification And Ranking"
        description="Candidates must provide reachable project evidence links whose content supports the project claims in the CV before they can be ranked."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm leading-6 text-[var(--color-muted)]">
            <p>Policy: missing links, unreachable links, or links whose content does not support the CV claim {"=>"} reject.</p>
            <p>Ranking uses must-have coverage, verified project evidence, skill overlap, and experience signals.</p>
          </div>
          <button
            type="button"
            onClick={handleScreenAndRank}
            disabled={sortedCandidates.length === 0 || isRanking}
            className="rounded-[14px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRanking ? "Running..." : "Run Screening & Ranking"}
          </button>
        </div>
        {rankingResult ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[16px] border border-[var(--color-border)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Total</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                {rankingResult.total_candidates}
              </p>
            </div>
            <div className="rounded-[16px] border border-[var(--color-border)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Ranked</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                {rankingResult.ranked_count}
              </p>
            </div>
            <div className="rounded-[16px] border border-[var(--color-border)] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Rejected</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                {rankingResult.rejected_count}
              </p>
            </div>
          </div>
        ) : null}
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

      <CollapsibleSection
        title="Ranked Candidates"
        description="Only candidates with verified project evidence appear here."
        count={rankingResult?.ranked_candidates.length ?? 0}
        open={openSections.includes("ranked")}
        onToggle={() => toggleSection("ranked")}
      >
        {rankingResult?.ranked_candidates.length ? (
          <div className="space-y-3">
            {rankingResult.ranked_candidates.map((candidate) => {
              const verifiedLinks = readVerifiedLinks(candidate);
              const report =
                candidate.final_report_json && typeof candidate.final_report_json === "object"
                  ? (candidate.final_report_json as {
                      strengths?: string[];
                      gaps?: string[];
                      explanation?: string;
                      critic_review?: string;
                    })
                  : null;

              return (
                <CandidateListItem
                  key={`ranked-${candidate.id}`}
                  tone="success"
                  title={`#${candidate.match_rank} · ${candidate.full_name}`}
                  subtitle={`match ${candidate.match_score == null ? "N/A" : candidate.match_score.toFixed(2)} · verify ${candidate.verification_score == null ? "N/A" : candidate.verification_score.toFixed(0)}`}
                  summary={report?.explanation ?? candidate.match_summary ?? undefined}
                  open={expandedRankedIds.includes(candidate.id)}
                  onToggle={() => toggleExpandedId(candidate.id, setExpandedRankedIds)}
                  badges={
                    <span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                      pass
                    </span>
                  }
                  detail={
                    <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
                      <p>Strengths: {report?.strengths?.join(", ") || "None"}</p>
                      <p>Gaps: {report?.gaps?.join(", ") || "None"}</p>
                      {typeof report?.critic_review === "string" ? (
                        <p>Critic review: {report.critic_review}</p>
                      ) : null}
                      {renderVerifiedLinks(verifiedLinks, "Project Verification")}
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            No ranked candidates yet. Run screening and ranking after importing CVs.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Rejected By Verification"
        description="These candidates were filtered out before ranking because they lacked project evidence or the reachable links did not support the project claims in the CV."
        count={rankingResult?.rejected_candidates.length ?? 0}
        open={openSections.includes("rejected")}
        onToggle={() => toggleSection("rejected")}
      >
        {rankingResult?.rejected_candidates.length ? (
          <div className="space-y-3">
            {rankingResult.rejected_candidates.map((candidate) => {
              const verifiedLinks = readVerifiedLinks(candidate);

              return (
                <CandidateListItem
                  key={`rejected-${candidate.id}`}
                  tone="danger"
                  title={candidate.full_name}
                  subtitle={`${candidate.verification_status ?? "unverified"} · ${candidate.screening_reason ?? "Rejected by screening policy."}`}
                  summary={candidate.verification_summary ?? undefined}
                  open={expandedRejectedIds.includes(candidate.id)}
                  onToggle={() =>
                    toggleExpandedId(candidate.id, setExpandedRejectedIds)
                  }
                  badges={
                    <span className="rounded-full bg-[rgba(183,54,54,0.14)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d2020]">
                      reject
                    </span>
                  }
                  detail={
                    <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
                      {candidate.verification_summary ? (
                        <p>{candidate.verification_summary}</p>
                      ) : null}
                      {renderVerifiedLinks(verifiedLinks, "Verification Details")}
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            No rejected candidates yet.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Imported Candidates"
        description="These candidates belong only to the current job workspace and are ready for screening, ranking, and HR review."
        count={sortedCandidates.length}
        open={openSections.includes("imported")}
        onToggle={() => toggleSection("imported")}
      >
        {sortedCandidates.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            No candidates imported for this job yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedCandidates.map((candidate) => {
              const structured = readStructuredCandidate(candidate);
              const verifiedLinks = readVerifiedLinks(candidate);
              const technicalSkills = structured?.technical_skills ?? [];
              const cloudSkills = structured?.platforms_cloud ?? [];
              const toolingSkills = structured?.tooling_devops ?? [];
              const topEvidence =
                technicalSkills.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
                null;
              const statusSummary = candidate.screening_decision
                ? `verify ${candidate.verification_status ?? "pending"} · decision ${candidate.screening_decision} · ${candidate.match_rank != null ? `rank ${candidate.match_rank}` : "unranked"}`
                : "pending screening";

              return (
                <CandidateListItem
                  key={candidate.id}
                  title={candidate.full_name}
                  subtitle={`${candidate.extract_source ?? "manual"} · ${candidate.parse_source} · confidence ${formatConfidence(candidate.parse_confidence)} · graph ${candidate.graph_sync_status}`}
                  summary={candidate.match_summary ?? candidate.verification_summary ?? statusSummary}
                  open={expandedImportedIds.includes(candidate.id)}
                  onToggle={() =>
                    toggleExpandedId(candidate.id, setExpandedImportedIds)
                  }
                  badges={
                    <span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                      {candidate.status}
                    </span>
                  }
                  detail={
                    <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
                      <p>{statusSummary}</p>
                      <p>
                        Technical:{" "}
                        {technicalSkills.map((skill) => skill.name).join(", ") || "None"}
                      </p>
                      <p>
                        Cloud: {cloudSkills.map((skill) => skill.name).join(", ") || "None"}
                      </p>
                      <p>
                        Tooling:{" "}
                        {toolingSkills.map((skill) => skill.name).join(", ") || "None"}
                      </p>
                      {candidate.verification_summary ? (
                        <p>Verification: {candidate.verification_summary}</p>
                      ) : null}
                      {candidate.match_summary ? (
                        <p>Match: {candidate.match_summary}</p>
                      ) : null}
                      {renderVerifiedLinks(verifiedLinks, "Verified Links")}
                      {topEvidence ? (
                        <p>
                          Evidence: {topEvidence.text}{" "}
                          <span className="uppercase tracking-[0.14em]">
                            ({topEvidence.section_origin})
                          </span>
                        </p>
                      ) : null}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(candidate)}
                          className="rounded-[12px] bg-[#101114] px-4 py-2 text-sm font-medium text-white"
                        >
                          Delete Candidate
                        </button>
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </CollapsibleSection>

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
