import { describe, expect, it } from "vitest";

import {
  parseJobHistory,
  serializeJobHistory,
} from "./job-history";

describe("parseJobHistory", () => {
  it("returns empty array for null", () => {
    expect(parseJobHistory(null)).toEqual([]);
  });

  it("parses JSONB string from database API", () => {
    const stored =
      '[{"id":"j1","employer":"Acme","title":"Engineer","location":"Remote","startDate":"2020-01","endDate":"2023-06","description":"Built APIs","skillIds":["skill-1","skill-2"],"includeInResume":true}]';

    expect(parseJobHistory(stored)).toEqual([
      {
        id: "j1",
        employer: "Acme",
        title: "Engineer",
        location: "Remote",
        startDate: "2020-01",
        endDate: "2023-06",
        description: "Built APIs",
        skillIds: ["skill-1", "skill-2"],
        includeInResume: true,
      },
    ]);
  });

  it("drops entries missing employer or title", () => {
    expect(
      parseJobHistory([
        { employer: "Acme" },
        { title: "Engineer" },
        { employer: "Beta", title: "Lead" },
      ]),
    ).toEqual([
      {
        id: "job-beta-lead",
        employer: "Beta",
        title: "Lead",
        location: "",
        startDate: "",
        endDate: "",
        description: "",
        skillIds: [],
        includeInResume: true,
      },
    ]);
  });

  it("defaults includeInResume to true", () => {
    const [entry] = parseJobHistory([{ employer: "Acme", title: "Engineer" }]);
    expect(entry?.includeInResume).toBe(true);
  });
});

describe("serializeJobHistory", () => {
  it("round-trips through parse", () => {
    const entries = [
      {
        id: "j1",
        employer: "Acme",
        title: "Engineer",
        location: "Remote",
        startDate: "2020-01",
        endDate: "",
        description: "",
        skillIds: ["skill-1"],
        includeInResume: false,
      },
    ];

    expect(parseJobHistory(serializeJobHistory(entries))).toEqual(entries);
  });
});
