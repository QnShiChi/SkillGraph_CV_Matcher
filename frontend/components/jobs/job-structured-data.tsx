import type { Job } from "@/lib/api";

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

function renderSkillCard(skill: StructuredSkill, showGraphDetails: boolean) {
  return (
    <article
      key={skill.canonical}
      className="rounded-[16px] border border-[var(--color-border)] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-[var(--color-text)]">{skill.name}</h3>
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
    </article>
  );
}

function SkillSection({
  title,
  description,
  skills,
  showGraphDetails,
}: {
  title: string;
  description: string;
  skills: StructuredSkill[];
  showGraphDetails: boolean;
}) {
  return (
    <StateCard title={title} description={description}>
      <div className="space-y-4">
        {skills.length ? (
          skills.map((skill) => renderSkillCard(skill, showGraphDetails))
        ) : (
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            No items extracted for this group.
          </p>
        )}
      </div>
    </StateCard>
  );
}

export function JobStructuredData({ job }: { job: Job }) {
  const structured = readStructuredJd(job);
  const technicalSkills = structured?.technical_skills ?? structured?.required_skills ?? [];
  const platformsCloud = structured?.platforms_cloud ?? [];
  const toolingDevops = structured?.tooling_devops ?? [];
  const competencies = structured?.competencies ?? [];
  const roleDescriptors = structured?.role_descriptors ?? [];
  const softSkills = structured?.soft_skills ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <StateCard
          title="Normalized JD"
          description="The normalized text blocks below are the recruiter-facing representation used as the basis for future matching."
        >
          <div className="space-y-5 text-sm leading-7 text-[var(--color-muted)]">
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
        </StateCard>

        <StateCard
          title="Raw JD Text"
          description="This is the original extracted text kept for traceability and future parser upgrades."
        >
          <pre className="max-h-[30rem] overflow-auto whitespace-pre-wrap rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4 text-sm leading-7 text-[var(--color-muted)]">
            {job.raw_jd_text ?? "No raw JD text available."}
          </pre>
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

        <StateCard
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
        </StateCard>

        <StateCard
          title="Metadata"
          description="Operational metadata for the imported or manually created job."
        >
          <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
            <p>Source type: {job.source_type}</p>
            <p>Source file: {job.source_file_name ?? "Manual entry"}</p>
            <p>Parse status: {job.parse_status}</p>
            <p>Parse source: {job.parse_source}</p>
            <p>Parse confidence: {formatConfidence(job.parse_confidence)}</p>
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
        </StateCard>
      </div>
    </div>
  );
}
