import { notFound } from "next/navigation";

import { CandidateProfileView } from "@/components/candidates/candidate-profile-view";
import { getCandidate, getCandidateKnowledgeGraph, getJob } from "@/lib/api";

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  const { candidateId } = await params;
  const numericCandidateId = Number(candidateId);
  const candidate = await getCandidate(numericCandidateId);

  if (!candidate) {
    notFound();
  }

  const job = candidate.job_id ? await getJob(candidate.job_id) : null;
  const candidateGraph = await getCandidateKnowledgeGraph(numericCandidateId);

  return <CandidateProfileView candidate={candidate} job={job} candidateGraph={candidateGraph} />;
}
