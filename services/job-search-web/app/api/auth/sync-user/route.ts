import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../../src/lib/db/db-repository";
import {
  type JobSearchPreferences,
  type OfficeTypePreferences,
  type RelocationPreferences,
} from "../../../../src/lib/models/job-preferences";
import {
  parseUserEducation,
  serializeUserEducation,
  type UserEducationProfile,
} from "../../../../src/lib/models/education";
import {
  parseJobHistory,
  serializeJobHistory,
  type JobHistoryEntry,
} from "../../../../src/lib/models/job-history";
import {
  parseMarketingStatements,
  serializeMarketingStatements,
  type MarketingStatements,
} from "../../../../src/lib/models/marketing";
import {
  DEFAULT_RESUME_INCLUDES,
  normalizeOtherUrlEntries,
  parseNotificationPreferences,
  parseResumeIncludes,
  serializeProfileAddress,
  type ProfileAddress,
  serializeNotificationPreferences,
  type NotificationPreferences,
  type ProfileOtherUrl,
  type ProfileResumeIncludes,
} from "../../../../src/lib/models/profile";
import {
  buildOtherUrlsJsonFromEntries,
  getOrCreateCurrentUser,
  UnauthorizedError,
} from "../../../../src/lib/server/current-user";
import { resolveLaunchUrl } from "../../../../src/lib/validation/url";

interface SyncUserRequestBody {
  phone?: string | null;
  linkedinUrl?: string | null;
  address?: ProfileAddress | null;
  otherUrls?: ProfileOtherUrl[] | null;
  resumeIncludes?: Partial<ProfileResumeIncludes> | null;
  notificationPreferences?: Partial<NotificationPreferences> | null;
  timezone?: string | null;
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
}

function validateSyncUserBody(body: SyncUserRequestBody): string | null {
  if ("timezone" in body) {
    const timezone = (body.timezone ?? "").trim();
    if (!timezone) {
      return "Timezone is required.";
    }
  }

  if ("otherUrls" in body) {
    const otherUrls = normalizeOtherUrlEntries(body.otherUrls ?? []);
    for (const entry of otherUrls) {
      if (!entry.name.trim()) {
        return "Each other URL entry needs a non-empty name.";
      }
      if (!resolveLaunchUrl(entry.url)) {
        return `URL for "${entry.name}" must be a valid website address.`;
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  let body: SyncUserRequestBody;
  try {
    body = (await request.json()) as SyncUserRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const validationError = validateSyncUserBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const otherUrls = "otherUrls" in body
      ? normalizeOtherUrlEntries(body.otherUrls ?? [])
      : [];
    const resumeIncludes = parseResumeIncludes({
      ...DEFAULT_RESUME_INCLUDES,
      ...(body.resumeIncludes ?? {}),
    });
    const syncOptions: Parameters<typeof getOrCreateCurrentUser>[0] = {};

    if ("timezone" in body) {
      syncOptions.timezone = (body.timezone ?? "UTC").trim();
    }

    if ("phone" in body) {
      syncOptions.phone = body.phone?.trim() || null;
    }
    if ("linkedinUrl" in body) {
      syncOptions.linkedinUrl = body.linkedinUrl?.trim() || null;
    }
    if ("address" in body) {
      syncOptions.address = body.address
        ? serializeProfileAddress(body.address)
        : null;
    }
    if ("otherUrls" in body) {
      syncOptions.otherUrlsJson = buildOtherUrlsJsonFromEntries(otherUrls);
    }
    if ("resumeIncludes" in body) {
      syncOptions.resumeFieldIncludesJson = JSON.stringify(resumeIncludes);
    }
    if ("notificationPreferences" in body) {
      syncOptions.notificationPreferencesJson = serializeNotificationPreferences(
        parseNotificationPreferences(body.notificationPreferences ?? null),
      );
    }
    if ("preferredName" in body) {
      syncOptions.preferredName = body.preferredName?.trim() || null;
    }
    if ("workAuthorization" in body) {
      syncOptions.workAuthorization = body.workAuthorization?.trim() || null;
    }
    if ("marketingStatements" in body) {
      syncOptions.marketingStatementsJson = serializeMarketingStatements(
        parseMarketingStatements({
          ...parseMarketingStatements(null),
          ...(body.marketingStatements ?? {}),
        }),
      );
    }
    if ("jobPreferences" in body && body.jobPreferences) {
      syncOptions.jobPreferencesPatch = body.jobPreferences;
    }
    if ("education" in body) {
      syncOptions.educationJson = serializeUserEducation(
        parseUserEducation(body.education ?? null),
      );
    }
    if ("workHistory" in body) {
      syncOptions.workHistoryJson = serializeJobHistory(
        parseJobHistory(body.workHistory ?? null),
      );
    }

    const { user } = await getOrCreateCurrentUser(syncOptions);

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (isPreparedClientError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 502 },
      );
    }

    return NextResponse.json({ error: "Failed to sync user." }, { status: 500 });
  }
}
