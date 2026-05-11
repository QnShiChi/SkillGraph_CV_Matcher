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
  status: string;
  created_at: string;
  updated_at: string;
};

export type Candidate = {
  id: number;
  full_name: string;
  email: string | null;
  resume_text: string | null;
  skills_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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
