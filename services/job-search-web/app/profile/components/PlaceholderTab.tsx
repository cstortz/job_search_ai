"use client";

import type { ProfileTabId } from "../../../src/lib/models/profile-tabs";
import { PROFILE_PLACEHOLDER_TAB_DESCRIPTIONS } from "../../../src/lib/models/profile-tabs";

export default function PlaceholderTab({ tabId }: { tabId: ProfileTabId }) {
  const description = PROFILE_PLACEHOLDER_TAB_DESCRIPTIONS[tabId];

  return (
    <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        {description ?? "This section is planned for a future update."}
      </p>
      <p style={{ margin: 0 }}>
        The fields for this tab are defined in the product spec and will be built
        in the next implementation slice.
      </p>
    </div>
  );
}
