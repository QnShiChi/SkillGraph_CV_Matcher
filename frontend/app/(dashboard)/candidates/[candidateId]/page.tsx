import { notFound } from "next/navigation";

import { CandidateProfileView } from "@/components/candidates/candidate-profile-view";
import {
  getCandidate,
  getCandidateJobRecommendations,
  getCandidateKnowledgeGraph,
  getJob,
} from "@/lib/api";

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

  const [job, candidateGraph, recommendations] = await Promise.all([
    candidate.job_id ? getJob(candidate.job_id) : Promise.resolve(null),
    getCandidateKnowledgeGraph(numericCandidateId),
    getCandidateJobRecommendations(numericCandidateId),
  ]);

  return (
    <CandidateProfileView
      candidate={candidate}
      job={job}
      candidateGraph={candidateGraph}
      recommendations={recommendations?.recommendations ?? []}
    />
  );
}
