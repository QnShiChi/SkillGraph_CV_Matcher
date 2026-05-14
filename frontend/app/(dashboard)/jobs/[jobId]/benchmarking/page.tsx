import { notFound } from "next/navigation";

import { JobBenchmarkingView } from "@/components/jobs/job-benchmarking-view";
import { getJob, getJobCandidates } from "@/lib/api";

export default async function JobBenchmarkingPage({
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

  const candidates = await getJobCandidates(numericJobId);

  return <JobBenchmarkingView job={job} candidates={candidates} />;
}
