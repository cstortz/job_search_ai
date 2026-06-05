export interface JobSiteRecord {
  id: string;
  user_id: string;
  company: string | null;
  industry: string | null;
  us_postal_address: string | null;
  url: string;
  frequency: string | null;
  last_polled_at: string | null;
  enabled: boolean;
  last_error_message: string | null;
  error_count: number;
  timezone: string | null;
  authentication_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobListingRecord {
  id: string;
  user_id: string;
  job_source_id: string | null;
  job_title: string;
  company_name: string;
  job_description_text: string | null;
  requirements_text: string | null;
  application_url: string | null;
  job_url: string;
  external_job_id: string | null;
  posting_date: string | null;
  salary_range: unknown;
  location: string | null;
  job_location_type: string | null;
  job_type: string | null;
  job_level: string | null;
  application_deadline: string | null;
  user_interest_level: string | null;
  user_tags: unknown;
  status: string;
  first_seen_at: string | null;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumePacketRecord {
  id: string;
  user_id: string;
  job_id: string;
  status: string | null;
  application_status: string | null;
  date_applied: string | null;
  date_of_last_status_change: string | null;
  application_method: string | null;
  application_tracking_number: string | null;
  portal_url: string | null;
  version_number: number | null;
  parent_resume_package_id: string | null;
  resume_file_url: string | null;
  resume_file_path: string | null;
  resume_storage_type: string | null;
  resume_file_size: number | null;
  resume_file_format: string | null;
  cover_letter_file_url: string | null;
  cover_letter_file_path: string | null;
  cover_letter_storage_type: string | null;
  cover_letter_file_size: number | null;
  cover_letter_file_format: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiErrorBody {
  error?: string;
}

export class ApiRequestError extends Error {
  status: number;
  body?: ApiErrorBody;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let parsedBody: unknown = null;
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const body = (parsedBody ?? undefined) as ApiErrorBody | undefined;
    throw new ApiRequestError(
      response.status,
      body?.error || `Request failed with status ${response.status}.`,
      body,
    );
  }

  return parsedBody as T;
}

export async function listJobSites(): Promise<{ jobSites: JobSiteRecord[] }> {
  return requestJson<{ jobSites: JobSiteRecord[] }>("/api/job-sites", {
    method: "GET",
  });
}

export async function createJobSite(input: {
  url: string;
  company?: string | null;
  industry?: string | null;
  usPostalAddress?: string | null;
  frequency?: string | null;
  enabled?: boolean;
  timezone?: string | null;
  authenticationType?: string | null;
}): Promise<{ jobSite: JobSiteRecord }> {
  return requestJson<{ jobSite: JobSiteRecord }>("/api/job-sites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getJobSiteById(id: string): Promise<{ jobSite: JobSiteRecord }> {
  return requestJson<{ jobSite: JobSiteRecord }>(`/api/job-sites/${id}`, {
    method: "GET",
  });
}

export async function updateJobSite(
  id: string,
  input: {
    url: string;
    company?: string | null;
    industry?: string | null;
    usPostalAddress?: string | null;
    frequency?: string | null;
    enabled?: boolean;
    timezone?: string | null;
    authenticationType?: string | null;
  },
): Promise<{ jobSite: JobSiteRecord }> {
  return requestJson<{ jobSite: JobSiteRecord }>(`/api/job-sites/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteJobSite(
  id: string,
): Promise<{ deleted: boolean; affectedRows: number; id: string }> {
  return requestJson<{ deleted: boolean; affectedRows: number; id: string }>(
    `/api/job-sites/${id}`,
    { method: "DELETE" },
  );
}

export async function listJobListings(filters?: {
  status?: string | null;
  jobSourceId?: string | null;
}): Promise<{ jobListings: JobListingRecord[] }> {
  const search = new URLSearchParams();
  if (filters?.status) {
    search.set("status", filters.status);
  }
  if (filters?.jobSourceId) {
    search.set("jobSourceId", filters.jobSourceId);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return requestJson<{ jobListings: JobListingRecord[] }>(`/api/job-listings${suffix}`, {
    method: "GET",
  });
}

export async function createJobListing(input: {
  jobUrl: string;
}): Promise<{
  jobListing: JobListingRecord;
  resumePacket: ResumePacketRecord;
  message: string;
}> {
  return requestJson<{
    jobListing: JobListingRecord;
    resumePacket: ResumePacketRecord;
    message: string;
  }>("/api/job-listings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getJobListingById(
  id: string,
): Promise<{ jobListing: JobListingRecord }> {
  return requestJson<{ jobListing: JobListingRecord }>(`/api/job-listings/${id}`, {
    method: "GET",
  });
}

export async function patchJobListingStatus(
  id: string,
  status: string,
): Promise<{ jobListing: JobListingRecord }> {
  return requestJson<{ jobListing: JobListingRecord }>(
    `/api/job-listings/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export async function listResumePackets(filters?: {
  jobId?: string | null;
  status?: string | null;
  applicationStatus?: string | null;
}): Promise<{ resumePackets: ResumePacketRecord[] }> {
  const search = new URLSearchParams();
  if (filters?.jobId) {
    search.set("jobId", filters.jobId);
  }
  if (filters?.status) {
    search.set("status", filters.status);
  }
  if (filters?.applicationStatus) {
    search.set("applicationStatus", filters.applicationStatus);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return requestJson<{ resumePackets: ResumePacketRecord[] }>(
    `/api/resume-packets${suffix}`,
    {
      method: "GET",
    },
  );
}
