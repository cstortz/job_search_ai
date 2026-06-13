"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  ApiRequestError,
  UserRecord,
  syncUser,
} from "../../../src/lib/api/auth-client";
import {
  addTargetRole,
  parseJobPreferences,
  removeStringEntry,
  type JobSearchPreferences,
} from "../../../src/lib/models/job-preferences";
import { SaveFeedback, SaveFeedbackBanner } from "./profile-shared";

function jobSearchFromUser(user: UserRecord): JobSearchPreferences {
  return parseJobPreferences(user.job_preferences).jobSearch;
}

export default function JobSearchTab({
  user,
  onSaved,
}: {
  user: UserRecord;
  onSaved: (user: UserRecord) => void;
}) {
  const [form, setForm] = useState<JobSearchPreferences>(() =>
    jobSearchFromUser(user),
  );
  const [roleInput, setRoleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    setForm(jobSearchFromUser(user));
  }, [user]);

  function addRole() {
    const next = addTargetRole(form.targetRoles, roleInput);
    if (next.length === form.targetRoles.length) {
      return;
    }
    setForm((previous) => ({ ...previous, targetRoles: next }));
    setRoleInput("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      const result = await syncUser({
        jobPreferences: { jobSearch: form },
      });
      onSaved(result.user);
      setForm(jobSearchFromUser(result.user));
      setSaveFeedback({
        type: "success",
        message: "Job search preferences saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save job search preferences.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Target roles feed job ranking and filtering. Typed roles are stored for
        future taxonomy cleanup. Use the match threshold to set your default High
        matches view on the jobs page.
      </p>
      {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <strong>Target roles</strong>
        <div className="row">
          <input
            value={roleInput}
            onChange={(event) => setRoleInput(event.target.value)}
            placeholder="e.g. Senior Software Engineer"
            style={{ flex: 1 }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addRole();
              }
            }}
          />
          <button type="button" onClick={addRole} disabled={saving}>
            Add
          </button>
        </div>
        {form.targetRoles.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Add roles you are actively targeting.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {form.targetRoles.map((role) => (
              <li key={role} className="row" style={{ marginBottom: "0.35rem" }}>
                <span style={{ flex: 1 }}>{role}</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      targetRoles: removeStringEntry(previous.targetRoles, role),
                    }))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <strong>Match threshold ({form.matchThresholdPercent}%)</strong>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          Jobs at or above this score appear in the default High matches tab.
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={form.matchThresholdPercent}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              matchThresholdPercent: Number(event.target.value),
            }))
          }
        />
      </label>

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save job search"}
      </button>
    </form>
  );
}
