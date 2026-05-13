import { publicEnv, serverEnv } from "@/lib/env";

export type ConnectionResponse = {
  status: string;
  services: {
    postgres: { status: string; message: string };
    neo4j: { status: string; message: string };
  };
};

export type Job = {
  id: number;
  title: string;
  description: string | null;
  required_skills_text: string | null;
  responsibilities_text: string | null;
  qualifications_text: string | null;
  raw_jd_text: string | null;
  source_type: "manual" | "jd_pdf";
  source_file_name: string | null;
  extract_source: "text_layer" | "ocr_fallback" | null;
  parse_status: "processed" | "failed";
  parse_source: "manual" | "rule_based" | "llm_hybrid" | "rule_based_fallback";
  parse_confidence: number | null;
  graph_sync_status: "pending" | "synced" | "failed";
  graph_sync_error: string | null;
  graph_synced_at: string | null;
  structured_jd_json: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Candidate = {
  id: number;
  job_id: number | null;
  full_name: string;
  email: string | null;
  resume_text: string | null;
  skills_text: string | null;
  source_type: "manual" | "cv_pdf";
  source_file_name: string | null;
  extract_source: "text_layer" | "ocr_fallback" | null;
  parse_status: "processed" | "failed";
  parse_source: "manual" | "rule_based" | "llm_hybrid" | "rule_based_fallback";
  parse_confidence: number | null;
  graph_sync_status: "pending" | "synced" | "failed";
  graph_sync_error: string | null;
  graph_synced_at: string | null;
  structured_cv_json: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CandidateBulkImportItem = {
  filename: string;
  status: "imported" | "failed";
  candidate_id: number | null;
  candidate_name: string | null;
  extract_source: Candidate["extract_source"] | null;
  parse_source: Candidate["parse_source"] | null;
  parse_confidence: number | null;
  graph_sync_status: Candidate["graph_sync_status"] | null;
  error: string | null;
};

export type CandidateBulkImportResponse = {
  total_files: number;
  success_count: number;
  failed_count: number;
  results: CandidateBulkImportItem[];
};

export type JobInput = {
  title: string;
  description: string | null;
  required_skills_text: string | null;
  status: string;
};

export type JobUpdateInput = Partial<JobInput>;

export type CandidateInput = {
  full_name: string;
  email: string | null;
  resume_text: string | null;
  skills_text: string | null;
  status: string;
};

export type CandidateUpdateInput = Partial<CandidateInput>;

function getApiBaseUrl() {
  return typeof window === "undefined"
    ? serverEnv.apiBaseUrl
    : publicEnv.apiBaseUrl;
}

export async function getConnections(): Promise<ConnectionResponse | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/connections`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ConnectionResponse;
  } catch {
    return null;
  }
}

export async function getJobs(): Promise<Job[]> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/jobs`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as Job[];
  } catch {
    return [];
  }
}

export async function getJob(jobId: number): Promise<Job | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Job;
  } catch {
    return null;
  }
}

export async function getCandidates(): Promise<Candidate[]> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/candidates`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as Candidate[];
  } catch {
    return [];
  }
}

export async function getJobCandidates(jobId: number): Promise<Candidate[]> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}/candidates`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as Candidate[];
  } catch {
    return [];
  }
}

export async function createJob(payload: JobInput): Promise<Job> {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create job.");
  }

  return (await response.json()) as Job;
}

export async function importJobPdf(file: File): Promise<Job> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/api/jobs/import`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(payload?.detail ?? "Unable to import JD PDF.");
  }

  return (await response.json()) as Job;
}

export async function updateJob(
  jobId: number,
  payload: JobUpdateInput,
): Promise<Job> {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update job.");
  }

  return (await response.json()) as Job;
}

export async function deleteJob(jobId: number): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete job.");
  }
}

export async function createCandidate(
  payload: CandidateInput,
): Promise<Candidate> {
  const response = await fetch(`${getApiBaseUrl()}/api/candidates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create candidate.");
  }

  return (await response.json()) as Candidate;
}

export async function importJobCandidatesBulk(
  jobId: number,
  files: File[],
): Promise<CandidateBulkImportResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}/candidates/import-bulk`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(payload?.detail ?? "Unable to import CV batch for this job.");
  }

  return (await response.json()) as CandidateBulkImportResponse;
}

export async function updateCandidate(
  candidateId: number,
  payload: CandidateUpdateInput,
): Promise<Candidate> {
  const response = await fetch(`${getApiBaseUrl()}/api/candidates/${candidateId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update candidate.");
  }

  return (await response.json()) as Candidate;
}

export async function deleteCandidate(candidateId: number): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/candidates/${candidateId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete candidate.");
  }
}
