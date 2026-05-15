function formatScreenAndRankErrorMessage(message) {
  const normalized = String(message ?? "").trim();
  const lower = normalized.toLowerCase();

  if (
    !normalized ||
    lower === "failed to fetch" ||
    lower.includes("openrouter") ||
    lower.includes("api key") ||
    lower.includes("key is required") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    return "OpenRouter API key is not ready yet. Open Settings and add a key, then run Screening & Ranking again.";
  }

  return normalized;
}

module.exports = {
  formatScreenAndRankErrorMessage,
};
