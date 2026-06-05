import { resolveLaunchUrl } from "../validation/url";

export interface ProfileAddress {
  street: string;
  streetLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type ProfileResumeFieldKey =
  | "name"
  | "email"
  | "phone"
  | "location"
  | "streetAddress"
  | "linkedinUrl"
  | "timezone";

export type ProfileResumeIncludes = Record<ProfileResumeFieldKey, boolean>;

export interface ProfileOtherUrl {
  name: string;
  url: string;
  includeInResume: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  in_app: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: false,
  push: true,
  in_app: true,
};

export const NOTIFICATION_PREFERENCE_LABELS: Record<
  NotificationPreferenceKey,
  string
> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  in_app: "In-app",
};

export const DEFAULT_RESUME_INCLUDES: ProfileResumeIncludes = {
  name: true,
  email: true,
  phone: true,
  location: true,
  streetAddress: false,
  linkedinUrl: true,
  timezone: false,
};

export function emptyProfileAddress(): ProfileAddress {
  return {
    street: "",
    streetLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  };
}

export function parseProfileAddress(value: string | null | undefined): ProfileAddress {
  if (!value?.trim()) {
    return emptyProfileAddress();
  }

  try {
    const parsed = JSON.parse(value) as Partial<ProfileAddress>;
    if (parsed && typeof parsed === "object") {
      return {
        street: parsed.street?.trim() ?? "",
        streetLine2: parsed.streetLine2?.trim() ?? "",
        city: parsed.city?.trim() ?? "",
        state: parsed.state?.trim() ?? "",
        postalCode: parsed.postalCode?.trim() ?? "",
        country: parsed.country?.trim() ?? "",
      };
    }
  } catch {
    // Legacy plain-text address — treat as city/state line when structured parts are empty.
  }

  const legacy = value.trim();
  const commaParts = legacy.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      ...emptyProfileAddress(),
      city: commaParts[0] ?? "",
      state: commaParts.slice(1).join(", "),
    };
  }

  return {
    ...emptyProfileAddress(),
    street: legacy,
  };
}

export function serializeProfileAddress(address: ProfileAddress): string | null {
  const normalized = {
    street: address.street.trim(),
    streetLine2: address.streetLine2.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim(),
  };

  if (
    !normalized.street &&
    !normalized.streetLine2 &&
    !normalized.city &&
    !normalized.state &&
    !normalized.postalCode &&
    !normalized.country
  ) {
    return null;
  }

  return JSON.stringify(normalized);
}

export function formatResumeLocation(address: ProfileAddress): string {
  const city = address.city.trim();
  const state = address.state.trim();
  if (city && state) {
    return `${city}, ${state}`;
  }
  return city || state || "";
}

export function formatFullStreetAddress(address: ProfileAddress): string {
  const lines = [
    address.street.trim(),
    address.streetLine2.trim(),
    [address.city.trim(), address.state.trim(), address.postalCode.trim()]
      .filter(Boolean)
      .join(", "),
    address.country.trim(),
  ].filter(Boolean);

  return lines.join("\n");
}

export function parseJsonbField(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function parseNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  const parsed = parseJsonbField(value) as Partial<NotificationPreferences> | null;

  return {
    email: parsed?.email ?? DEFAULT_NOTIFICATION_PREFERENCES.email,
    sms: parsed?.sms ?? DEFAULT_NOTIFICATION_PREFERENCES.sms,
    push: parsed?.push ?? DEFAULT_NOTIFICATION_PREFERENCES.push,
    in_app: parsed?.in_app ?? DEFAULT_NOTIFICATION_PREFERENCES.in_app,
  };
}

export function serializeNotificationPreferences(
  preferences: NotificationPreferences,
): string {
  return JSON.stringify({
    email: preferences.email,
    sms: preferences.sms,
    push: preferences.push,
    in_app: preferences.in_app,
  });
}

