import { CandidateAdminClient } from "@/components/candidates/candidate-admin-client";
import { getCandidates } from "@/lib/api";

export default async function CandidatesAdminPage() {
  const candidates = await getCandidates();

  return <CandidateAdminClient initialCandidates={candidates} />;
}
