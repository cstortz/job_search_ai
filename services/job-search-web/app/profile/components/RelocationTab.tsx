"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  ApiRequestError,
  UserRecord,
  syncUser,
} from "../../../src/lib/api/auth-client";
import {
  INTERNATIONAL_RELOCATION_LABELS,
  REMOTE_GEOGRAPHIC_INTENT_LABELS,
  addTargetCity,
  parseJobPreferences,
  removeStringEntry,
  type InternationalRelocationPreference,
  type RemoteGeographicIntent,
  type RelocationPreferences,
} from "../../../src/lib/models/job-preferences";
import { SaveFeedback, SaveFeedbackBanner } from "./profile-shared";

function relocationFromUser(user: UserRecord): RelocationPreferences {
  return parseJobPreferences(user.job_preferences).relocation;
}

export default function RelocationTab({
  user,
  onSaved,
}: {
  user: UserRecord;
  onSaved: (user: UserRecord) => void;
}) {
  const [form, setForm] = useState<RelocationPreferences>(() =>
    relocationFromUser(user),
  );
  const [cityInput, setCityInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    setForm(relocationFromUser(user));
  }, [user]);

  function addCity() {
    const next = addTargetCity(form.targetCities, cityInput);
    if (next.length === form.targetCities.length) {
      return;
    }
    setForm((previous) => ({ ...previous, targetCities: next }));
    setCityInput("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      const result = await syncUser({
        jobPreferences: { relocation: form },
      });
      onSaved(result.user);
      setForm(relocationFromUser(result.user));
      setSaveFeedback({
        type: "success",
        message: "Relocation preferences saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save relocation preferences.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Relocation willingness blends home geography with target cities. Fully
        remote jobs are scored separately and are not penalized for employer
        location.
      </p>
      {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <strong>Relocation willingness ({form.willingness}%)</strong>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          0% = stay put · 50% = open to the right offer · 100% = actively want to
          move
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={form.willingness}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              willingness: Number(event.target.value),
            }))
          }
        />
      </label>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <strong>Target cities / regions (equal weight)</strong>
        <div className="row">
          <input
            value={cityInput}
            onChange={(event) => setCityInput(event.target.value)}
            placeholder="e.g. Berlin, Austin, Ontario"
            style={{ flex: 1 }}
          />
          <button type="button" onClick={addCity} disabled={saving}>
            Add
          </button>
        </div>
        {form.targetCities.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Add cities you would consider when relocation willingness is above
            zero.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {form.targetCities.map((city) => (
              <li key={city} className="row" style={{ marginBottom: "0.35rem" }}>
                <span style={{ flex: 1 }}>{city}</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      targetCities: removeStringEntry(previous.targetCities, city),
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
        <strong>International relocation</strong>
        <select
          value={form.internationalRelocation}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              internationalRelocation: event.target
                .value as InternationalRelocationPreference,
            }))
          }
        >
          {(
            Object.entries(INTERNATIONAL_RELOCATION_LABELS) as [
              InternationalRelocationPreference,
              string,
            ][]
          ).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <strong>Remote work geography</strong>
        <select
          value={form.remoteGeographicIntent}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              remoteGeographicIntent: event.target.value as RemoteGeographicIntent,
            }))
          }
        >
          {(
            Object.entries(REMOTE_GEOGRAPHIC_INTENT_LABELS) as [
              RemoteGeographicIntent,
              string,
            ][]
          ).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save relocation"}
      </button>
    </form>
  );
}
