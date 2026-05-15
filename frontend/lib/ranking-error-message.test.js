const test = require("node:test");
const assert = require("node:assert/strict");

const { formatScreenAndRankErrorMessage } = require("./ranking-error-message");

test("formats fetch failures as an add-key prompt", () => {
  assert.equal(
    formatScreenAndRankErrorMessage("Failed to fetch"),
    "OpenRouter API key is not ready yet. Open Settings and add a key, then run Screening & Ranking again.",
  );
});

test("keeps unrelated errors readable", () => {
  assert.equal(
    formatScreenAndRankErrorMessage("Job not found."),
    "Job not found.",
  );
});
