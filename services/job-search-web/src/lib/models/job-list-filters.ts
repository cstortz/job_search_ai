import type { JobListingRecord } from "../api/job-client";
import {
  parseJobPreferences,
  type JobPreferences,
  type RelocationPreferences,
} from "./job-preferences";

export const JOB_LIST_TAB_IDS = [
  "high-matches",
  "all",
  "remote",
  "relocation-friendly",
] as const;

export type JobListTabId = (typeof JOB_LIST_TAB_IDS)[number];

export const JOB_LIST_TAB_LABELS: Record<JobListTabId, string> = {
  "high-matches": "High matches",
  all: "All",
  remote: "Remote only",
  "relocation-friendly": "Relocation-friendly",
};

export function isJobListTabId(value: string): value is JobListTabId {
  return (JOB_LIST_TAB_IDS as readonly string[]).includes(value);
}

export function matchThresholdFromPreferences(
  jobPreferences: JobPreferences | Record<string, unknown> | null | undefined,
): number {
  return parseJobPreferences(jobPreferences).jobSearch.matchThresholdPercent;
}

export function isRemoteJobListing(listing: JobListingRecord): boolean {
  const locationType = listing.job_location_type?.trim().toLowerCase();
  if (locationType === "remote") {
    return true;
  }

  const location = listing.location?.trim().toLowerCase() ?? "";
  return /\bremote\b/.test(location);
}

function locationMatchesTargetCity(
  location: string,
  targetCities: RelocationPreferences["targetCities"],
): boolean {
  const normalizedLocation = location.trim().toLowerCase();
  if (!normalizedLocation) {
    return false;
  }

  return targetCities.some((city) => {
    const normalizedCity = city.trim().toLowerCase();
    return normalizedCity.length > 0 && normalizedLocation.includes(normalizedCity);
  });
}

export function isRelocationFriendlyListing(
  listing: JobListingRecord,
  relocation: RelocationPreferences,
): boolean {
  if (isRemoteJobListing(listing)) {
    return false;
  }

  const location = listing.location ?? "";
  if (locationMatchesTargetCity(location, relocation.targetCities)) {
    return true;
  }

  return relocation.willingness >= 50;
}

export function filterJobListingsByTab(
  listings: JobListingRecord[],
  tab: JobListTabId,
  jobPreferences: JobPreferences | Record<string, unknown> | null | undefined,
): JobListingRecord[] {
  const preferences = parseJobPreferences(jobPreferences);

  switch (tab) {
    case "high-matches": {
      const threshold = preferences.jobSearch.matchThresholdPercent;
      return listings.filter(
        (listing) =>
          listing.match_score !== null &&
          listing.match_score !== undefined &&
          listing.match_score >= threshold,
      );
    }
    case "remote":
      return listings.filter((listing) => isRemoteJobListing(listing));
    case "relocation-friendly":
      return listings.filter((listing) =>
        isRelocationFriendlyListing(listing, preferences.relocation),
      );
    case "all":
    default:
      return listings;
  }
}

export function sortJobListingsForTab(
  listings: JobListingRecord[],
  tab: JobListTabId,
): JobListingRecord[] {
  const sorted = [...listings];

  if (tab === "high-matches") {
    sorted.sort((left, right) => {
      const leftScore = left.match_score ?? -1;
      const rightScore = right.match_score ?? -1;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return right.created_at.localeCompare(left.created_at);
    });
    return sorted;
  }

  sorted.sort((left, right) => right.created_at.localeCompare(left.created_at));
  return sorted;
}

export function countJobListingsByTab(
  listings: JobListingRecord[],
  jobPreferences: JobPreferences | Record<string, unknown> | null | undefined,
): Record<JobListTabId, number> {
  return {
    "high-matches": filterJobListingsByTab(
      listings,
      "high-matches",
      jobPreferences,
    ).length,
    all: listings.length,
    remote: filterJobListingsByTab(listings, "remote", jobPreferences).length,
    "relocation-friendly": filterJobListingsByTab(
      listings,
      "relocation-friendly",
      jobPreferences,
    ).length,
  };
}
