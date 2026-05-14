import Link from "next/link";

import type { Candidate, CandidateKnowledgeGraph, Job } from "@/lib/api";

import { SkillGraphVisualization } from "@/components/candidates/skill-graph-visualization";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";

type StructuredSkill = {
  name: string;
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

function formatPercent(value: number | null, fallback = "N/A") {
  if (value == null) {
    return fallback;
  }

  return `${Math.round(value * 100)}%`;
}

function toHundredPointScore(value: number | null) {
  if (value == null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function toPercentScore(value: number | null) {
  if (value == null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function formatStatusLabel(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  return value.replaceAll("_", " ");
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function deriveInterviewQuestions(candidate: Candidate, job: Job | null, missingSkills: string[]) {
  const questions = [
    `Walk through the strongest project in your CV that best matches ${job?.title ?? "this role"}.`,
    "How did you validate technical decisions and measure outcomes in that project?",
  ];

  if (missingSkills[0]) {
    questions.push(`Your profile has limited evidence around ${missingSkills[0]}. How would you close that gap quickly?`);
  }

  if (candidate.verification_summary) {
    questions.push("Explain how the linked project evidence supports the claims in your CV.");
  }

  return questions.slice(0, 4);
}

export function CandidateProfileView({
  candidate,
  job,
  candidateGraph,
}: {
  candidate: Candidate;
  job: Job | null;
  candidateGraph: CandidateKnowledgeGraph | null;
}) {
  const structured = readStructuredCv(candidate);
  const verifiedLinks = readVerifiedLinks(candidate);
  const technicalSkills = structured?.technical_skills ?? [];
  const cloudSkills = structured?.platforms_cloud ?? [];
  const toolingSkills = structured?.tooling_devops ?? [];
  const allSkills = [...technicalSkills, ...cloudSkills, ...toolingSkills];
  const strengths = allSkills.slice(0, 6).map((skill) => skill.name);
  const requiredSkills =
    job?.required_skills_text
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const skillNamesLower = new Set(strengths.map((skill) => skill.toLowerCase()));
  const missingSkills = requiredSkills.filter(
    (skill) => !skillNamesLower.has(skill.toLowerCase()),
  );
  const interviewQuestions = deriveInterviewQuestions(candidate, job, missingSkills);
  const matchScore = toHundredPointScore(candidate.match_score);
  const verificationScore = toHundredPointScore(candidate.verification_score);
  const parseScore = toPercentScore(candidate.parse_confidence);
  const confidenceItems = [
    { label: "Match fit", value: matchScore },
    { label: "Verification", value: verificationScore },
    { label: "Parse confidence", value: parseScore },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={job ? `Candidate / ${job.title}` : "Candidate / Global Pool"}
        title={candidate.full_name}
        description={
          job
            ? `Recruiter-ready profile, evidence review, and interview prep for ${job.title}.`
            : "Recruiter-ready candidate profile, evidence review, and interview prep."
        }
        action={
          <div className="flex flex-wrap gap-3">
            {job ? (
              <Link
                href={`/jobs/${job.id}`}
                className="rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white"
              >
                Open Job
              </Link>
            ) : null}
            <Link
              href="/admin/candidates"
              className="rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white"
            >
              Back to Candidates
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="space-y-6">
          <article className="overflow-hidden rounded-[32px] border border-[#c9d7ff] bg-[linear-gradient(135deg,#0b1c30_0%,#131b2e_55%,#23326a_100%)] p-5 text-white shadow-[0_32px_100px_rgba(8,15,30,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                  Candidate Profile
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">
                  {candidate.full_name}
                </h2>
                <p className="mt-2 text-sm text-white/72">
                  {job?.title ?? "General talent profile"}
                </p>
              </div>
              <div className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-white/10 text-xl font-bold">
                {getInitials(candidate.full_name)}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Match</p>
                <p className="mt-2 text-[1.75rem] font-bold">{matchScore || "N/A"}{matchScore ? "%" : ""}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Decision</p>
                <p className="mt-2 text-lg font-semibold capitalize">
                  {formatStatusLabel(candidate.screening_decision, "pending")}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Evidence</p>
                <p className="mt-2 text-lg font-semibold capitalize">
                  {formatStatusLabel(candidate.verification_status, "unchecked")}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {confidenceItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm text-white/72">
                    <span>{item.label}</span>
                    <span>{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,#6ffbbe_0%,#4b41e1_100%)]"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <StateCard
            title="Strength Snapshot"
            description="Primary signals extracted from the CV and projected into the recruiter profile."
          >
            <div className="flex flex-wrap gap-2">
              {strengths.length ? (
                strengths.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-dark)]"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-[var(--color-muted)]">No structured skills were extracted.</p>
              )}
            </div>
          </StateCard>

        </div>

        <div className="space-y-6">
          <StateCard
            title="Skill Gap Analysis Summary"
            description="This section mirrors the candidate review brief from the new FE design."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[20px] border border-[rgba(22,163,74,0.16)] bg-[rgba(22,163,74,0.06)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-success-text)]">
                  Core strengths
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {strengths.length ? (
                    strengths.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-success-text)]"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--color-muted)]">No strong signals captured.</span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
                  {structured?.summary ??
                    candidate.match_summary ??
                    "The CV provides baseline evidence, but the parser did not produce a stronger executive summary."}
                </p>
              </div>

              <div className="rounded-[20px] border border-[rgba(183,54,54,0.18)] bg-[rgba(183,54,54,0.05)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d2020]">
                  Identified gaps
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {missingSkills.length ? (
                    missingSkills.slice(0, 6).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#8d2020]"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--color-muted)]">No obvious gaps from current required skills.</span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
                  {candidate.screening_reason ??
                    "No explicit rejection signals were recorded for this profile."}
                </p>
              </div>
            </div>
          </StateCard>

          <details className="group overflow-hidden rounded-[24px] border border-white/70 bg-white/82 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 marker:hidden">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#14b8a6_100%)]" />
                  <h3 className="text-[1.05rem] font-semibold text-[var(--color-text)]">
                    AI-Generated Interview Questions
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  Open only when preparing interview prompts.
                </p>
              </div>
              <span className="material-symbols-outlined mt-0.5 text-[20px] text-[var(--color-brand-dark)] transition group-open:rotate-180">
                expand_more
              </span>
            </summary>
            <div className="border-t border-[rgba(134,155,189,0.18)] px-5 py-4">
              <div className="space-y-3">
                {interviewQuestions.map((question, index) => (
                  <div
                    key={question}
                    className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
                      Question {index + 1}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">{question}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <StateCard
          title="Candidate Metadata"
          description="Operational signals useful for recruiter QA and parser review."
        >
          <div className="space-y-2 text-sm leading-6 text-[var(--color-muted)]">
            <p>Email: {candidate.email ?? "No email captured"}</p>
            <p>Source: {candidate.source_type}</p>
            <p>Extract source: {candidate.extract_source ?? "manual"}</p>
            <p>Parse engine: {candidate.parse_source}</p>
            <p>Parse confidence: {formatPercent(candidate.parse_confidence)}</p>
            <p>Graph sync: {candidate.graph_sync_status}</p>
            <p>Updated: {new Date(candidate.updated_at).toLocaleString()}</p>
          </div>
        </StateCard>

        <details className="group overflow-hidden rounded-[24px] border border-white/70 bg-white/82 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 marker:hidden">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#14b8a6_100%)]" />
                <h3 className="text-[1.05rem] font-semibold text-[var(--color-text)]">
                  Verified Links And Resume Evidence
                </h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                Stored proof and extracted snippets for manual review.
              </p>
            </div>
            <span className="material-symbols-outlined mt-0.5 text-[20px] text-[var(--color-brand-dark)] transition group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <div className="border-t border-[rgba(134,155,189,0.18)] px-5 py-4">
            <div className="space-y-4">
              {verifiedLinks.length ? (
                verifiedLinks.map((link, index) => (
                  <div
                    key={`${link.final_url ?? link.url ?? "link"}-${index}`}
                    className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {link.claim_title ?? `Evidence link ${index + 1}`}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {link.claim_match_status ?? "unchecked"} · score{" "}
                      {link.claim_match_score ?? "N/A"}
                    </p>
                    {link.fetched_title ? (
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        Fetched title: {link.fetched_title}
                      </p>
                    ) : null}
                    {link.fetched_excerpt ? (
                      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                        {link.fetched_excerpt}
                      </p>
                    ) : null}
                    <p className="mt-2 break-all text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      {link.final_url ?? link.url ?? "No URL captured"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[var(--color-muted)]">
                  No verification links were stored for this candidate.
                </p>
              )}

              {technicalSkills
                .flatMap((skill) => skill.evidence ?? [])
                .slice(0, 3)
                .map((evidence, index) => (
                  <div
                    key={`evidence-${index}`}
                    className="rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/80 p-4"
                  >
                    <p className="text-sm leading-6 text-[var(--color-text)]">{evidence.text}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Source {evidence.section_origin}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </details>
      </div>

      <SkillGraphVisualization graph={candidateGraph} />
    </div>
  );
}
