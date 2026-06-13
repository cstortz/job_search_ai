import { describe, expect, it } from "vitest";

import { isProfileTabId, PROFILE_TAB_IDS } from "./profile-tabs";

describe("profile tabs", () => {
  it("recognizes valid tab ids", () => {
    expect(isProfileTabId("demographics")).toBe(true);
    expect(isProfileTabId("communications")).toBe(true);
    expect(isProfileTabId("invalid")).toBe(false);
  });

  it("defines seven profile tabs", () => {
    expect(PROFILE_TAB_IDS).toHaveLength(7);
  });
});
