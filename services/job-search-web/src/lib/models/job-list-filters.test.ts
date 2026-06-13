import { describe, expect, it } from "vitest";

import type { JobListingRecord } from "../api/job-client";
import {
  countJobListingsByTab,
  filterJobListingsByTab,
  isRemoteJobListing,
  isRelocationFriendlyListing,
} from "./job-list-filters";
import { DEFAULT_JOB_PREFERENCES } from "./job-preferences";

function listing(
  overrides: Partial<JobListingRecord> & Pick<JobListingRecord, "id">,
): JobListingRecord {
  return {
    user_id: "user-1",
    job_source_id: null,
    job_title: "Engineer",
    company_name: "Acme",
    job_description_text: null,
    requirements_text: null,
    application_url: null,
    job_url: "https://example.com/jobs/1",
    external_job_id: null,
    posting_date: null,
    salary_range: null,
    location: null,
    job_location_type: null,
    job_type: null,
    job_level: null,
    application_deadline: null,
    user_interest_level: null,
    user_tags: null,
    status: "active",
    first_seen_at: null,
    last_fetched_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    match_score: null,
    ...overrides,
  };
}

describe("isRemoteJobListing", () => {
  it("detects remote from job_location_type", () => {
    expect(
      isRemoteJobListing(listing({ id: "1", job_location_type: "remote" })),
    ).toBe(true);
  });

  it("detects remote from location text", () => {
    expect(
      isRemoteJobListing(listing({ id: "1", location: "Remote - US" })),
    ).toBe(true);
  });
});

describe("isRelocationFriendlyListing", () => {
  it("excludes remote jobs", () => {
    expect(
      isRelocationFriendlyListing(
        listing({ id: "1", job_location_type: "remote" }),
        DEFAULT_JOB_PREFERENCES.relocation,
      ),
    ).toBe(false);
  });

  it("includes onsite jobs in target cities", () => {
    expect(
      isRelocationFriendlyListing(
        listing({ id: "1", location: "Austin, TX", job_location_type: "onsite" }),
        {
          ...DEFAULT_JOB_PREFERENCES.relocation,
          targetCities: ["Austin"],
        },
      ),
    ).toBe(true);
  });

  it("includes non-remote jobs when willingness is high", () => {
    expect(
      isRelocationFriendlyListing(
        listing({ id: "1", location: "Chicago, IL", job_location_type: "hybrid" }),
        {
          ...DEFAULT_JOB_PREFERENCES.relocation,
          willingness: 60,
          targetCities: [],
        },
      ),
    ).toBe(true);
  });
});

describe("filterJobListingsByTab", () => {
  const listings = [
    listing({ id: "1", match_score: 85, job_location_type: "remote" }),
    listing({ id: "2", match_score: 60, location: "Austin, TX" }),
    listing({ id: "3", match_score: null, location: "Berlin, DE" }),
    listing({
      id: "4",
      match_score: 72,
      location: "Chicago, IL",
      job_location_type: "onsite",
    }),
  ];

  const preferences = {
    ...DEFAULT_JOB_PREFERENCES,
    jobSearch: { ...DEFAULT_JOB_PREFERENCES.jobSearch, matchThresholdPercent: 70 },
    relocation: {
      ...DEFAULT_JOB_PREFERENCES.relocation,
      willingness: 25,
      targetCities: ["Austin"],
    },
  };

  it("filters high matches by threshold and excludes unscored jobs", () => {
    expect(
      filterJobListingsByTab(listings, "high-matches", preferences).map(
        (entry) => entry.id,
      ),
    ).toEqual(["1", "4"]);
  });

  it("filters remote only", () => {
    expect(
      filterJobListingsByTab(listings, "remote", preferences).map(
        (entry) => entry.id,
      ),
    ).toEqual(["1"]);
  });

  it("filters relocation-friendly by city match", () => {
    expect(
      filterJobListingsByTab(listings, "relocation-friendly", preferences).map(
        (entry) => entry.id,
      ),
    ).toEqual(["2"]);
  });

  it("returns all listings for all tab", () => {
    expect(filterJobListingsByTab(listings, "all", preferences)).toHaveLength(4);
  });
});

describe("countJobListingsByTab", () => {
  it("returns counts for each tab", () => {
    const listings = [
      listing({ id: "1", match_score: 80, job_location_type: "remote" }),
      listing({ id: "2", match_score: 50, location: "Austin, TX" }),
    ];

    expect(countJobListingsByTab(listings, DEFAULT_JOB_PREFERENCES)).toEqual({
      "high-matches": 1,
      all: 2,
      remote: 1,
      "relocation-friendly": 0,
    });
  });
});
