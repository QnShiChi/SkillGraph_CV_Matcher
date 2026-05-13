"use client";

import { useEffect, useState } from "react";

import type { Job } from "@/lib/api";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { StateCard } from "@/components/state-card";
import {
  type JobStructuredTab,
  type JobTextView,
  jdViewModeKey,
  openSkillSectionsKey,
  readSessionValue,
  structuredTabKey,
  writeSessionValue,
} from "@/lib/job-workspace-ui-state";

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

type SkillSectionKey =
  | "technical"
  | "cloud"
  | "tooling"
  | "competencies"
  | "role"
  | "soft";

type TextBlockKey =
  | "summary"
  | "required-skills"
  | "responsibilities"
  | "qualifications";

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
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {skill.name}
        </h3>
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

function ExpandableTextBlock({
  label,
  text,
  expanded,
  onToggle,
}: {
  label: string;
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
        {label}
      </p>
      <div
        className={
          expanded
            ? "mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]"
            : "mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]"
        }
      >
        {text}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="mt-2 text-sm font-medium text-[var(--color-brand-dark)]"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

function skillCountLabel<T>(items: T[], singular: string, plural: string) {
  return `${items.length} ${items.length === 1 ? singular : plural}`;
}

export function JobStructuredData({ job }: { job: Job }) {
  const structured = readStructuredJd(job);
  const technicalSkills =
    structured?.technical_skills ?? structured?.required_skills ?? [];
  const platformsCloud = structured?.platforms_cloud ?? [];
  const toolingDevops = structured?.tooling_devops ?? [];
  const competencies = structured?.competencies ?? [];
  const roleDescriptors = structured?.role_descriptors ?? [];
  const softSkills = structured?.soft_skills ?? [];
  const [activeTab, setActiveTab] = useState<JobStructuredTab>("jd-view");
  const [jdViewMode, setJdViewMode] = useState<JobTextView>("normalized");
  const [openSkillSections, setOpenSkillSections] = useState<SkillSectionKey[]>([
    "technical",
  ]);
  const [expandedBlocks, setExpandedBlocks] = useState<TextBlockKey[]>([]);
  const [showAllSkillSections, setShowAllSkillSections] = useState<
    SkillSectionKey[]
  >([]);

  useEffect(() => {
    setActiveTab(readSessionValue(structuredTabKey(job.id), "jd-view"));
    setJdViewMode(readSessionValue(jdViewModeKey(job.id), "normalized"));
    setOpenSkillSections(
      readSessionValue(openSkillSectionsKey(job.id), ["technical"]),
    );
  }, [job.id]);

  useEffect(() => {
    writeSessionValue(structuredTabKey(job.id), activeTab);
  }, [activeTab, job.id]);

  useEffect(() => {
    writeSessionValue(jdViewModeKey(job.id), jdViewMode);
  }, [jdViewMode, job.id]);

  useEffect(() => {
    writeSessionValue(openSkillSectionsKey(job.id), openSkillSections);
  }, [job.id, openSkillSections]);

  function toggleExpandedBlock(block: TextBlockKey) {
    setExpandedBlocks((current) =>
      current.includes(block)
        ? current.filter((item) => item !== block)
        : [...current, block],
    );
  }

  function toggleSkillSection(section: SkillSectionKey) {
    setOpenSkillSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  }

  function toggleShowAll(section: SkillSectionKey) {
    setShowAllSkillSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  }

  function visibleSkills(
    section: SkillSectionKey,
    skills: StructuredSkill[],
  ): StructuredSkill[] {
    return showAllSkillSections.includes(section) ? skills : skills.slice(0, 6);
  }

  const tabs: Array<{ id: JobStructuredTab; label: string }> = [
    { id: "jd-view", label: "JD View" },
    { id: "skills", label: "Skills & Competencies" },
    { id: "metadata", label: "Metadata" },
  ];

  const normalizedSections = [
    {
      key: "summary" as TextBlockKey,
      label: "Summary",
      text: structured?.summary ?? job.description ?? "No summary available.",
    },
    {
      key: "required-skills" as TextBlockKey,
      label: "Required Skills",
      text: job.required_skills_text ?? "No required skills extracted yet.",
    },
    {
      key: "responsibilities" as TextBlockKey,
      label: "Responsibilities",
      text: job.responsibilities_text ?? "No responsibilities extracted yet.",
    },
    {
      key: "qualifications" as TextBlockKey,
      label: "Qualifications",
      text: job.qualifications_text ?? "No qualifications extracted yet.",
    },
  ];

  return (
    <StateCard
      title="Job Data"
      description="Inspect recruiter-facing job content, extracted skills, and import metadata without expanding the entire workspace at once."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "jd-view" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setJdViewMode("normalized")}
                className={
                  jdViewMode === "normalized"
                    ? "rounded-full bg-[var(--color-brand-subtle)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-dark)]"
                    : "rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"
                }
              >
                Normalized JD
              </button>
              <button
                type="button"
                onClick={() => setJdViewMode("raw")}
                className={
                  jdViewMode === "raw"
                    ? "rounded-full bg-[var(--color-brand-subtle)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-dark)]"
                    : "rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"
                }
              >
                Raw JD
              </button>
            </div>

            {jdViewMode === "normalized" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {normalizedSections.map((section) => (
                  <div
                    key={section.key}
                    className="rounded-[16px] border border-[var(--color-border)] p-4"
                  >
                    <ExpandableTextBlock
                      label={section.label}
                      text={section.text}
                      expanded={expandedBlocks.includes(section.key)}
                      onToggle={() => toggleExpandedBlock(section.key)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-[16px] bg-[rgba(148,151,169,0.08)] p-4 text-sm leading-7 text-[var(--color-muted)]">
                {job.raw_jd_text ?? "No raw JD text available."}
              </pre>
            )}
          </div>
        ) : null}

        {activeTab === "skills" ? (
          <div className="space-y-4">
            <CollapsibleSection
              title="Technical Skills"
              description={skillCountLabel(
                technicalSkills,
                "technical skill",
                "technical skills",
              )}
              count={technicalSkills.length}
              open={openSkillSections.includes("technical")}
              onToggle={() => toggleSkillSection("technical")}
            >
              <div className="space-y-4">
                {technicalSkills.length ? (
                  visibleSkills("technical", technicalSkills).map((skill) =>
                    renderSkillCard(skill, true),
                  )
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    No items extracted for this group.
                  </p>
                )}
                {technicalSkills.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => toggleShowAll("technical")}
                    className="text-sm font-medium text-[var(--color-brand-dark)]"
                  >
                    {showAllSkillSections.includes("technical")
                      ? "Show fewer"
                      : `Show all ${technicalSkills.length}`}
                  </button>
                ) : null}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Cloud & Platforms"
              description={skillCountLabel(
                platformsCloud,
                "platform item",
                "platform items",
              )}
              count={platformsCloud.length}
              open={openSkillSections.includes("cloud")}
              onToggle={() => toggleSkillSection("cloud")}
            >
              <div className="space-y-4">
                {platformsCloud.length ? (
                  visibleSkills("cloud", platformsCloud).map((skill) =>
                    renderSkillCard(skill, true),
                  )
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    No items extracted for this group.
                  </p>
                )}
                {platformsCloud.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => toggleShowAll("cloud")}
                    className="text-sm font-medium text-[var(--color-brand-dark)]"
                  >
                    {showAllSkillSections.includes("cloud")
                      ? "Show fewer"
                      : `Show all ${platformsCloud.length}`}
                  </button>
                ) : null}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Tooling & DevOps"
              description={skillCountLabel(
                toolingDevops,
                "tooling item",
                "tooling items",
              )}
              count={toolingDevops.length}
              open={openSkillSections.includes("tooling")}
              onToggle={() => toggleSkillSection("tooling")}
            >
              <div className="space-y-4">
                {toolingDevops.length ? (
                  visibleSkills("tooling", toolingDevops).map((skill) =>
                    renderSkillCard(skill, true),
                  )
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    No items extracted for this group.
                  </p>
                )}
                {toolingDevops.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => toggleShowAll("tooling")}
                    className="text-sm font-medium text-[var(--color-brand-dark)]"
                  >
                    {showAllSkillSections.includes("tooling")
                      ? "Show fewer"
                      : `Show all ${toolingDevops.length}`}
                  </button>
                ) : null}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Competencies"
              description={skillCountLabel(
                competencies,
                "competency",
                "competencies",
              )}
              count={competencies.length}
              open={openSkillSections.includes("competencies")}
              onToggle={() => toggleSkillSection("competencies")}
            >
              <div className="space-y-4">
                {competencies.length ? (
                  visibleSkills("competencies", competencies).map((skill) =>
                    renderSkillCard(skill, false),
                  )
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    No items extracted for this group.
                  </p>
                )}
                {competencies.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => toggleShowAll("competencies")}
                    className="text-sm font-medium text-[var(--color-brand-dark)]"
                  >
                    {showAllSkillSections.includes("competencies")
                      ? "Show fewer"
                      : `Show all ${competencies.length}`}
                  </button>
                ) : null}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Role Descriptors"
              description={skillCountLabel(
                roleDescriptors,
                "role descriptor",
                "role descriptors",
              )}
              count={roleDescriptors.length}
              open={openSkillSections.includes("role")}
              onToggle={() => toggleSkillSection("role")}
            >
              <div className="space-y-4">
                {roleDescriptors.length ? (
                  visibleSkills("role", roleDescriptors).map((skill) =>
                    renderSkillCard(skill, false),
                  )
                ) : (
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    No items extracted for this group.
                  </p>
                )}
                {roleDescriptors.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => toggleShowAll("role")}
                    className="text-sm font-medium text-[var(--color-brand-dark)]"
                  >
                    {showAllSkillSections.includes("role")
                      ? "Show fewer"
                      : `Show all ${roleDescriptors.length}`}
                  </button>
                ) : null}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Soft Skills"
              description={skillCountLabel(softSkills, "soft skill", "soft skills")}
              count={softSkills.length}
              open={openSkillSections.includes("soft")}
              onToggle={() => toggleSkillSection("soft")}
            >
              <div className="flex flex-wrap gap-2">
                {softSkills.length ? (
                  (showAllSkillSections.includes("soft")
                    ? softSkills
                    : softSkills.slice(0, 6)
                  ).map((skill) => (
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
              {softSkills.length > 6 ? (
                <button
                  type="button"
                  onClick={() => toggleShowAll("soft")}
                  className="mt-4 text-sm font-medium text-[var(--color-brand-dark)]"
                >
                  {showAllSkillSections.includes("soft")
                    ? "Show fewer"
                    : `Show all ${softSkills.length}`}
                </button>
              ) : null}
            </CollapsibleSection>
          </div>
        ) : null}

        {activeTab === "metadata" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[16px] border border-[var(--color-border)] p-4 text-sm leading-6 text-[var(--color-muted)]">
              <p>Source type: {job.source_type}</p>
              <p>Source file: {job.source_file_name ?? "Manual entry"}</p>
              <p>Extract source: {job.extract_source ?? "Manual entry"}</p>
              <p>Parse status: {job.parse_status}</p>
              <p>Parse source: {job.parse_source}</p>
              <p>Parse confidence: {formatConfidence(job.parse_confidence)}</p>
            </div>
            <div className="rounded-[16px] border border-[var(--color-border)] p-4 text-sm leading-6 text-[var(--color-muted)]">
              <p>Graph sync status: {job.graph_sync_status}</p>
              <p>Graph synced at: {job.graph_synced_at ?? "Not synced yet"}</p>
              {job.graph_sync_error ? (
                <p>Graph sync error: {job.graph_sync_error}</p>
              ) : null}
              <p>
                Skill groups: {structured?.skill_groups?.join(", ") || "No groups assigned"}
              </p>
              <p>
                Experience years:{" "}
                {structured?.experience_years == null
                  ? "Not detected"
                  : structured.experience_years}
              </p>
              <p>Technical skills: {technicalSkills.length}</p>
              <p>Cloud/platforms: {platformsCloud.length}</p>
              <p>Tooling/devops: {toolingDevops.length}</p>
            </div>
          </div>
        ) : null}
      </div>
    </StateCard>
  );
}
