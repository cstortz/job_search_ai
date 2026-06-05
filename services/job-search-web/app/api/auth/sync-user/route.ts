import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../../src/lib/db/db-repository";
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
}

function validateSyncUserBody(body: SyncUserRequestBody): string | null {
  const timezone = (body.timezone ?? "UTC").trim();
  if (!timezone) {
    return "Timezone is required.";
  }

  const otherUrls = normalizeOtherUrlEntries(body.otherUrls ?? []);
  for (const entry of otherUrls) {
    if (!entry.name.trim()) {
      return "Each other URL entry needs a non-empty name.";
    }
    if (!resolveLaunchUrl(entry.url)) {
      return `URL for "${entry.name}" must be a valid website address.`;
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
    const otherUrls = normalizeOtherUrlEntries(body.otherUrls ?? []);
    const resumeIncludes = parseResumeIncludes({
      ...DEFAULT_RESUME_INCLUDES,
      ...(body.resumeIncludes ?? {}),
    });
    const { user } = await getOrCreateCurrentUser({
      phone: body.phone?.trim() || null,
      linkedinUrl: body.linkedinUrl?.trim() || null,
      address: body.address ? serializeProfileAddress(body.address) : null,
      otherUrlsJson: buildOtherUrlsJsonFromEntries(otherUrls),
      resumeFieldIncludesJson: JSON.stringify(resumeIncludes),
      ...("notificationPreferences" in body
        ? {
            notificationPreferencesJson: serializeNotificationPreferences(
              parseNotificationPreferences(body.notificationPreferences ?? null),
            ),
          }
        : {}),
      timezone: (body.timezone ?? "UTC").trim(),
    });

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
