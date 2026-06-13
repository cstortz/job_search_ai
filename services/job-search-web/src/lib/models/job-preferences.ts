import { parseJsonbField } from "./profile";

export type InternationalRelocationPreference =
  | "not_interested"
  | "open"
  | "actively_seeking";

export type RemoteGeographicIntent =
  | "stay_in_country"
  | "international_ok"
  | "no_preference";

export interface RelocationPreferences {
  willingness: number;
  targetCities: string[];
  internationalRelocation: InternationalRelocationPreference;
  remoteGeographicIntent: RemoteGeographicIntent;
}

export interface OfficeTypePreferences {
  remoteWeight: number;
  hybridWeight: number;
  onsiteWeight: number;
  maxOfficeDaysPerWeek: number;
}

export interface JobSearchPreferences {
  targetRoles: string[];
  matchThresholdPercent: number;
}

export interface JobPreferences {
  relocation: RelocationPreferences;
  officeType: OfficeTypePreferences;
  jobSearch: JobSearchPreferences;
}

export const DEFAULT_RELOCATION_PREFERENCES: RelocationPreferences = {
  willingness: 25,
  targetCities: [],
  internationalRelocation: "open",
  remoteGeographicIntent: "no_preference",
};

export const DEFAULT_OFFICE_TYPE_PREFERENCES: OfficeTypePreferences = {
  remoteWeight: 80,
  hybridWeight: 50,
  onsiteWeight: 20,
  maxOfficeDaysPerWeek: 2,
};

export const DEFAULT_JOB_SEARCH_PREFERENCES: JobSearchPreferences = {
  targetRoles: [],
  matchThresholdPercent: 70,
};

export const DEFAULT_JOB_PREFERENCES: JobPreferences = {
  relocation: DEFAULT_RELOCATION_PREFERENCES,
  officeType: DEFAULT_OFFICE_TYPE_PREFERENCES,
  jobSearch: DEFAULT_JOB_SEARCH_PREFERENCES,
};

export const INTERNATIONAL_RELOCATION_LABELS: Record<
  InternationalRelocationPreference,
  string
> = {
  not_interested: "Not interested in international relocation",
  open: "Open to the right international offer",
  actively_seeking: "Actively seeking international relocation",
};

export const REMOTE_GEOGRAPHIC_INTENT_LABELS: Record<
  RemoteGeographicIntent,
  string
> = {
  stay_in_country: "Prefer remote work within my home country",
  international_ok: "Open to international remote employers",
  no_preference: "No geographic preference for remote work",
};

function clampPercent(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function clampOfficeDays(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(5, Math.max(0, Math.round(parsed)));
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    const trimmed = String(entry ?? "").trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

function parseInternationalRelocation(
  value: unknown,
): InternationalRelocationPreference {
  if (
    value === "not_interested" ||
    value === "open" ||
    value === "actively_seeking"
  ) {
    return value;
  }
  return DEFAULT_RELOCATION_PREFERENCES.internationalRelocation;
}

function parseRemoteGeographicIntent(value: unknown): RemoteGeographicIntent {
  if (
    value === "stay_in_country" ||
    value === "international_ok" ||
    value === "no_preference"
  ) {
    return value;
  }
  return DEFAULT_RELOCATION_PREFERENCES.remoteGeographicIntent;
}

export function parseRelocationPreferences(
  value: Partial<RelocationPreferences> | null | undefined,
): RelocationPreferences {
  const parsed = (value ?? {}) as Partial<RelocationPreferences>;
  return {
    willingness: clampPercent(
      parsed.willingness,
      DEFAULT_RELOCATION_PREFERENCES.willingness,
    ),
    targetCities: normalizeStringList(parsed.targetCities),
    internationalRelocation: parseInternationalRelocation(
      parsed.internationalRelocation,
    ),
    remoteGeographicIntent: parseRemoteGeographicIntent(
      parsed.remoteGeographicIntent,
    ),
  };
}

export function parseOfficeTypePreferences(
  value: Partial<OfficeTypePreferences> | null | undefined,
): OfficeTypePreferences {
  const parsed = (value ?? {}) as Partial<OfficeTypePreferences>;
  return {
    remoteWeight: clampPercent(
      parsed.remoteWeight,
      DEFAULT_OFFICE_TYPE_PREFERENCES.remoteWeight,
    ),
    hybridWeight: clampPercent(
      parsed.hybridWeight,
      DEFAULT_OFFICE_TYPE_PREFERENCES.hybridWeight,
    ),
    onsiteWeight: clampPercent(
      parsed.onsiteWeight,
      DEFAULT_OFFICE_TYPE_PREFERENCES.onsiteWeight,
    ),
    maxOfficeDaysPerWeek: clampOfficeDays(
      parsed.maxOfficeDaysPerWeek,
      DEFAULT_OFFICE_TYPE_PREFERENCES.maxOfficeDaysPerWeek,
    ),
  };
}

export function parseJobSearchPreferences(
  value: Partial<JobSearchPreferences> | null | undefined,
): JobSearchPreferences {
  const parsed = (value ?? {}) as Partial<JobSearchPreferences>;
  return {
    targetRoles: normalizeStringList(parsed.targetRoles),
    matchThresholdPercent: clampPercent(
      parsed.matchThresholdPercent,
      DEFAULT_JOB_SEARCH_PREFERENCES.matchThresholdPercent,
    ),
  };
}

export function parseJobPreferences(value: unknown): JobPreferences {
  const parsed = parseJsonbField(value) as Partial<JobPreferences> | null;

  return {
    relocation: parseRelocationPreferences(parsed?.relocation),
    officeType: parseOfficeTypePreferences(parsed?.officeType),
    jobSearch: parseJobSearchPreferences(parsed?.jobSearch),
  };
}

export function serializeJobPreferences(value: JobPreferences): string {
  return JSON.stringify({
    relocation: parseRelocationPreferences(value.relocation),
    officeType: parseOfficeTypePreferences(value.officeType),
    jobSearch: parseJobSearchPreferences(value.jobSearch),
  });
}

export function mergeJobPreferences(
  existing: JobPreferences,
  patch: {
    relocation?: Partial<RelocationPreferences> | null;
    officeType?: Partial<OfficeTypePreferences> | null;
    jobSearch?: Partial<JobSearchPreferences> | null;
  },
): JobPreferences {
  return {
    relocation: patch.relocation
      ? parseRelocationPreferences({ ...existing.relocation, ...patch.relocation })
      : existing.relocation,
    officeType: patch.officeType
      ? parseOfficeTypePreferences({ ...existing.officeType, ...patch.officeType })
      : existing.officeType,
    jobSearch: patch.jobSearch
      ? parseJobSearchPreferences({ ...existing.jobSearch, ...patch.jobSearch })
      : existing.jobSearch,
  };
}

export function addTargetRole(
  roles: string[],
  rawRole: string,
): string[] {
  return normalizeStringList([...roles, rawRole]);
}

export function addTargetCity(
  cities: string[],
  rawCity: string,
): string[] {
  return normalizeStringList([...cities, rawCity]);
}

export function removeStringEntry(values: string[], entry: string): string[] {
  const target = entry.trim().toLowerCase();
  return values.filter((value) => value.trim().toLowerCase() !== target);
}
