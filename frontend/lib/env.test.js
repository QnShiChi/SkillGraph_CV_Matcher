const test = require("node:test");
const assert = require("node:assert/strict");

test("resolvePublicApiBaseUrl defaults to same-origin requests", async () => {
  const { resolvePublicApiBaseUrl } = await import("./env.ts");
  assert.equal(resolvePublicApiBaseUrl(undefined), "");
});

test("resolvePublicApiBaseUrl preserves an explicit public API base URL", async () => {
  const { resolvePublicApiBaseUrl } = await import("./env.ts");
  assert.equal(resolvePublicApiBaseUrl("https://api.example.com"), "https://api.example.com");
});

test("resolveServerApiBaseUrl prefers the internal API base URL", async () => {
  const { resolveServerApiBaseUrl } = await import("./env.ts");
  assert.equal(
    resolveServerApiBaseUrl("http://backend:8000", "https://skillgraph.example.com"),
    "http://backend:8000",
  );
});

test("resolveServerApiBaseUrl falls back to the public API base URL when needed", async () => {
  const { resolveServerApiBaseUrl } = await import("./env.ts");
  assert.equal(
    resolveServerApiBaseUrl(undefined, "https://skillgraph.example.com"),
    "https://skillgraph.example.com",
  );
});

test("resolveServerApiBaseUrl uses localhost only as a local-development fallback", async () => {
  const { resolveServerApiBaseUrl } = await import("./env.ts");
  assert.equal(resolveServerApiBaseUrl(undefined, undefined), "http://localhost:8000");
});
