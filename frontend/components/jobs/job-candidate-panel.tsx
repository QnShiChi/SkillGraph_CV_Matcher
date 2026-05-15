"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { StateCard } from "@/components/state-card";
import {
  type Candidate,
  type CandidateRankingResponse,
  deleteCandidate,
  getJobCandidates,
  getJobRanking,
  screenAndRankJobCandidates,
} from "@/lib/api";
import { formatScreenAndRankErrorMessage } from "@/lib/ranking-error-message";

function normalizeCandidates(value: Candidate[] | null | undefined): Candidate[] {
  return Array.isArray(value) ? value : [];
}

function readStructuredCandidate(candidate: Candidate) {
  if (!candidate.structured_cv_json || typeof candidate.structured_cv_json !== "object") {
    return null;
  }

  return candidate.structured_cv_json as {
    technical_skills?: Array<{ name: string }>;
    platforms_cloud?: Array<{ name: string }>;
    tooling_devops?: Array<{ name: string }>;
  };
}

function readFinalReport(candidate: Candidate) {
  if (!candidate.final_report_json || typeof candidate.final_report_json !== "object") {
    return null;
  }

  return candidate.final_report_json as {
    strengths?: string[];
    gaps?: string[];
    explanation?: string;
  };
}

function toPercent(value: number | null) {
  if (value == null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatVerification(candidate: Candidate) {
  return candidate.verification_status?.replaceAll("_", " ") ?? "pending";
}

function deriveSkillGaps(candidate: Candidate) {
  const report = readFinalReport(candidate);

  if (report?.gaps?.length) {
    return report.gaps.slice(0, 3);
  }

  if (candidate.screening_reason) {
    return [candidate.screening_reason];
  }

  return [];
}

function derivePrimarySkills(candidate: Candidate) {
  const structured = readStructuredCandidate(candidate);

  return [
    ...(structured?.technical_skills ?? []).map((skill) => skill.name),
    ...(structured?.platforms_cloud ?? []).map((skill) => skill.name),
    ...(structured?.tooling_devops ?? []).map((skill) => skill.name),
  ].slice(0, 6);
}

function sortForRanking(candidates: Candidate[]) {
  return [...candidates].sort((left, right) => {
    const leftRank = left.match_rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.match_rank ?? Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftScore = left.match_score ?? -1;
    const rightScore = right.match_score ?? -1;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.full_name.localeCompare(right.full_name);
  });
}

function MatchScoreRing({ score }: { score: number }) {
  return (
    <div
      className="grid h-14 w-14 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#10b981 ${score * 3.6}deg, rgba(16,185,129,0.14) 0deg)`,
      }}
    >
      <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-bold text-[#10b981]">
        {score}%
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
  const [rankingResult, setRankingResult] = useState<CandidateRankingResponse | null>(null);
  const [isRanking, setIsRanking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);

  const sortedCandidates = useMemo(
    () => sortForRanking(normalizeCandidates(candidates)),
    [candidates],
  );

  const rankedCandidates = useMemo(() => {
    if (rankingResult?.ranked_candidates?.length) {
      return sortForRanking(rankingResult.ranked_candidates);
    }

    return sortedCandidates.filter(
      (candidate) =>
        candidate.screening_decision === "pass" || candidate.match_rank != null,
    );
  }, [rankingResult, sortedCandidates]);

  const rejectedCandidates = useMemo(() => {
    if (rankingResult?.rejected_candidates?.length) {
      return rankingResult.rejected_candidates;
    }

    return sortedCandidates.filter((candidate) => candidate.screening_decision === "reject");
  }, [rankingResult, sortedCandidates]);

  const pendingCandidates = useMemo(
    () =>
      sortedCandidates.filter(
        (candidate) =>
          candidate.screening_decision == null && candidate.match_rank == null,
      ),
    [sortedCandidates],
  );

  useEffect(() => {
    setCandidates(normalizeCandidates(initialCandidates));
  }, [initialCandidates]);

  async function refreshCandidates() {
    const nextCandidates = await getJobCandidates(jobId);
    setCandidates(normalizeCandidates(nextCandidates));
  }

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

  async function handleScreenAndRank() {
    setIsRanking(true);
    setErrorMessage(null);

    try {
      const result = await screenAndRankJobCandidates(jobId);
      setRankingResult(result);
      await refreshCandidates();
    } catch (error) {
      setErrorMessage(
        formatScreenAndRankErrorMessage(
          error instanceof Error ? error.message : "Unable to screen and rank candidates for this job.",
        ),
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
      setRankingResult((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          total_candidates: Math.max(0, current.total_candidates - 1),
          ranked_candidates: current.ranked_candidates.filter(
            (candidate) => candidate.id !== deleteTarget.id,
          ),
          rejected_candidates: current.rejected_candidates.filter(
            (candidate) => candidate.id !== deleteTarget.id,
          ),
          ranked_count: current.ranked_candidates.filter(
            (candidate) => candidate.id !== deleteTarget.id,
          ).length,
          rejected_count: current.rejected_candidates.filter(
            (candidate) => candidate.id !== deleteTarget.id,
          ).length,
        };
      });
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
        title="Verification And Ranking"
        description="Candidates must provide reachable project evidence links whose content supports the project claims in the CV before they can be ranked."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm leading-6 text-[var(--color-muted)]">
            <p>Policy: missing links, unreachable links, or links whose content does not support the CV claim =&gt; reject.</p>
            <p>Ranking uses must-have coverage, verified project evidence, skill overlap, and experience signals.</p>
          </div>
          <button
            type="button"
            onClick={handleScreenAndRank}
            disabled={sortedCandidates.length === 0 || isRanking}
            className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRanking ? "Running..." : "Run Screening & Ranking"}
          </button>
        </div>
        {rankingResult ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[20px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_28px_rgba(10,20,40,0.05)]">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Total</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                {rankingResult.total_candidates}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_28px_rgba(10,20,40,0.05)]">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Ranked</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                {rankingResult.ranked_count}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_28px_rgba(10,20,40,0.05)]">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">Rejected</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                {rankingResult.rejected_count}
              </p>
            </div>
          </div>
        ) : null}
      </StateCard>

      {errorMessage ? (
        <div className="rounded-[18px] border border-[rgba(183,54,54,0.16)] bg-[rgba(183,54,54,0.06)] px-5 py-4 text-sm text-[#8d2020]">
          {errorMessage}
        </div>
      ) : null}

      {pendingCandidates.length ? (
        <StateCard
          title="Newly Imported Candidates"
          description="These candidates were imported into this job workspace and are waiting for screening and ranking."
        >
          <div className="space-y-3">
            {pendingCandidates.map((candidate) => {
              const skills = derivePrimarySkills(candidate);

              return (
                <div
                  key={`pending-${candidate.id}`}
                  className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/82 p-4 shadow-[0_12px_28px_rgba(10,20,40,0.05)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[var(--color-text)]">
                        {candidate.full_name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {skills.length
                          ? skills.slice(0, 4).join(" • ")
                          : "No primary skills captured yet"}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        imported • waiting for screening
                      </p>
                    </div>
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-white"
                    >
                      Open Profile
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </StateCard>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_20px_60px_rgba(10,20,40,0.07)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[rgba(134,155,189,0.18)] px-6 py-5">
          <div>
            <h3 className="text-[30px] font-bold tracking-[-0.03em] text-[var(--color-text)]">
              Ranked Candidates
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Ranking board for candidates that passed evidence verification and screening.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/jobs/${jobId}/benchmarking`}
              className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[rgba(75,65,225,0.05)]"
            >
              Compare Graph
            </Link>
          </div>
        </div>

        {rankedCandidates.length === 0 ? (
          <div className="px-6 py-10 text-sm text-[var(--color-muted)]">
            No ranked candidates yet. Run screening and ranking after importing CVs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.03)] text-left">
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    Candidate Name
                  </th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    Match Score
                  </th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    Key Skill Gaps
                  </th>
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankedCandidates.map((candidate, index) => {
                  const score = toPercent(candidate.match_score);
                  const gaps = deriveSkillGaps(candidate);
                  const skills = derivePrimarySkills(candidate);

                  return (
                    <tr
                      key={`ranked-${candidate.id}`}
                      className="border-b border-[rgba(134,155,189,0.14)] align-top last:border-b-0"
                    >
                      <td className="px-6 py-5">
                        <span className="text-[32px] font-bold tracking-[-0.04em] text-[var(--color-brand)]">
                          {String(candidate.match_rank ?? index + 1).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-start gap-4">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-brand-subtle)] text-sm font-bold text-[var(--color-brand-dark)]">
                            {candidate.full_name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() ?? "")
                              .join("")}
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-[var(--color-text)]">
                              {candidate.full_name}
                            </p>
                            <p className="mt-1 text-sm text-[var(--color-muted)]">
                              {skills.length
                                ? `${skills.slice(0, 3).join(" • ")}`
                                : "No primary skills captured"}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                              verify {formatVerification(candidate)} • decision{" "}
                              {candidate.screening_decision ?? "pending"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <MatchScoreRing score={score} />
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          {gaps.length ? (
                            gaps.map((gap) => (
                              <span
                                key={`${candidate.id}-${gap}`}
                                className="rounded-full bg-[rgba(183,54,54,0.08)] px-3 py-1.5 text-xs font-semibold text-[#8d2020]"
                              >
                                {gap}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-[rgba(16,163,74,0.08)] px-3 py-1.5 text-xs font-semibold text-[var(--color-success-text)]">
                              No major gaps
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/jobs/${jobId}/benchmarking`}
                            className="rounded-[14px] border border-[rgba(75,65,225,0.4)] px-4 py-2 text-sm font-semibold text-[var(--color-brand)] transition hover:bg-[rgba(75,65,225,0.05)]"
                          >
                            Compare Graph
                          </Link>
                          <Link
                            href={`/candidates/${candidate.id}`}
                            className="rounded-[14px] border border-white/70 bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[rgba(75,65,225,0.05)]"
                          >
                            Open Profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(candidate)}
                            className="rounded-[14px] bg-[var(--color-brand-deep)] px-4 py-2 text-sm font-medium text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rejectedCandidates.length ? (
        <StateCard
          title="Rejected By Verification"
          description="These candidates were filtered out before ranking because they lacked project evidence or the reachable links did not support the project claims in the CV."
        >
          <div className="space-y-3">
            {rejectedCandidates.map((candidate) => (
              <div
                key={`rejected-${candidate.id}`}
                className="rounded-[20px] border border-[rgba(183,54,54,0.18)] bg-[rgba(183,54,54,0.05)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--color-text)]">
                      {candidate.full_name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {candidate.screening_reason ??
                        candidate.verification_summary ??
                        "Rejected by verification policy."}
                    </p>
                  </div>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-white"
                  >
                    Open Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </StateCard>
      ) : null}

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
