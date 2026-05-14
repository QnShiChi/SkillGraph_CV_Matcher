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
  type CandidateFinalReport,
  type CandidateRankingResponse,
  type GraphScoringSummary,
  type RelatedCandidatesPayload,
  type RelatedJobRecommendation,
  type SkillGapAnalysis,
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
    reachable?: boolean;
    final_url?: string;
    url?: string;
    reason?: string | null;
    claim_title?: string | null;
    fetched_title?: string | null;
    fetched_excerpt?: string | null;
    claim_match_status?: string;
    claim_match_score?: number;
    matched_terms?: string[];
    mismatch_notes?: string | null;
  }>;
}

function buildVerificationMetrics(
  verifiedLinks: ReturnType<typeof readVerifiedLinks>,
) {
  const matched = verifiedLinks.filter((link) => link.claim_match_status === "matched").length;
  const mismatched = verifiedLinks.filter((link) => link.claim_match_status === "mismatch").length;
  const unreachable = verifiedLinks.filter((link) => link.reachable === false).length;

  return {
    matched,
    mismatched,
    unreachable,
    issueCount: mismatched + unreachable,
    total: verifiedLinks.length,
  };
}

function formatVerificationStatus(status?: string | null) {
  if (!status) {
    return "Pending";
  }

  const mapping: Record<string, string> = {
    verified: "Verified",
    weak_evidence: "Weak Evidence",
    invalid_link: "Invalid Link",
    missing_evidence: "Missing Evidence",
  };

  return mapping[status] ?? status.replaceAll("_", " ").trim();
}

function buildVerificationSegments(
  metrics: ReturnType<typeof buildVerificationMetrics>,
) {
  if (metrics.total === 0) {
    return [];
  }

  return [
    {
      key: "matched",
      value: metrics.matched,
      className: "bg-emerald-500",
    },
    {
      key: "mismatched",
      value: metrics.mismatched,
      className: "bg-amber-500",
    },
    {
      key: "unreachable",
      value: metrics.unreachable,
      className: "bg-rose-500",
    },
  ].filter((segment) => segment.value > 0);
}

function formatImportedCandidateState(candidate: Candidate) {
  if (candidate.screening_decision === "pass" && candidate.match_rank != null) {
    return "ranked";
  }
  if (candidate.screening_decision === "reject") {
    return "rejected";
  }
  if (candidate.screening_decision) {
    return "screened";
  }

  return "pending screening";
}

