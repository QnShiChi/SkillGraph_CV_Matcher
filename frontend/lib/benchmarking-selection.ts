type CandidateLike = {
  id: number;
  match_score: number | null;
  updated_at: string;
};

type ComparisonSelectionAction = {
  selectedIds: number[];
  href: string | null;
};

function pickTopCandidates<T extends CandidateLike>(candidates: T[]): T[] {
  return [...candidates]
    .sort((left, right) => {
      const leftScore = left.match_score ?? -1;
      const rightScore = right.match_score ?? -1;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    })
    .slice(0, 2);
}

export function resolveComparisonCandidates<T extends CandidateLike>(
  candidates: T[],
  leftCandidateId: string | undefined,
  rightCandidateId: string | undefined,
): T[] {
  const leftId = Number(leftCandidateId);
  const rightId = Number(rightCandidateId);

  if (
    Number.isInteger(leftId) &&
    Number.isInteger(rightId) &&
    leftId !== rightId
  ) {
    const selected = [leftId, rightId]
      .map((candidateId) => candidates.find((candidate) => candidate.id === candidateId))
      .filter((candidate): candidate is T => Boolean(candidate));

    if (selected.length === 2) {
      return selected;
    }
  }

  return pickTopCandidates(candidates);
}

export function listSecondaryComparisonCandidates<T extends CandidateLike>(
  candidates: T[],
  selectedCandidateIds: number[],
): T[] {
  if (selectedCandidateIds.length !== 1) {
    return [];
  }

  const [selectedCandidateId] = selectedCandidateIds;

  return candidates.filter((candidate) => candidate.id !== selectedCandidateId);
}

export function buildComparisonHref(
  jobId: number,
  leftCandidateId: number,
  rightCandidateId: number,
) {
  const params = new URLSearchParams({
    leftCandidateId: String(leftCandidateId),
    rightCandidateId: String(rightCandidateId),
  });

  return `/jobs/${jobId}/benchmarking?${params.toString()}`;
}

export function resolveComparisonSelectionAction(
  jobId: number,
  selectedCandidateIds: number[],
  nextCandidateId: number,
): ComparisonSelectionAction {
  if (selectedCandidateIds.includes(nextCandidateId)) {
    return {
      selectedIds: selectedCandidateIds.filter((candidateId) => candidateId !== nextCandidateId),
      href: null,
    };
  }

  if (selectedCandidateIds.length === 0) {
    return {
      selectedIds: [nextCandidateId],
      href: null,
    };
  }

  const nextSelectedIds =
    selectedCandidateIds.length === 1
      ? [selectedCandidateIds[0], nextCandidateId]
      : [selectedCandidateIds[1], nextCandidateId];

  return {
    selectedIds: nextSelectedIds,
    href: buildComparisonHref(jobId, nextSelectedIds[0], nextSelectedIds[1]),
  };
}
