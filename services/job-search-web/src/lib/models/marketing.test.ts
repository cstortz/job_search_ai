import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKETING_STATEMENTS,
  isMarketingStatementsEmpty,
  parseMarketingStatements,
  serializeMarketingStatements,
} from "./marketing";

describe("parseMarketingStatements", () => {
  it("returns defaults for null", () => {
    expect(parseMarketingStatements(null)).toEqual(DEFAULT_MARKETING_STATEMENTS);
  });

  it("parses JSONB string from database API", () => {
    expect(
      parseMarketingStatements(
        '{"headline":"Platform engineer","pitch":"I build reliable systems.","includeHeadlineInResume":false,"includePitchInResume":true}',
      ),
    ).toEqual({
      headline: "Platform engineer",
      pitch: "I build reliable systems.",
      includeHeadlineInResume: false,
      includePitchInResume: true,
    });
  });
});

describe("serializeMarketingStatements", () => {
  it("trims headline and pitch", () => {
    expect(
      serializeMarketingStatements({
        headline: "  Lead engineer  ",
        pitch: "  Pitch line.  ",
        includeHeadlineInResume: true,
        includePitchInResume: false,
      }),
    ).toBe(
      '{"headline":"Lead engineer","pitch":"Pitch line.","includeHeadlineInResume":true,"includePitchInResume":false}',
    );
  });
});

describe("isMarketingStatementsEmpty", () => {
  it("detects empty marketing copy", () => {
    expect(isMarketingStatementsEmpty(DEFAULT_MARKETING_STATEMENTS)).toBe(true);
    expect(
      isMarketingStatementsEmpty({
        ...DEFAULT_MARKETING_STATEMENTS,
        headline: "Headline",
      }),
    ).toBe(false);
  });
});
