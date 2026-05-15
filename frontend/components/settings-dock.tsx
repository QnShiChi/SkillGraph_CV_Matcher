"use client";

import { useEffect, useRef, useState } from "react";

import {
  clearOpenRouterApiKey,
  getOpenRouterApiKeyStatus,
  getOpenRouterConnectionStatus,
  saveOpenRouterApiKey,
  validateOpenRouterApiKey,
} from "@/lib/settings-api";

export function SettingsDock() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [activeSource, setActiveSource] = useState<"env" | "database" | "unset">("unset");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "failed" | "unset"
  >("unset");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const [apiKeyStatus, connectionStatusResult] = await Promise.all([
          getOpenRouterApiKeyStatus(),
          getOpenRouterConnectionStatus(),
        ]);
        if (isMounted) {
          setHasApiKey(apiKeyStatus.has_openrouter_api_key);
          setHasSavedApiKey(apiKeyStatus.has_saved_openrouter_api_key);
          setActiveSource(apiKeyStatus.active_source);
          setConnectionStatus(connectionStatusResult.connection_status);
          setErrorMessage(
            connectionStatusResult.detail && connectionStatusResult.connection_status === "failed"
              ? connectionStatusResult.detail
              : null,
          );
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Unable to load API key status.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    const apiKey = inputRef.current?.value.trim() ?? "";
    if (!apiKey) {
      setErrorMessage("API key cannot be empty.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const validation = await validateOpenRouterApiKey(apiKey);
      if (validation.connection_status !== "connected") {
        const [apiKeyStatus, connectionStatusResult] = await Promise.all([
          getOpenRouterApiKeyStatus(),
          getOpenRouterConnectionStatus(),
        ]);
        setHasApiKey(apiKeyStatus.has_openrouter_api_key);
        setHasSavedApiKey(apiKeyStatus.has_saved_openrouter_api_key);
        setActiveSource(apiKeyStatus.active_source);
        setConnectionStatus(connectionStatusResult.connection_status);
        setErrorMessage(validation.detail ?? "Failed to validate API key.");
        return;
      }

      await saveOpenRouterApiKey(apiKey);
      const [apiKeyStatus, connectionStatusResult] = await Promise.all([
        getOpenRouterApiKeyStatus(),
        getOpenRouterConnectionStatus(),
      ]);
      setHasApiKey(apiKeyStatus.has_openrouter_api_key);
      setHasSavedApiKey(apiKeyStatus.has_saved_openrouter_api_key);
      setActiveSource(apiKeyStatus.active_source);
      setConnectionStatus(connectionStatusResult.connection_status);
      setErrorMessage(
        connectionStatusResult.connection_status === "connected"
          ? "Connected to OpenRouter."
          : connectionStatusResult.detail ?? "Failed to connect to OpenRouter.",
      );
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      try {
        const [apiKeyStatus, connectionStatusResult] = await Promise.all([
          getOpenRouterApiKeyStatus(),
          getOpenRouterConnectionStatus(),
        ]);
        setHasApiKey(apiKeyStatus.has_openrouter_api_key);
        setHasSavedApiKey(apiKeyStatus.has_saved_openrouter_api_key);
        setActiveSource(apiKeyStatus.active_source);
        setConnectionStatus(connectionStatusResult.connection_status);
      } catch {
        setConnectionStatus("failed");
      }
      setErrorMessage(error instanceof Error ? error.message : "Failed to save API key.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const apiKeyStatus = await clearOpenRouterApiKey();
      const connectionStatusResult = await getOpenRouterConnectionStatus();
      setHasApiKey(apiKeyStatus.has_openrouter_api_key);
      setHasSavedApiKey(apiKeyStatus.has_saved_openrouter_api_key);
      setActiveSource(apiKeyStatus.active_source);
      setConnectionStatus(connectionStatusResult.connection_status);
      setErrorMessage(
        connectionStatusResult.connection_status === "failed"
          ? connectionStatusResult.detail ?? "Failed to connect to OpenRouter."
          : null,
      );
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to clear API key.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div
        className={`absolute bottom-16 left-0 w-[min(20rem,calc(100vw-2rem))] rounded-[24px] border border-white/70 bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_20px_60px_rgba(10,20,40,0.16)] backdrop-blur-xl transition-all duration-200 ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
            Settings
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">
            API Configuration
          </h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Saved on the server. Nothing is stored in localStorage.
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            OpenRouter API Key
          </span>
          <input
            ref={inputRef}
            aria-label="OpenRouter API key"
            className="w-full rounded-[16px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[rgba(75,65,225,0.45)] focus:ring-2 focus:ring-[rgba(75,65,225,0.12)]"
            placeholder={
              activeSource === "env"
                ? "Active key is provided by the server environment"
                : isLoading || hasSavedApiKey
                  ? "Fallback key saved in database"
                  : "Paste your key here"
            }
            type="password"
          />
        </label>

        <p className="mt-2 text-xs font-medium text-[var(--color-muted)]">
          {activeSource === "env"
            ? "The active key is coming from the server environment."
            : hasSavedApiKey
              ? "A fallback key is saved in the database."
              : "No fallback API key is saved in the database."}
        </p>

        <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
          {connectionStatus === "connected" ? (
            <>
              <span className="material-symbols-outlined text-[18px] text-[var(--color-success)]">
                check_circle
              </span>
              <span className="text-[var(--color-success-text)]">Connected</span>
            </>
          ) : connectionStatus === "failed" ? (
            <>
              <span className="material-symbols-outlined text-[18px] text-red-600">
                error
              </span>
              <span className="text-red-600">Failed</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px] text-[var(--color-muted)]">
                radio_button_unchecked
              </span>
              <span className="text-[var(--color-muted)]">Not connected</span>
            </>
          )}
        </div>

        {errorMessage ? (
          <p
            className={`mt-2 text-xs font-medium ${
              connectionStatus === "connected" ? "text-[var(--color-success-text)]" : "text-red-600"
            }`}
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)] transition hover:text-[var(--color-brand)]"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text)] transition hover:bg-[rgba(75,65,225,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="Open settings"
        className="flex items-center gap-3 rounded-full border border-white/70 bg-white/92 px-4 py-3 text-[var(--color-muted)] shadow-[0_10px_30px_rgba(10,20,40,0.10)] backdrop-blur-xl transition hover:text-[var(--color-brand)]"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="material-symbols-outlined text-[20px]">settings</span>
        <span className="hidden text-sm font-semibold text-[var(--color-text)] sm:inline">
          Settings
        </span>
        {connectionStatus === "connected" ? (
          <span className="flex items-center gap-1 rounded-full bg-[rgba(22,163,74,0.12)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-success-text)]">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Connected
          </span>
        ) : connectionStatus === "failed" ? (
          <span className="flex items-center gap-1 rounded-full bg-[rgba(239,68,68,0.10)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-600">
            <span className="material-symbols-outlined text-[14px]">error</span>
            Failed
          </span>
        ) : hasApiKey ? (
          <span className="rounded-full bg-[rgba(22,163,74,0.10)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-success-text)]">
            {activeSource === "env" ? "Env" : "Saved"}
          </span>
        ) : (
          <span className="rounded-full bg-[rgba(148,151,169,0.12)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Not set
          </span>
        )}
      </button>
    </div>
  );
}
