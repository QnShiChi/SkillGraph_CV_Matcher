import { notFound } from "next/navigation";

import { JobBenchmarkingView } from "@/components/jobs/job-benchmarking-view";
import { getJob, getJobCandidates } from "@/lib/api";

export default async function JobBenchmarkingPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{
    leftCandidateId?: string | string[];
    rightCandidateId?: string | string[];
  }>;
}) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const numericJobId = Number(jobId);
  const job = await getJob(numericJobId);

  if (!job) {
    notFound();
  }

  const candidates = await getJobCandidates(numericJobId);
  const leftCandidateId =
    typeof resolvedSearchParams?.leftCandidateId === "string"
      ? resolvedSearchParams.leftCandidateId
      : undefined;
  const rightCandidateId =
    typeof resolvedSearchParams?.rightCandidateId === "string"
      ? resolvedSearchParams.rightCandidateId
      : undefined;

  return (
    <JobBenchmarkingView
      job={job}
      candidates={candidates}
      leftCandidateId={leftCandidateId}
      rightCandidateId={rightCandidateId}
    />
  );
}
