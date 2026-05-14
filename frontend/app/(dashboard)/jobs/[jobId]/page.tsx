import { notFound } from "next/navigation";

import { JobWorkspace } from "@/components/jobs/job-workspace";
import { getJob, getJobCandidates, getJobKnowledgeGraph } from "@/lib/api";

export default async function JobWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const numericJobId = Number(jobId);
  const job = await getJob(numericJobId);

  if (!job) {
    notFound();
  }

  const initialCandidates = await getJobCandidates(numericJobId);
  const knowledgeGraph = await getJobKnowledgeGraph(numericJobId);

  return (
    <JobWorkspace
      job={job}
      initialCandidates={initialCandidates}
      knowledgeGraph={knowledgeGraph}
    />
  );
}
