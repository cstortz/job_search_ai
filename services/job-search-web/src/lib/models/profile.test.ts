import { describe, expect, it } from "vitest";

import {
  parseNotificationPreferences,
  parseOtherUrlsFromDb,
  parseResumeIncludes,
} from "./profile";

describe("parseOtherUrlsFromDb", () => {
  it("parses JSONB values returned as strings from the database API", () => {
    const stored =
      '[{"url":"https://github.com/a","name":"GitHub","includeInResume":true},{"url":"https://example.com","name":"Portfolio","includeInResume":false}]';

    expect(parseOtherUrlsFromDb(stored)).toEqual([
      {
        name: "GitHub",
        url: "https://github.com/a",
        includeInResume: true,
      },
      {
        name: "Portfolio",
        url: "https://example.com",
        includeInResume: false,
      },
    ]);
  });

  it("parses legacy object-shaped other_urls", () => {
    expect(
      parseOtherUrlsFromDb({
        GitHub: "https://github.com/a",
        Portfolio: "https://example.com",
      }),
    ).toEqual([
      {
        name: "GitHub",
        url: "https://github.com/a",
        includeInResume: true,
      },
      {
        name: "Portfolio",
        url: "https://example.com",
        includeInResume: true,
      },
    ]);
  });
});

describe("parseNotificationPreferences", () => {
  it("parses notification_preferences returned as a JSON string", () => {
    expect(
      parseNotificationPreferences('{"email":true,"sms":false,"push":false,"in_app":true}'),
    ).toEqual({
      email: true,
      sms: false,
      push: false,
      in_app: true,
    });
  });
});

describe("parseResumeIncludes", () => {
  it("parses resume_field_includes returned as a JSON string", () => {
    expect(
      parseResumeIncludes(
        '{"name":true,"email":true,"phone":false,"location":true,"streetAddress":false,"linkedinUrl":true,"timezone":false}',
      ),
    ).toEqual({
      name: true,
      email: true,
      phone: false,
      location: true,
      streetAddress: false,
      linkedinUrl: true,
      timezone: false,
      preferredName: true,
      workAuthorization: false,
    });
  });
});
