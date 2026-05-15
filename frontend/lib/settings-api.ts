import { publicEnv } from "@/lib/env";

export type OpenRouterApiKeyStatus = {
  has_openrouter_api_key: boolean;
};

export type OpenRouterConnectionStatus = {
  connection_status: "connected" | "failed" | "unset";
  detail: string | null;
};

function getApiBaseUrl() {
  return publicEnv.apiBaseUrl;
}

export async function getOpenRouterApiKeyStatus(): Promise<OpenRouterApiKeyStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/settings/openrouter-api-key`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load API key status.");
  }

  return (await response.json()) as OpenRouterApiKeyStatus;
}

export async function getOpenRouterConnectionStatus(): Promise<OpenRouterConnectionStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/settings/openrouter-api-key/status`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load connection status.");
  }

  return (await response.json()) as OpenRouterConnectionStatus;
}

export async function saveOpenRouterApiKey(apiKey: string): Promise<OpenRouterApiKeyStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/settings/openrouter-api-key`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(payload?.detail ?? "Failed to save API key.");
  }

  return (await response.json()) as OpenRouterApiKeyStatus;
}

export async function validateOpenRouterApiKey(
  apiKey: string,
): Promise<OpenRouterConnectionStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/settings/openrouter-api-key/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(payload?.detail ?? "Failed to validate API key.");
  }

  return (await response.json()) as OpenRouterConnectionStatus;
}

export async function clearOpenRouterApiKey(): Promise<OpenRouterApiKeyStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/settings/openrouter-api-key`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(payload?.detail ?? "Failed to clear API key.");
  }

  return (await response.json()) as OpenRouterApiKeyStatus;
}
