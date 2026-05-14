import type { Job, JobKnowledgeGraph } from "@/lib/api";

import { JobCandidatePanel } from "@/components/jobs/job-candidate-panel";
import { JobStructuredData } from "@/components/jobs/job-structured-data";
import { JobWorkspaceActions } from "@/components/jobs/job-workspace-actions";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";

import type { Candidate } from "@/lib/api";

export function JobWorkspace({
  job,
  initialCandidates,
  knowledgeGraph,
}: {
  job: Job;
  initialCandidates: Candidate[];
  knowledgeGraph: JobKnowledgeGraph | null;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Job Workspace"
        title={job.title}
        description={`Inspect normalized JD data, graph-ready skill structure, and import metadata before candidate ingestion is added.`}
        action={<JobWorkspaceActions jobId={job.id} />}
      />

      <StateCard
        title="Workspace Status"
        description="Compact operational view for this workspace."
      >
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-[var(--color-muted)]">
          <span>Source: {job.source_type}</span>
          <span>Extract: {job.extract_source ?? "manual"}</span>
          <span>Parse: {job.parse_status}</span>
          <span>
            Confidence: {job.parse_confidence == null ? "N/A" : `${Math.round(job.parse_confidence * 100)}%`}
          </span>
          <span>Graph: {job.graph_sync_status}</span>
          <span>Status: {job.status}</span>
        </div>
        {job.graph_sync_error ? (
          <p className="mt-3 text-sm leading-6 text-[#8b2d2d]">
            Graph sync error: {job.graph_sync_error}
          </p>
        ) : null}
      </StateCard>

      <JobStructuredData job={job} knowledgeGraph={knowledgeGraph} />

      <JobCandidatePanel jobId={job.id} initialCandidates={initialCandidates} />
    </div>
  );
}
