import type {
  JobSearchPreferences,
  OfficeTypePreferences,
  RelocationPreferences,
} from "../models/job-preferences";
import type { UserEducationProfile } from "../models/education";
import type { JobHistoryEntry } from "../models/job-history";
import type {
  MarketingStatements,
} from "../models/marketing";
import type {
  NotificationPreferences,
  ProfileAddress,
  ProfileOtherUrl,
  ProfileResumeIncludes,
} from "../models/profile";

export interface UserRecord {
  id: string;
  auth0_subject_id: string;
  name: string;
  email: string;
  email_verified: boolean;
  phone: string | null;
  linkedin_url: string | null;
  other_urls: unknown;
  address: string | null;
  resume_field_includes: Partial<ProfileResumeIncludes> | null;
  notification_preferences: Partial<NotificationPreferences> | null;
  timezone: string | null;
  preferred_name: string | null;
  work_authorization: string | null;
  marketing_statements: Partial<MarketingStatements> | null;
  job_preferences: Record<string, unknown> | null;
  education: UserEducationProfile | null;
  work_history: JobHistoryEntry[] | null;
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

export async function getCurrentUser(): Promise<{
  user: UserRecord;
  roles: string[];
  permissions: string[];
}> {
  return requestJson<{ user: UserRecord; roles: string[]; permissions: string[] }>(
    "/api/auth/me",
    { method: "GET" },
  );
}

export type SyncUserInput = {
  timezone?: string;
  phone?: string | null;
  linkedinUrl?: string | null;
  address?: ProfileAddress | null;
  otherUrls?: ProfileOtherUrl[] | null;
  resumeIncludes?: Partial<ProfileResumeIncludes> | null;
  notificationPreferences?: Partial<NotificationPreferences> | null;
  preferredName?: string | null;
  workAuthorization?: string | null;
  marketingStatements?: Partial<MarketingStatements> | null;
  jobPreferences?: {
    relocation?: Partial<RelocationPreferences> | null;
    officeType?: Partial<OfficeTypePreferences> | null;
    jobSearch?: Partial<JobSearchPreferences> | null;
  } | null;
  education?: UserEducationProfile | null;
  workHistory?: JobHistoryEntry[] | null;
};

export async function syncUser(input: SyncUserInput): Promise<{ user: UserRecord }> {
  return requestJson<{ user: UserRecord }>("/api/auth/sync-user", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