export function formatNotificationPreferencesDisplay(
  preferences: NotificationPreferences,
): string {
  const enabled = (Object.keys(NOTIFICATION_PREFERENCE_LABELS) as NotificationPreferenceKey[])
    .filter((key) => preferences[key])
    .map((key) => NOTIFICATION_PREFERENCE_LABELS[key]);

  return enabled.length > 0 ? enabled.join(", ") : "None enabled";
}

export function parseResumeIncludes(
  value: ProfileResumeIncludes | Record<string, boolean> | null | undefined,
): ProfileResumeIncludes {
  const parsed = parseJsonbField(value) as
    | ProfileResumeIncludes
    | Record<string, boolean>
    | null
    | undefined;

  return {
    name: parsed?.name ?? DEFAULT_RESUME_INCLUDES.name,
    email: parsed?.email ?? DEFAULT_RESUME_INCLUDES.email,
    phone: parsed?.phone ?? DEFAULT_RESUME_INCLUDES.phone,
    location: parsed?.location ?? DEFAULT_RESUME_INCLUDES.location,
    streetAddress: parsed?.streetAddress ?? DEFAULT_RESUME_INCLUDES.streetAddress,
    linkedinUrl: parsed?.linkedinUrl ?? DEFAULT_RESUME_INCLUDES.linkedinUrl,
    timezone: parsed?.timezone ?? DEFAULT_RESUME_INCLUDES.timezone,
  };
}

export function parseOtherUrlsFromDb(
  value: unknown,
): ProfileOtherUrl[] {
  const parsed = parseJsonbField(value);
  if (!parsed) {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const name = String(record.name ?? "").trim();
        const url = String(record.url ?? "").trim();
        if (!name || !url) {
          return null;
        }
        return {
          name,
          url,
          includeInResume: record.includeInResume !== false,
        };
      })
      .filter((entry): entry is ProfileOtherUrl => entry !== null);
  }

  if (typeof parsed === "object") {
    return Object.entries(parsed as Record<string, string>).map(([name, url]) => ({
      name: name.trim(),
      url: String(url).trim(),
      includeInResume: true,
    }));
  }

  return [];
}

export function serializeOtherUrls(entries: ProfileOtherUrl[]): string | null {
  const normalized = entries
    .map((entry) => ({
      name: entry.name.trim(),
      url: entry.url.trim(),
      includeInResume: entry.includeInResume,
    }))
    .filter((entry) => entry.name && entry.url);

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

export function normalizeOtherUrlEntries(entries: ProfileOtherUrl[]): ProfileOtherUrl[] {
  return entries
    .map((entry) => {
      const name = entry.name.trim();
      const rawUrl = entry.url.trim();
      const url = resolveLaunchUrl(rawUrl) ?? rawUrl;
      return {
        name,
        url,
        includeInResume: entry.includeInResume,
      };
    })
    .filter((entry) => entry.name && entry.url);
}

export const LINKEDIN_IN_PATH_PREFIX = "linkedin.com/in/";

export function parseLinkedInHandle(stored: string | null | undefined): string {
  const trimmed = (stored ?? "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    const match = url.pathname.match(/\/in\/([^/]+)/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // Fall through to pattern matching below.
  }

  const pathMatch = trimmed.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  if (!trimmed.includes("/") && !trimmed.includes(" ")) {
    return trimmed.replace(/^@/, "");
  }

  return trimmed;
}

export function formatLinkedInProfileValue(handle: string): string | null {
  const normalized = handle.trim().replace(/^@/, "").replace(/\/+$/, "");
  if (!normalized) {
    return null;
  }

  if (/linkedin\.com/i.test(normalized) || normalized.includes("://")) {
    return normalized;
  }

  return `https://www.linkedin.com/in/${normalized}`;
}

export function formatLinkedInDisplay(stored: string | null | undefined): string {
  const handle = parseLinkedInHandle(stored);
  if (!handle) {
    return "-";
  }
  if (handle === (stored ?? "").trim()) {
    return handle;
  }
  return `${LINKEDIN_IN_PATH_PREFIX}${handle}`;
}
