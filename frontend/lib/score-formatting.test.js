const test = require("node:test");
const assert = require("node:assert/strict");

test("toHundredPointScore keeps 0-100 scores unchanged apart from rounding", async () => {
  const { toHundredPointScore } = await import("./score-formatting.ts");

  assert.equal(toHundredPointScore(48.82), 49);
  assert.equal(toHundredPointScore(42.93), 43);
  assert.equal(toHundredPointScore(100), 100);
});
