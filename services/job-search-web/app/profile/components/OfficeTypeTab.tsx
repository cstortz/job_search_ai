"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  ApiRequestError,
  UserRecord,
  syncUser,
} from "../../../src/lib/api/auth-client";
import {
  parseJobPreferences,
  type OfficeTypePreferences,
} from "../../../src/lib/models/job-preferences";
import { SaveFeedback, SaveFeedbackBanner } from "./profile-shared";

function officeTypeFromUser(user: UserRecord): OfficeTypePreferences {
  return parseJobPreferences(user.job_preferences).officeType;
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: "0.35rem" }}>
      <strong>
        {label} ({value}%)
      </strong>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function OfficeTypeTab({
  user,
  onSaved,
}: {
  user: UserRecord;
  onSaved: (user: UserRecord) => void;
}) {
  const [form, setForm] = useState<OfficeTypePreferences>(() =>
    officeTypeFromUser(user),
  );
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    setForm(officeTypeFromUser(user));
  }, [user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      const result = await syncUser({
        jobPreferences: { officeType: form },
      });
      onSaved(result.user);
      setForm(officeTypeFromUser(result.user));
      setSaveFeedback({
        type: "success",
        message: "Office type preferences saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save office type preferences.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Weight how much you prefer each work arrangement. These scores rank jobs;
        lower matches still appear under the All jobs tab.
      </p>
      {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

      <WeightSlider
        label="Fully remote"
        value={form.remoteWeight}
        onChange={(remoteWeight) =>
          setForm((previous) => ({ ...previous, remoteWeight }))
        }
      />
      <WeightSlider
        label="Hybrid"
        value={form.hybridWeight}
        onChange={(hybridWeight) =>
          setForm((previous) => ({ ...previous, hybridWeight }))
        }
      />
      <WeightSlider
        label="Onsite"
        value={form.onsiteWeight}
        onChange={(onsiteWeight) =>
          setForm((previous) => ({ ...previous, onsiteWeight }))
        }
      />

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <strong>Max in-office days per week (hybrid)</strong>
        <input
          type="number"
          min={0}
          max={5}
          value={form.maxOfficeDaysPerWeek}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              maxOfficeDaysPerWeek: Number(event.target.value),
            }))
          }
        />
      </label>

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save office type"}
      </button>
    </form>
  );
}
