import { describe, expect, it } from "vitest";

import {
  DEFAULT_JOB_PREFERENCES,
  addTargetCity,
  addTargetRole,
  mergeJobPreferences,
  parseJobPreferences,
  removeStringEntry,
  serializeJobPreferences,
} from "./job-preferences";

describe("parseJobPreferences", () => {
  it("returns defaults for null", () => {
    expect(parseJobPreferences(null)).toEqual(DEFAULT_JOB_PREFERENCES);
  });

  it("parses JSONB string from database API", () => {
    const stored =
      '{"relocation":{"willingness":60,"targetCities":["Berlin","Austin"],"internationalRelocation":"open","remoteGeographicIntent":"international_ok"},"officeType":{"remoteWeight":90,"hybridWeight":40,"onsiteWeight":10,"maxOfficeDaysPerWeek":2},"jobSearch":{"targetRoles":["Staff Engineer"],"matchThresholdPercent":75}}';

    expect(parseJobPreferences(stored)).toEqual({
      relocation: {
        willingness: 60,
        targetCities: ["Berlin", "Austin"],
        internationalRelocation: "open",
        remoteGeographicIntent: "international_ok",
      },
      officeType: {
        remoteWeight: 90,
        hybridWeight: 40,
        onsiteWeight: 10,
        maxOfficeDaysPerWeek: 2,
      },
      jobSearch: {
        targetRoles: ["Staff Engineer"],
        matchThresholdPercent: 75,
      },
    });
  });

  it("clamps invalid percentages", () => {
    expect(
      parseJobPreferences({
        relocation: { willingness: 500 },
        jobSearch: { matchThresholdPercent: -10 },
      }).relocation.willingness,
    ).toBe(100);
    expect(
      parseJobPreferences({
        jobSearch: { matchThresholdPercent: -10 },
      }).jobSearch.matchThresholdPercent,
    ).toBe(0);
  });
});

describe("mergeJobPreferences", () => {
  it("merges one section without overwriting others", () => {
    const merged = mergeJobPreferences(DEFAULT_JOB_PREFERENCES, {
      jobSearch: { matchThresholdPercent: 55, targetRoles: ["Backend Engineer"] },
    });

    expect(merged.jobSearch.matchThresholdPercent).toBe(55);
    expect(merged.jobSearch.targetRoles).toEqual(["Backend Engineer"]);
    expect(merged.relocation).toEqual(DEFAULT_JOB_PREFERENCES.relocation);
  });
});

describe("target role and city helpers", () => {
  it("deduplicates roles case-insensitively", () => {
    expect(addTargetRole(["Engineer"], "engineer")).toEqual(["Engineer"]);
  });

  it("adds and removes cities", () => {
    const withCity = addTargetCity([], "  Austin  ");
    expect(withCity).toEqual(["Austin"]);
    expect(removeStringEntry(withCity, "austin")).toEqual([]);
  });
});

describe("serializeJobPreferences", () => {
  it("round-trips through parse", () => {
    const serialized = serializeJobPreferences(DEFAULT_JOB_PREFERENCES);
    expect(parseJobPreferences(serialized)).toEqual(DEFAULT_JOB_PREFERENCES);
  });
});
