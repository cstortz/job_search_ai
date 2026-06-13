import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_EDUCATION,
  parseUserEducation,
  serializeUserEducation,
} from "./education";

describe("parseUserEducation", () => {
  it("returns defaults for null", () => {
    expect(parseUserEducation(null)).toEqual(DEFAULT_USER_EDUCATION);
  });

  it("parses JSONB string from database API", () => {
    const stored =
      '{"degrees":[{"id":"d1","institution":"MIT","degree":"BS","field":"CS","startYear":"2010","endYear":"2014","includeInResume":true}],"certifications":[{"id":"c1","name":"AWS SA","issuer":"Amazon","issuedDate":"2020-01","expiryDate":"","url":"","includeInResume":false}],"postGradClasses":[{"id":"p1","courseName":"ML Systems","institution":"Stanford","completedDate":"2022-06","includeInResume":true}]}';

    expect(parseUserEducation(stored)).toEqual({
      degrees: [
        {
          id: "d1",
          institution: "MIT",
          degree: "BS",
          field: "CS",
          startYear: "2010",
          endYear: "2014",
          includeInResume: true,
        },
      ],
      certifications: [
        {
          id: "c1",
          name: "AWS SA",
          issuer: "Amazon",
          issuedDate: "2020-01",
          expiryDate: "",
          url: "",
          includeInResume: false,
        },
      ],
      postGradClasses: [
        {
          id: "p1",
          courseName: "ML Systems",
          institution: "Stanford",
          completedDate: "2022-06",
          includeInResume: true,
        },
      ],
    });
  });

  it("drops entries missing required fields", () => {
    expect(
      parseUserEducation({
        degrees: [{ institution: "MIT" }],
        certifications: [{ issuer: "Amazon" }],
        postGradClasses: [{ courseName: "ML" }],
      }),
    ).toEqual(DEFAULT_USER_EDUCATION);
  });

  it("generates stable ids when missing", () => {
    const parsed = parseUserEducation({
      degrees: [{ institution: "MIT", degree: "BS" }],
    });
    expect(parsed.degrees[0]?.id).toBe("degree-mit-bs");
  });
});

describe("serializeUserEducation", () => {
  it("round-trips through parse", () => {
    const value = {
      degrees: [
        {
          id: "d1",
          institution: "MIT",
          degree: "BS",
          field: "CS",
          startYear: "2010",
          endYear: "2014",
          includeInResume: true,
        },
      ],
      certifications: [],
      postGradClasses: [],
    };

    expect(parseUserEducation(serializeUserEducation(value))).toEqual(value);
  });
});
