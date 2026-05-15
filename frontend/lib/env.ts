function normalizeApiBaseUrl(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

export function resolvePublicApiBaseUrl(value: string | undefined): string {
  return normalizeApiBaseUrl(value) ?? "";
}

export function resolveServerApiBaseUrl(
  internalApiBaseUrl: string | undefined,
  publicApiBaseUrl: string | undefined,
): string {
  return (
    normalizeApiBaseUrl(internalApiBaseUrl) ??
    normalizeApiBaseUrl(publicApiBaseUrl) ??
    "http://localhost:8000"
  );
}

export const publicEnv = {
  apiBaseUrl: resolvePublicApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
};

export const serverEnv = {
  apiBaseUrl: resolveServerApiBaseUrl(
    process.env.INTERNAL_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ),
};
