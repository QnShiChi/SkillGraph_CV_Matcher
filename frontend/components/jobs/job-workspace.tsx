import Link from "next/link";

import type { Job } from "@/lib/api";

import { JobStructuredData } from "@/components/jobs/job-structured-data";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";

export function JobWorkspace({ job }: { job: Job }) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Job Workspace"
        title={job.title}
        description={`Inspect normalized JD data, graph-ready skill structure, and import metadata before candidate ingestion is added.`}
        action={
          <Link
            href="/admin/jobs"
            className="rounded-[14px] border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text)]"
          >
            Back to Admin Jobs
          </Link>
        }
      />

      <StateCard
        title="Workspace Status"
        description="This workspace is the job-centric handoff point for future CV import and matching."
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-[var(--color-muted)]">
          <span>Source: {job.source_type}</span>
          <span>Parse: {job.parse_status}</span>
          <span>Engine: {job.parse_source}</span>
          <span>
            Confidence: {job.parse_confidence == null ? "N/A" : `${Math.round(job.parse_confidence * 100)}%`}
          </span>
          <span>Status: {job.status}</span>
        </div>
      </StateCard>

      <JobStructuredData job={job} />

      <StateCard
        title="Next Step"
        description="Candidate import and matching controls will be added here in the next implementation phase."
      />
    </div>
  );
}
