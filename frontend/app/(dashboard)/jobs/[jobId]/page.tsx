import { notFound } from "next/navigation";

import { JobWorkspace } from "@/components/jobs/job-workspace";
import { getJob } from "@/lib/api";

export default async function JobWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJob(Number(jobId));

  if (!job) {
    notFound();
  }

  return <JobWorkspace job={job} />;
}
