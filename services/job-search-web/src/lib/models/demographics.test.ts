import { describe, expect, it } from "vitest";

import { formatWorkAuthorization } from "./demographics";

describe("formatWorkAuthorization", () => {
  it("maps known values to labels", () => {
    expect(formatWorkAuthorization("requires_sponsorship")).toBe(
      "Requires visa sponsorship",
    );
  });

  it("falls back for empty values", () => {
    expect(formatWorkAuthorization(null)).toBe("Not specified");
  });
});
