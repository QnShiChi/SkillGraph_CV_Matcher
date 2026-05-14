import Link from "next/link";

import type { Candidate, Job } from "@/lib/api";

import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";

function scoreToPercent(value: number | null, multiplier = 100) {
  if (value == null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value * multiplier)));
}

function pickTopCandidates(candidates: Candidate[]) {
  return [...candidates]
    .sort((left, right) => {
      const leftScore = left.match_score ?? -1;
      const rightScore = right.match_score ?? -1;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return (
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      );
    })
    .slice(0, 2);
}

function readSkillGroups(candidate: Candidate) {
  if (!candidate.structured_cv_json || typeof candidate.structured_cv_json !== "object") {
    return [];
  }

  const value = candidate.structured_cv_json as {
    technical_skills?: Array<{ name: string }>;
    platforms_cloud?: Array<{ name: string }>;
    tooling_devops?: Array<{ name: string }>;
  };

  return [
    ...(value.technical_skills ?? []).map((skill) => skill.name),
    ...(value.platforms_cloud ?? []).map((skill) => skill.name),
    ...(value.tooling_devops ?? []).map((skill) => skill.name),
  ];
}

function readVerifiedLinks(candidate: Candidate) {
  if (!Array.isArray(candidate.verified_links_json)) {
    return [];
  }

  return candidate.verified_links_json as Array<{
    final_url?: string;
    url?: string;
    claim_match_status?: string;
    claim_title?: string | null;
  }>;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function CandidateComparisonCard({
  candidate,
  accent,
}: {
  candidate: Candidate;
  accent: string;
}) {
  const skills = unique(readSkillGroups(candidate)).slice(0, 8);
  const match = scoreToPercent(candidate.match_score);
  const verification = scoreToPercent(candidate.verification_score, 1);

  return (
    <article className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(10,20,40,0.07)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            {candidate.screening_decision ?? candidate.status}
          </span>
          <h3 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            {candidate.full_name}
          </h3>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {candidate.email ?? "No email captured"}
          </p>
        </div>
        <div
          className="grid h-16 w-16 place-items-center rounded-full border text-xl font-bold"
          style={{ borderColor: `${accent}55`, color: accent }}
        >
          {match ? `${match}%` : "N/A"}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Match score
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{match}%</p>
        </div>
        <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Evidence score
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{verification}%</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Primary strengths
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {skills.length ? (
            skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-[rgba(134,155,189,0.18)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]"
              >
                {skill}
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--color-muted)]">No structured skills captured</span>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/candidates/${candidate.id}`}
          className="rounded-full bg-[var(--color-brand-deep)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(11,28,48,0.18)]"
        >
          Open Profile
        </Link>
        {candidate.job_id ? (
          <Link
            href={`/jobs/${candidate.job_id}`}
            className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-white"
          >
            Open Job
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function JobBenchmarkingView({
  job,
  candidates,
}: {
  job: Job;
  candidates: Candidate[];
}) {
  const topCandidates = pickTopCandidates(candidates);
  const [left, right] = topCandidates;
  const leftSkills = left ? unique(readSkillGroups(left)) : [];
  const rightSkills = right ? unique(readSkillGroups(right)) : [];
  const overlap = leftSkills.filter((skill) => rightSkills.includes(skill));
  const leftOnly = leftSkills.filter((skill) => !rightSkills.includes(skill));
  const rightOnly = rightSkills.filter((skill) => !leftSkills.includes(skill));

  if (topCandidates.length < 2) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={`Benchmarking / ${job.title}`}
          title="Candidate Benchmarking"
          description="This comparison view requires at least two imported candidates in the job workspace."
          action={
            <Link
              href={`/jobs/${job.id}`}
              className="rounded-full border border-white/70 bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white"
            >
              Back to Workspace
            </Link>
          }
        />
        <StateCard
          title="Not enough candidates"
          description="Import at least two CVs or run ranking so the comparison board can be populated."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Benchmarking / ${job.title}`}
        title={`Candidate Benchmarking: ${left.full_name} vs. ${right.full_name}`}
        description="Side-by-side recruiter comparison built from the highest-ranked candidates in this job workspace."
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/jobs/${job.id}`}
              className="rounded-full border border-white/70 bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white"
            >
              Back to Workspace
            </Link>
            <Link
              href={`/candidates/${left.id}`}
              className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)]"
            >
              Open Top Profile
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <CandidateComparisonCard candidate={left} accent="#4b41e1" />
        <CandidateComparisonCard candidate={right} accent="#0ea5a0" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <StateCard
          title="Skill Overlap Analysis"
          description="Shared and differentiated capabilities between the current top two profiles."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                Shared
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {overlap.length ? overlap.slice(0, 8).map((skill) => (
                  <span key={skill} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">
                    {skill}
                  </span>
                )) : <span className="text-sm text-[var(--color-muted)]">No overlap detected</span>}
              </div>
            </div>
            <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                {left.full_name.split(" ")[0]} only
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {leftOnly.length ? leftOnly.slice(0, 8).map((skill) => (
                  <span key={skill} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">
                    {skill}
                  </span>
                )) : <span className="text-sm text-[var(--color-muted)]">No differentiated skills</span>}
              </div>
            </div>
            <div className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                {right.full_name.split(" ")[0]} only
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {rightOnly.length ? rightOnly.slice(0, 8).map((skill) => (
                  <span key={skill} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">
                    {skill}
                  </span>
                )) : <span className="text-sm text-[var(--color-muted)]">No differentiated skills</span>}
              </div>
            </div>
          </div>
        </StateCard>

        <StateCard
          title="Decision Snapshot"
          description="Current ranking and evidence summary to support a shortlist call."
        >
          <div className="space-y-4 text-sm leading-6 text-[var(--color-muted)]">
            <p>
              Top ranked: <span className="font-semibold text-[var(--color-text)]">{left.full_name}</span>
            </p>
            <p>
              Match delta:{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {Math.abs(scoreToPercent(left.match_score) - scoreToPercent(right.match_score))} points
              </span>
            </p>
            <p>{left.match_summary ?? "No shortlist explanation generated for the current top profile."}</p>
            <p>{right.match_summary ?? "No shortlist explanation generated for the comparison profile."}</p>
          </div>
        </StateCard>
      </div>

      <StateCard
        title="Evidence Links"
        description="Verification-facing comparison of project evidence attached to both candidates."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {[left, right].map((candidate) => {
            const links = readVerifiedLinks(candidate);

            return (
              <div
                key={`links-${candidate.id}`}
                className="rounded-[24px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-5"
              >
                <p className="text-lg font-semibold text-[var(--color-text)]">{candidate.full_name}</p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--color-muted)]">
                  {links.length ? (
                    links.slice(0, 4).map((link, index) => (
                      <div key={`${candidate.id}-link-${index}`}>
                        <p className="font-medium text-[var(--color-text)]">
                          {link.claim_title ?? `Evidence link ${index + 1}`}
                        </p>
                        <p>
                          {link.claim_match_status ?? "unchecked"} · {link.final_url ?? link.url ?? "No URL"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>No verification links recorded.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </StateCard>
    </div>
  );
}