function formatSkillLabel(skill: string) {
  const mapping: Record<string, string> = {
    ai_llm_apis: "AI/LLM APIs",
    ai_powered_features: "AI-powered features",
    artificial_intelligence: "Artificial Intelligence",
    ci_cd: "CI/CD",
    docker: "Docker",
    express_js: "Express.js",
    fastapi: "FastAPI",
    git: "Git",
    github: "GitHub",
    java: "Java",
    javascript: "JavaScript",
    jwt: "JWT",
    mongodb: "MongoDB",
    mysql: "MySQL",
    node_js: "Node.js",
    postgresql: "PostgreSQL",
    python: "Python",
    react: "React",
    rest_api: "REST API",
    spring_boot: "Spring Boot",
    sql: "SQL",
    sql_server: "SQL Server",
    typescript: "TypeScript",
    version_control: "Version Control",
  };

  return mapping[skill] ?? skill.replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function renderSkillChips(
  skills: string[],
  toneClassName: string,
  emptyMessage?: string,
) {
  if (!skills.length) {
    return emptyMessage ? <p className="text-xs text-slate-500">{emptyMessage}</p> : null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${toneClassName}`}
        >
          {formatSkillLabel(skill)}
        </span>
      ))}
    </div>
  );
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
      <div className="mt-2 space-y-2">
        {verifiedLinks.map((link, index) => (
          <div
            key={`${link.final_url ?? link.url ?? title}-${index}`}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {link.claim_title ?? link.fetched_title ?? "Project link"}
                </p>
                <p className="text-xs text-slate-500">
                  {link.final_url ?? link.url ?? "No URL available"}
                </p>
              </div>
              <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                {link.reachable === false
                  ? "unreachable"
                  : link.claim_match_status ?? "unchecked"}{" "}
                · {link.claim_match_score ?? "N/A"}
              </span>
            </div>
            {Array.isArray(link.matched_terms) && link.matched_terms.length > 0 ? (
              <div className="mt-2">
                {renderSkillChips(
                  link.matched_terms.slice(0, 5),
                  "bg-slate-200/80 text-slate-700",
                )}
              </div>
            ) : null}
            {link.mismatch_notes ? (
              <p className="mt-2 text-xs leading-5 text-rose-700">{link.mismatch_notes}</p>
            ) : null}
            {link.reachable === false && link.reason ? (
              <p className="mt-2 text-xs leading-5 text-rose-700">{link.reason}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderVerificationOverview({
  status,
  score,
  verifiedLinks,
}: {
  status?: string | null;
  score?: number | null;
  verifiedLinks: ReturnType<typeof readVerifiedLinks>;
}) {
  const metrics = buildVerificationMetrics(verifiedLinks);
  const segments = buildVerificationSegments(metrics);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Verification Overview
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatVerificationStatus(status)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Score</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{score ?? "N/A"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Matched Links
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{metrics.matched}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Issue Links
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{metrics.issueCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="flex h-full w-full">
            {segments.map((segment) => (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(segment.value / metrics.total) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>Matched {metrics.matched}</span>
          <span>Mismatch {metrics.mismatched}</span>
          <span>Unreachable {metrics.unreachable}</span>
        </div>
      </div>
    </div>
  );
}

function renderGraphExplanation(graphScoring?: GraphScoringSummary | null) {
  if (!graphScoring?.enabled) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Graph Explanation
        </p>
        {graphScoring.used_fallback ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            fallback
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-slate-700">{graphScoring.summary}</p>

      {graphScoring.exact_matches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Exact Matches
          </p>
          {renderSkillChips(graphScoring.exact_matches, "bg-emerald-100 text-emerald-700")}
        </div>
      ) : null}

      {graphScoring.prerequisite_matches.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Prerequisite Support
          </p>
          <div className="flex flex-wrap gap-1.5">
            {graphScoring.prerequisite_matches.map((item) => (
              <span
                key={`${item.required_skill}:${item.support_skill}`}
                className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-medium text-sky-700"
              >
                {formatSkillLabel(item.required_skill)} via {formatSkillLabel(item.support_skill)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {graphScoring.missing_skills.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Missing Skills
          </p>
          {renderSkillChips(graphScoring.missing_skills, "bg-amber-100 text-amber-700")}
        </div>
      ) : null}
    </div>
  );
}

function renderSkillGapAnalysis(skillGapAnalysis?: SkillGapAnalysis | null) {
  if (!skillGapAnalysis) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Skill Gap Analysis
        </p>
      </div>
      <p className="text-xs leading-5 text-slate-700">{skillGapAnalysis.summary}</p>

      {skillGapAnalysis.ready_skills.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ready
          </p>
          {renderSkillChips(skillGapAnalysis.ready_skills, "bg-emerald-100 text-emerald-700")}
        </div>
      ) : null}

      {skillGapAnalysis.near_gap_skills.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Near Gap
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skillGapAnalysis.near_gap_skills.map((item) => (
              <span
                key={`${item.required_skill}:${item.support_skill}`}
                className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-medium text-sky-700"
              >
                {formatSkillLabel(item.required_skill)} via {formatSkillLabel(item.support_skill)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {skillGapAnalysis.hard_gap_skills.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Hard Gap
          </p>
          {renderSkillChips(skillGapAnalysis.hard_gap_skills, "bg-amber-100 text-amber-700")}
        </div>
      ) : null}

      {skillGapAnalysis.suggested_next_skills.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Suggested Next Skills
          </p>
          {renderSkillChips(
            skillGapAnalysis.suggested_next_skills,
            "bg-violet-100 text-violet-700",
          )}
        </div>
      ) : null}
    </div>
  );
}

function renderRelatedCandidates(relatedCandidates?: RelatedCandidatesPayload | null) {
  if (!relatedCandidates || relatedCandidates.next_best_candidates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Next-Best Candidates
        </p>
        <p className="text-[11px] text-slate-400">
          {relatedCandidates.next_best_candidates.length} recommendations
        </p>
      </div>

      <div className="space-y-1.5">
        {relatedCandidates.next_best_candidates.map((item) => (
          <div
            key={`next-best-${item.candidate_id}`}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.full_name}</p>
                <p className="text-xs text-slate-500 line-clamp-1">{item.reason}</p>
              </div>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-medium text-sky-700">
                {item.proximity_score?.toFixed(2) ?? "N/A"}
              </span>
            </div>
            {item.shared_skills.length > 0 ? (
              <div className="mt-2">
                {renderSkillChips(item.shared_skills, "bg-slate-200/80 text-slate-700")}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderRelatedJobs(relatedJobs?: RelatedJobRecommendation[] | null) {
  if (!relatedJobs || relatedJobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Related Jobs
        </p>
        <p className="text-[11px] text-slate-400">{relatedJobs.length} suggestions</p>
      </div>

      <div className="space-y-1.5">
        {relatedJobs.map((item) => (
          <div
            key={item.job_id}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 line-clamp-1">{item.reason}</p>
              </div>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-700">
                {item.similarity_score.toFixed(2)}
              </span>
            </div>
            {item.shared_skills.length > 0 ? (
              <div className="mt-2">
                {renderSkillChips(item.shared_skills, "bg-slate-200/80 text-slate-700")}
              </div>
            ) : null}
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
                  ? (candidate.final_report_json as CandidateFinalReport)
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
                      {renderVerificationOverview({
                        status: candidate.verification_status,
                        score: candidate.verification_score,
                        verifiedLinks,
                      })}
                      <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Decision Summary
                        </p>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Top Strengths
                          </p>
                          {renderSkillChips(
                            report?.strengths ?? [],
                            "bg-emerald-100 text-emerald-700",
                            "No strengths captured.",
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Key Gaps
                          </p>
                          {renderSkillChips(
                            report?.gaps ?? [],
                            "bg-amber-100 text-amber-700",
                            "No gaps captured.",
                          )}
                        </div>
                        {typeof report?.critic_review === "string" ? (
                          <p className="text-xs leading-5 text-slate-600">
                            {report.critic_review}
                          </p>
                        ) : null}
                      </div>
                      {renderGraphExplanation(report?.graph_scoring)}
                      {renderSkillGapAnalysis(report?.skill_gap_analysis)}
                      {renderRelatedCandidates(report?.related_candidates)}
                      {renderRelatedJobs(report?.related_jobs)}
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
                      {renderVerificationOverview({
                        status: candidate.verification_status,
                        score: candidate.verification_score,
                        verifiedLinks,
                      })}
                      <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Why Rejected
                        </p>
                        <p className="text-xs leading-5 text-slate-700">
                          {candidate.screening_reason ??
                            candidate.verification_summary ??
                            "Rejected by verification policy."}
                        </p>
                      </div>
                      {renderVerifiedLinks(verifiedLinks, "Evidence Issues")}
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
              const technicalSkills = structured?.technical_skills ?? [];
              const cloudSkills = structured?.platforms_cloud ?? [];
              const toolingSkills = structured?.tooling_devops ?? [];
              const topEvidence =
                technicalSkills.find((skill) => skill.evidence?.length)?.evidence?.[0] ??
                null;
              const statusSummary = formatImportedCandidateState(candidate);

              return (
                <CandidateListItem
                  key={candidate.id}
                  title={candidate.full_name}
                  subtitle={`${candidate.extract_source ?? "manual"} · ${candidate.parse_source} · confidence ${formatConfidence(candidate.parse_confidence)} · graph ${candidate.graph_sync_status}`}
                  summary={statusSummary}
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
