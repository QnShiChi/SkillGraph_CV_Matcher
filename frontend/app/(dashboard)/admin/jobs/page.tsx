import { JobAdminClient } from "@/components/jobs/job-admin-client";
import { getJobs } from "@/lib/api";

export default async function JobsAdminPage() {
  const jobs = await getJobs();

  return <JobAdminClient initialJobs={jobs} />;
}
