const test = require("node:test");
const assert = require("node:assert/strict");

function makeCandidate(id, matchScore, updatedAt = "2026-05-15T12:00:00Z") {
  return {
    id,
    full_name: `Candidate ${id}`,
    match_score: matchScore,
    updated_at: updatedAt,
  };
}

test("resolveComparisonCandidates uses the explicitly selected candidates when both ids are valid", async () => {
  const { resolveComparisonCandidates } = await import("./benchmarking-selection.ts");
  const candidates = [
    makeCandidate(1, 0.95),
    makeCandidate(2, 0.91),
    makeCandidate(3, 0.72),
  ];

  const [left, right] = resolveComparisonCandidates(candidates, "3", "1");

  assert.equal(left?.id, 3);
  assert.equal(right?.id, 1);
});

test("resolveComparisonCandidates falls back to the top two ranked candidates when selection is missing", async () => {
  const { resolveComparisonCandidates } = await import("./benchmarking-selection.ts");
  const candidates = [
    makeCandidate(1, 0.95, "2026-05-15T12:00:00Z"),
    makeCandidate(2, 0.91, "2026-05-15T13:00:00Z"),
    makeCandidate(3, 0.72, "2026-05-15T14:00:00Z"),
  ];

  const [left, right] = resolveComparisonCandidates(candidates, undefined, undefined);

  assert.equal(left?.id, 1);
  assert.equal(right?.id, 2);
});

test("resolveComparisonCandidates falls back to the top two ranked candidates when selected ids are invalid", async () => {
  const { resolveComparisonCandidates } = await import("./benchmarking-selection.ts");
  const candidates = [
    makeCandidate(1, 0.95),
    makeCandidate(2, 0.91),
    makeCandidate(3, 0.72),
  ];

  const [left, right] = resolveComparisonCandidates(candidates, "999", "2");

  assert.equal(left?.id, 1);
  assert.equal(right?.id, 2);
});

test("listSecondaryComparisonCandidates returns every remaining candidate after the first selection", async () => {
  const { listSecondaryComparisonCandidates } = await import("./benchmarking-selection.ts");
  const candidates = [
    makeCandidate(1, 0.95),
    makeCandidate(2, 0.91),
    makeCandidate(3, 0.72),
  ];

  const options = listSecondaryComparisonCandidates(candidates, [2]);

  assert.deepEqual(
    options.map((candidate) => candidate.id),
    [1, 3],
  );
});

test("listSecondaryComparisonCandidates returns no inline choices when zero or two candidates are already selected", async () => {
  const { listSecondaryComparisonCandidates } = await import("./benchmarking-selection.ts");
  const candidates = [
    makeCandidate(1, 0.95),
    makeCandidate(2, 0.91),
    makeCandidate(3, 0.72),
  ];

  assert.deepEqual(listSecondaryComparisonCandidates(candidates, []).map((candidate) => candidate.id), []);
  assert.deepEqual(
    listSecondaryComparisonCandidates(candidates, [1, 2]).map((candidate) => candidate.id),
    [],
  );
});

test("resolveComparisonSelectionAction keeps the first click as a pending selection without navigation", async () => {
  const { resolveComparisonSelectionAction } = await import("./benchmarking-selection.ts");

  const result = resolveComparisonSelectionAction(31, [], 120);

  assert.deepEqual(result.selectedIds, [120]);
  assert.equal(result.href, null);
});

test("resolveComparisonSelectionAction navigates to the explicit comparison after the second selection", async () => {
  const { resolveComparisonSelectionAction } = await import("./benchmarking-selection.ts");

  const result = resolveComparisonSelectionAction(31, [120], 119);

  assert.deepEqual(result.selectedIds, [120, 119]);
  assert.equal(
    result.href,
    "/jobs/31/benchmarking?leftCandidateId=120&rightCandidateId=119",
  );
});
