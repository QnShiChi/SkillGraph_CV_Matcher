import { CandidateAdminClient } from "@/components/candidates/candidate-admin-client";
import { getCandidates, getJobs } from "@/lib/api";

export default async function CandidatesAdminPage() {
  const [candidates, jobs] = await Promise.all([getCandidates(), getJobs()]);

  return <CandidateAdminClient initialCandidates={candidates} initialJobs={jobs} />;
}
