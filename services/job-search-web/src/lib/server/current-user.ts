import "server-only";

import {
  mergeJobPreferences,
  parseJobPreferences,
  serializeJobPreferences,
  type JobSearchPreferences,
  type OfficeTypePreferences,
  type RelocationPreferences,
} from "../models/job-preferences";
import {
  parseUserEducation,
  serializeUserEducation,
} from "../models/education";
import {
  parseJobHistory,
  serializeJobHistory,
} from "../models/job-history";
import {
  parseMarketingStatements,
  serializeMarketingStatements,
} from "../models/marketing";
import {
  parseNotificationPreferences,
  parseOtherUrlsFromDb,
  parseResumeIncludes,
  serializeNotificationPreferences,
  serializeOtherUrls,
} from "../models/profile";
import type { UserRecord } from "../db/db-repository";
import { auth0 } from "./auth0";
import { userRepository } from "./repositories";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface AuthenticatedProfile {
  auth0SubjectId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface SyncCurrentUserOptions {
  phone?: string | null;
  linkedinUrl?: string | null;
  otherUrlsJson?: string | null;
  address?: string | null;
  resumeFieldIncludesJson?: string | null;
  notificationPreferencesJson?: string | null;
  timezone?: string | null;
  preferredName?: string | null;
  workAuthorization?: string | null;
  marketingStatementsJson?: string | null;
  jobPreferencesPatch?: {
    relocation?: Partial<RelocationPreferences> | null;
    officeType?: Partial<OfficeTypePreferences> | null;
    jobSearch?: Partial<JobSearchPreferences> | null;
  };
  educationJson?: string | null;
  workHistoryJson?: string | null;
}

function resolveOtherUrlsJson(
  options: SyncCurrentUserOptions | undefined,
  existing: UserRecord | null,
): string | null {
  if (options && "otherUrlsJson" in options) {
    return options.otherUrlsJson ?? null;
  }
  if (!existing?.other_urls) {
    return null;
  }
  return serializeOtherUrls(parseOtherUrlsFromDb(existing.other_urls));
}

function resolveResumeFieldIncludesJson(
  options: SyncCurrentUserOptions | undefined,
  existing: UserRecord | null,
): string | null {
  if (options && "resumeFieldIncludesJson" in options) {
    return options.resumeFieldIncludesJson ?? null;
  }
  const includes = parseResumeIncludes(existing?.resume_field_includes);
  return JSON.stringify(includes);
}

function resolveNotificationPreferencesJson(
  options: SyncCurrentUserOptions | undefined,
  existing: UserRecord | null,
): string | null {
  if (options && "notificationPreferencesJson" in options) {
    return options.notificationPreferencesJson ?? null;
  }
  const preferences = parseNotificationPreferences(
    existing?.notification_preferences,
  );
  return serializeNotificationPreferences(preferences);
}

function resolveMarketingStatementsJson(
  options: SyncCurrentUserOptions | undefined,
  existing: UserRecord | null,
): string | null {
  if (options && "marketingStatementsJson" in options) {
    return options.marketingStatementsJson ?? null;
  }
  const statements = parseMarketingStatements(existing?.marketing_statements);
  return serializeMarketingStatements(statements);
}

function resolveJobPreferencesJson(
  options: SyncCurrentUserOptions | undefined,
  existing: UserRecord | null,
): string | null {
  const current = parseJobPreferences(existing?.job_preferences);
  if (!options?.jobPreferencesPatch) {
    return serializeJobPreferences(current);
  }
  return serializeJobPreferences(
    mergeJobPreferences(current, options.jobPreferencesPatch),
  );
}

function resolveEducationJson(
  options: SyncCurrentUserOptions | undefined,
  existing: UserRecord | null,
): string | null {
  if (options && "educationJson" in options) {
    return options.educationJson ?? null;
  }
  const education = parseUserEducation(existing?.education);
  return serializeUserEducation(education);
}

function resolveWorkHistoryJson(
  options: SyncCurrentUserOptions | undefined,
  existing: UserRecord | null,
): string | null {
  if (options && "workHistoryJson" in options) {
    return options.workHistoryJson ?? null;
  }
  const workHistory = parseJobHistory(existing?.work_history);
  return serializeJobHistory(workHistory);
}

function resolveProfileValue<T>(
  options: SyncCurrentUserOptions | undefined,
  key: keyof SyncCurrentUserOptions,
  existingValue: T,
  fallback: T,
): T {
  if (options && key in options) {
    return (options[key] ?? fallback) as T;
  }
  return existingValue ?? fallback;
}

export async function requireAuthenticatedProfile(): Promise<AuthenticatedProfile> {
  const session = await auth0.getSession();
  const user = session?.user;
  if (!user) {
    throw new UnauthorizedError("Missing Auth0 session user.");
  }

  const auth0SubjectId = user?.sub?.trim();
  const email = user?.email?.trim().toLowerCase();
  const name = (user?.name || user?.nickname || "").trim();

  if (!auth0SubjectId || !email || !name) {
    throw new UnauthorizedError(
      "Missing required Auth0 session claims (sub, email, name).",
    );
  }

  return {
    auth0SubjectId,
    email,
    name,
    emailVerified: Boolean(user.email_verified),
  };
}

export async function getOrCreateCurrentUser(options?: SyncCurrentUserOptions) {
  const profile = await requireAuthenticatedProfile();
  const existing = await userRepository.findByAuth0Subject(profile.auth0SubjectId);

  const user = await userRepository.upsertByAuth0Subject({
    auth0SubjectId: profile.auth0SubjectId,
    email: profile.email,
    name: profile.name,
    emailVerified: profile.emailVerified,
    phone: resolveProfileValue(options, "phone", existing?.phone ?? null, null),
    linkedinUrl: resolveProfileValue(
      options,
      "linkedinUrl",
      existing?.linkedin_url ?? null,
      null,
    ),
    otherUrlsJson: resolveOtherUrlsJson(options, existing),
    address: resolveProfileValue(options, "address", existing?.address ?? null, null),
    resumeFieldIncludesJson: resolveResumeFieldIncludesJson(options, existing),
    notificationPreferencesJson: resolveNotificationPreferencesJson(
      options,
      existing,
    ),
    timezone: resolveProfileValue(
      options,
      "timezone",
      existing?.timezone ?? "UTC",
      "UTC",
    ),
    preferredName: resolveProfileValue(
      options,
      "preferredName",
      existing?.preferred_name ?? null,
      null,
    ),
    workAuthorization: resolveProfileValue(
      options,
      "workAuthorization",
      existing?.work_authorization ?? null,
      null,
    ),
    marketingStatementsJson: resolveMarketingStatementsJson(options, existing),
    jobPreferencesJson: resolveJobPreferencesJson(options, existing),
    educationJson: resolveEducationJson(options, existing),
    workHistoryJson: resolveWorkHistoryJson(options, existing),
  });

  if (!user) {
    throw new Error("Failed to resolve current user.");
  }

  return { profile, user };
}

export function buildOtherUrlsJsonFromEntries(
  entries: Parameters<typeof serializeOtherUrls>[0],
): string | null {
  return serializeOtherUrls(entries);
}
