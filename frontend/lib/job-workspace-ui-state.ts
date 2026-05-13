export type JobStructuredTab = "jd-view" | "skills" | "metadata";
export type JobTextView = "normalized" | "raw";

export function readSessionValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(key, JSON.stringify(value));
}

export function jobWorkspaceKey(jobId: number, suffix: string) {
  return `job-workspace:${jobId}:${suffix}`;
}

export function structuredTabKey(jobId: number) {
  return jobWorkspaceKey(jobId, "structured-tab");
}

export function jdViewModeKey(jobId: number) {
  return jobWorkspaceKey(jobId, "jd-view-mode");
}

export function openSkillSectionsKey(jobId: number) {
  return jobWorkspaceKey(jobId, "open-skill-sections");
}

export function expandedJdBlocksKey(jobId: number) {
  return jobWorkspaceKey(jobId, "expanded-jd-blocks");
}

export function expandedSkillCardsKey(jobId: number) {
  return jobWorkspaceKey(jobId, "expanded-skill-cards");
}

export function openCandidateSectionsKey(jobId: number) {
  return jobWorkspaceKey(jobId, "open-candidate-sections");
}

export function expandedCandidateIdsKey(jobId: number, section: string) {
  return jobWorkspaceKey(jobId, `expanded-${section}-candidate-ids`);
}
