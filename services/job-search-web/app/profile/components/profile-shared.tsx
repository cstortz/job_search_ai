"use client";

import type { CSSProperties, ReactNode } from "react";

import type { ProfileResumeFieldKey, ProfileResumeIncludes } from "../../../src/lib/models/profile";
import { resolveLaunchUrl } from "../../../src/lib/validation/url";

export interface SaveFeedback {
  type: "success" | "error";
  message: string;
  savedAt?: string;
}

export function formatSavedTimestamp(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function SaveFeedbackBanner({ feedback }: { feedback: SaveFeedback }) {
  return (
    <div
      role={feedback.type === "success" ? "status" : "alert"}
      aria-live="polite"
      className={`status-banner status-banner--${feedback.type}`}
    >
      <span>{feedback.message}</span>
      {feedback.type === "success" ? (
        <span className="status-banner__detail">
          Saved at {formatSavedTimestamp(feedback.savedAt)}.
        </span>
      ) : null}
    </div>
  );
}

const launchButtonStyle: CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  borderColor: "#9ca3af",
  whiteSpace: "nowrap",
};

export function LaunchUrlButton({
  rawUrl,
  label,
  disabled = false,
}: {
  rawUrl: string | null | undefined;
  label: string;
  disabled?: boolean;
}) {
  const launchUrl = rawUrl ? resolveLaunchUrl(rawUrl) : null;
  if (!launchUrl) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      style={launchButtonStyle}
      aria-label={`Open ${label} in new tab`}
      title="Open in new tab"
      onClick={() => window.open(launchUrl, "_blank", "noopener,noreferrer")}
    >
      Open
    </button>
  );
}

export function FieldRow({
  label,
  includeKey,
  includes,
  onIncludeChange,
  children,
}: {
  label: string;
  includeKey: ProfileResumeFieldKey;
  includes: ProfileResumeIncludes;
  onIncludeChange: (key: ProfileResumeFieldKey, checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <div className="row space-between">
        <strong style={{ fontSize: "0.95rem" }}>{label}</strong>
        <label className="row" style={{ fontSize: "0.85rem", gap: "0.35rem" }}>
          <input
            type="checkbox"
            checked={includes[includeKey]}
            onChange={(event) => onIncludeChange(includeKey, event.target.checked)}
          />
          Include in resume
        </label>
      </div>
      {children}
    </div>
  );
}

export const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export function includeLabel(checked: boolean): string {
  return checked ? "Yes" : "No";
}
