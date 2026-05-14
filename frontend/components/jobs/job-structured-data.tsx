import type { ReactNode } from "react";

import type { Job, JobKnowledgeGraph } from "@/lib/api";

import { JobKnowledgeGraphView } from "@/components/jobs/job-knowledge-graph";
import { StateCard } from "@/components/state-card";

type StructuredSkill = {
  name: string;
  canonical: string;
  importance: number;
  requirement_type: string;
  confidence?: number;
  skill_groups: string[];
  prerequisites: string[];
  related_skills: string[];
};

type StructuredTextItem = {
  text: string;
};

type StructuredJd = {
  summary?: string | null;
  required_skills?: StructuredSkill[];
  technical_skills?: StructuredSkill[];
  platforms_cloud?: StructuredSkill[];
  tooling_devops?: StructuredSkill[];
  competencies?: StructuredSkill[];
  role_descriptors?: StructuredSkill[];
  responsibilities?: StructuredTextItem[];
  qualifications?: StructuredTextItem[];
  skill_groups?: string[];
  soft_skills?: string[];
  experience_years?: number | null;
};

function readStructuredJd(job: Job): StructuredJd | null {
  if (!job.structured_jd_json || typeof job.structured_jd_json !== "object") {
    return null;
  }

  return job.structured_jd_json as StructuredJd;
}

function formatConfidence(value: number | null | undefined) {
  if (value == null) {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

function CollapsibleCard({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-[24px] border border-white/70 bg-white/82 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 marker:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#14b8a6_100%)]" />
            <h3 className="text-[1.05rem] font-semibold text-[var(--color-text)]">{title}</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
        </div>
        <span className="material-symbols-outlined mt-0.5 text-[20px] text-[var(--color-brand-dark)] transition group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="border-t border-[rgba(134,155,189,0.18)] px-5 py-4">{children}</div>
    </details>
  );
}

function renderSkillCard(skill: StructuredSkill, showGraphDetails: boolean) {
  return (
    <details
      key={skill.canonical}
      className="group rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.04)] transition"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:hidden">
        <h3 className="min-w-0 text-base font-semibold text-[var(--color-text)]">
          {skill.name}
        </h3>
        <span className="material-symbols-outlined text-[20px] text-[var(--color-brand-dark)] transition group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="border-t border-[rgba(134,155,189,0.18)] px-4 pb-4 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-dark)]">
            {skill.requirement_type}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          Canonical: {skill.canonical} · Importance: {skill.importance}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Confidence: {formatConfidence(skill.confidence)}
        </p>
        {showGraphDetails ? (
          <>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Groups: {skill.skill_groups.join(", ") || "None"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Prerequisites: {skill.prerequisites.join(", ") || "None"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Related: {skill.related_skills.join(", ") || "None"}
          </p>
          </>
        ) : null}
      </div>
    </details>
  );
}

function SkillSection({
  title,
  description,
  skills,
  showGraphDetails,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  skills: StructuredSkill[];
  showGraphDetails: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <CollapsibleCard title={title} description={description} defaultOpen={defaultOpen}>
      <div className="space-y-4">
        {skills.length ? (
          skills.map((skill) => renderSkillCard(skill, showGraphDetails))
        ) : (
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            No items extracted for this group.
          </p>
        )}
      </div>
    </CollapsibleCard>
  );
}

export function JobStructuredData({
  job,
  knowledgeGraph,
}: {
  job: Job;
  knowledgeGraph: JobKnowledgeGraph | null;
}) {
  const structured = readStructuredJd(job);
  const technicalSkills = structured?.technical_skills ?? structured?.required_skills ?? [];
  const platformsCloud = structured?.platforms_cloud ?? [];
  const toolingDevops = structured?.tooling_devops ?? [];
  const competencies = structured?.competencies ?? [];
  const roleDescriptors = structured?.role_descriptors ?? [];
  const softSkills = structured?.soft_skills ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
        <StateCard
          title="Normalized JD"
          description="Always-visible recruiter summary for quick recognition."
        >
          <div className="space-y-4 text-sm leading-7 text-[var(--color-muted)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                Summary
              </p>
              <p className="mt-2">{structured?.summary ?? job.description ?? "No summary available."}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                Required skills
              </p>
              <p className="mt-2">{job.required_skills_text ?? "No required skills extracted yet."}</p>
            </div>
            <details className="group rounded-[18px] border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.04)] px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                  Responsibilities & qualifications
                </p>
                <span className="material-symbols-outlined text-[20px] text-[var(--color-brand-dark)] transition group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                    Responsibilities
                  </p>
                  <p className="mt-2">{job.responsibilities_text ?? "No responsibilities extracted yet."}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                    Qualifications
                  </p>
                  <p className="mt-2">{job.qualifications_text ?? "No qualifications extracted yet."}</p>
                </div>
              </div>
            </details>
          </div>
        </StateCard>
        </div>

        <div className="space-y-6">
        <SkillSection
          title="Technical Skills"
          description="Core graph-oriented technical skills that should drive skill matching most strongly."
          skills={technicalSkills}
          showGraphDetails
        />

        <SkillSection
          title="Cloud & Platforms"
          description="Cloud or platform choices extracted from the JD."
          skills={platformsCloud}
          showGraphDetails
        />

        <SkillSection
          title="Tooling & DevOps"
          description="Engineering tooling, delivery practices, and DevOps-related signals."
          skills={toolingDevops}
          showGraphDetails
        />

        <SkillSection
          title="Competencies"
          description="Professional competencies that matter for matching but are not treated as core technical graph nodes."
          skills={competencies}
          showGraphDetails={false}
        />

        <SkillSection
          title="Role Descriptors"
          description="Contextual job descriptors such as remote work, distributed collaboration, and team topology."
          skills={roleDescriptors}
          showGraphDetails={false}
        />

        <CollapsibleCard
          title="Soft Skills"
          description="Non-technical traits extracted from the JD."
        >
          <div className="flex flex-wrap gap-2">
            {softSkills.length ? (
              softSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-dark)]"
                >
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-sm leading-6 text-[var(--color-muted)]">
                No soft skills extracted.
              </p>
            )}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="Metadata"
          description="Operational metadata for the imported or manually created job."
        >
          <div className="space-y-2 text-sm leading-6 text-[var(--color-muted)]">
            <p>Source type: {job.source_type}</p>
            <p>Source file: {job.source_file_name ?? "Manual entry"}</p>
            <p>Extract source: {job.extract_source ?? "Manual entry"}</p>
            <p>Parse status: {job.parse_status}</p>
            <p>Parse source: {job.parse_source}</p>
            <p>Parse confidence: {formatConfidence(job.parse_confidence)}</p>
            <p>Graph sync status: {job.graph_sync_status}</p>
            <p>Graph synced at: {job.graph_synced_at ?? "Not synced yet"}</p>
            {job.graph_sync_error ? <p>Graph sync error: {job.graph_sync_error}</p> : null}
            <p>
              Skill groups: {structured?.skill_groups?.join(", ") || "No groups assigned"}
            </p>
            <p>
              Experience years:{" "}
              {structured?.experience_years == null
                ? "Not detected"
                : structured.experience_years}
            </p>
          </div>
        </CollapsibleCard>
      </div>
      </div>

      <JobKnowledgeGraphView graph={knowledgeGraph} />
    </div>
  );
}
