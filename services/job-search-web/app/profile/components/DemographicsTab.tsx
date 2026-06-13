"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  ApiRequestError,
  UserRecord,
  syncUser,
} from "../../../src/lib/api/auth-client";
import { WORK_AUTHORIZATION_OPTIONS } from "../../../src/lib/models/demographics";
import {
  DEFAULT_RESUME_INCLUDES,
  emptyProfileAddress,
  formatLinkedInProfileValue,
  LINKEDIN_IN_PATH_PREFIX,
  parseLinkedInHandle,
  parseOtherUrlsFromDb,
  parseProfileAddress,
  parseResumeIncludes,
  type ProfileAddress,
  type ProfileOtherUrl,
  type ProfileResumeFieldKey,
  type ProfileResumeIncludes,
} from "../../../src/lib/models/profile";
import { resolveLaunchUrl } from "../../../src/lib/validation/url";
import {
  FieldRow,
  LaunchUrlButton,
  SaveFeedback,
  SaveFeedbackBanner,
  TIMEZONE_OPTIONS,
} from "./profile-shared";

interface OtherUrlEntry extends ProfileOtherUrl {
  id: string;
}

interface DemographicsFormState {
  preferredName: string;
  phone: string;
  linkedinHandle: string;
  timezone: string;
  workAuthorization: string;
  address: ProfileAddress;
  otherUrlEntries: OtherUrlEntry[];
  resumeIncludes: ProfileResumeIncludes;
}

function createEntryId(): string {
  return `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fromUser(user: UserRecord): DemographicsFormState {
  return {
    preferredName: user.preferred_name ?? "",
    phone: user.phone ?? "",
    linkedinHandle: parseLinkedInHandle(user.linkedin_url),
    timezone: user.timezone?.trim() || "UTC",
    workAuthorization: user.work_authorization?.trim() ?? "",
    address: parseProfileAddress(user.address),
    otherUrlEntries: parseOtherUrlsFromDb(user.other_urls).map((entry) => ({
      ...entry,
      id: createEntryId(),
    })),
    resumeIncludes: parseResumeIncludes(user.resume_field_includes),
  };
}

export default function DemographicsTab({
  user,
  onSaved,
}: {
  user: UserRecord;
  onSaved: (user: UserRecord) => void;
}) {
  const [form, setForm] = useState<DemographicsFormState>(() => fromUser(user));
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    setForm(fromUser(user));
  }, [user]);

  function setResumeInclude(key: ProfileResumeFieldKey, checked: boolean) {
    setForm((previous) => ({
      ...previous,
      resumeIncludes: { ...previous.resumeIncludes, [key]: checked },
    }));
  }

  function updateAddress(field: keyof ProfileAddress, value: string) {
    setForm((previous) => ({
      ...previous,
      address: { ...previous.address, [field]: value },
    }));
  }

  function addOtherUrlEntry() {
    setForm((previous) => ({
      ...previous,
      otherUrlEntries: [
        ...previous.otherUrlEntries,
        { id: createEntryId(), name: "", url: "", includeInResume: true },
      ],
    }));
  }

  function removeOtherUrlEntry(id: string) {
    setForm((previous) => ({
      ...previous,
      otherUrlEntries: previous.otherUrlEntries.filter((entry) => entry.id !== id),
    }));
  }

  function updateOtherUrlEntry(
    id: string,
    field: keyof ProfileOtherUrl,
    value: string | boolean,
  ) {
    setForm((previous) => ({
      ...previous,
      otherUrlEntries: previous.otherUrlEntries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveFeedback(null);

    const timezone = form.timezone.trim();
    if (!timezone) {
      setSaveFeedback({ type: "error", message: "Timezone is required." });
      return;
    }

    const linkedinUrl = formatLinkedInProfileValue(form.linkedinHandle);
    for (const entry of form.otherUrlEntries) {
      const name = entry.name.trim();
      const url = entry.url.trim();
      if ((name && !url) || (!name && url)) {
        setSaveFeedback({
          type: "error",
          message: "Each other URL entry needs both a name and a URL.",
        });
        return;
      }
      if (url && !resolveLaunchUrl(url)) {
        setSaveFeedback({
          type: "error",
          message: `URL for "${name || "unnamed"}" must be a valid website address.`,
        });
        return;
      }
    }

    setSaving(true);
    try {
      const result = await syncUser({
        preferredName: form.preferredName.trim() || null,
        phone: form.phone.trim() || null,
        linkedinUrl: linkedinUrl || null,
        address: form.address,
        otherUrls: form.otherUrlEntries.map(({ id: _id, ...entry }) => entry),
        resumeIncludes: form.resumeIncludes,
        workAuthorization: form.workAuthorization.trim() || null,
        timezone,
      });
      onSaved(result.user);
      setForm(fromUser(result.user));
      setSaveFeedback({
        type: "success",
        message: "Demographics saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save demographics.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Identity and display fields for your profile and resume. Notification
        settings live under the Communications tab.
      </p>
      {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

      <FieldRow
        label="Legal name (from Auth0)"
        includeKey="name"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <input value={user.name} readOnly disabled />
      </FieldRow>

      <FieldRow
        label="Preferred / display name"
        includeKey="preferredName"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <input
          value={form.preferredName}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              preferredName: event.target.value,
            }))
          }
          placeholder="Name shown on resume (optional)"
        />
      </FieldRow>

      <FieldRow
        label="Email (from Auth0)"
        includeKey="email"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <input value={user.email} readOnly disabled />
      </FieldRow>

      <FieldRow
        label="Phone"
        includeKey="phone"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <input
          value={form.phone}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, phone: event.target.value }))
          }
          placeholder="Phone (optional)"
          inputMode="tel"
        />
      </FieldRow>

      <FieldRow
        label="Location (city, state — resume header line)"
        includeKey="location"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <div className="row">
          <input
            value={form.address.city}
            onChange={(event) => updateAddress("city", event.target.value)}
            placeholder="City"
            style={{ flex: 2 }}
          />
          <input
            value={form.address.state}
            onChange={(event) => updateAddress("state", event.target.value)}
            placeholder="State / Province"
            style={{ flex: 1 }}
          />
        </div>
      </FieldRow>

      <FieldRow
        label="Street address"
        includeKey="streetAddress"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <input
            value={form.address.street}
            onChange={(event) => updateAddress("street", event.target.value)}
            placeholder="Street address"
          />
          <input
            value={form.address.streetLine2}
            onChange={(event) => updateAddress("streetLine2", event.target.value)}
            placeholder="Apt, suite, unit (optional)"
          />
          <div className="row">
            <input
              value={form.address.postalCode}
              onChange={(event) => updateAddress("postalCode", event.target.value)}
              placeholder="Postal code"
              style={{ flex: 1 }}
            />
            <input
              value={form.address.country}
              onChange={(event) => updateAddress("country", event.target.value)}
              placeholder="Country"
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </FieldRow>

      <FieldRow
        label="LinkedIn profile"
        includeKey="linkedinUrl"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <div className="row" style={{ width: "100%" }}>
          <div
            className="row"
            style={{ alignItems: "stretch", flex: 1, minWidth: 0 }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.5rem 0.65rem",
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRight: "none",
                borderRadius: "6px 0 0 6px",
                whiteSpace: "nowrap",
                fontSize: "0.95rem",
                color: "#374151",
              }}
            >
              {LINKEDIN_IN_PATH_PREFIX}
            </span>
            <input
              type="text"
              value={form.linkedinHandle}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  linkedinHandle: event.target.value,
                }))
              }
              placeholder="your-handle"
              aria-label="LinkedIn profile handle"
              style={{ flex: 1, borderRadius: "0", minWidth: 0 }}
            />
          </div>
          <LaunchUrlButton
            rawUrl={formatLinkedInProfileValue(form.linkedinHandle)}
            label="LinkedIn profile"
            disabled={saving}
          />
        </div>
      </FieldRow>

      <FieldRow
        label="Timezone"
        includeKey="timezone"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <select
          value={form.timezone}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, timezone: event.target.value }))
          }
          required
          style={{ width: "100%" }}
        >
          {TIMEZONE_OPTIONS.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </FieldRow>

      <FieldRow
        label="Work authorization (matching only)"
        includeKey="workAuthorization"
        includes={form.resumeIncludes}
        onIncludeChange={setResumeInclude}
      >
        <select
          value={form.workAuthorization}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              workAuthorization: event.target.value,
            }))
          }
          style={{ width: "100%" }}
        >
          {WORK_AUTHORIZATION_OPTIONS.map((option) => (
            <option key={option.value || "unset"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldRow>

      <div>
        <div className="row space-between" style={{ marginBottom: "0.35rem" }}>
          <strong>Other URLs</strong>
          <button type="button" onClick={addOtherUrlEntry} disabled={saving}>
            Add URL
          </button>
        </div>
        {form.otherUrlEntries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Add portfolio, GitHub, or personal site links.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {form.otherUrlEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "grid",
                  gap: "0.35rem",
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "0.5rem",
                }}
              >
                <div className="row">
                  <input
                    value={entry.name}
                    onChange={(event) =>
                      updateOtherUrlEntry(entry.id, "name", event.target.value)
                    }
                    placeholder="Label (e.g. GitHub)"
                    style={{ flex: 1 }}
                  />
                  <input
                    value={entry.url}
                    onChange={(event) =>
                      updateOtherUrlEntry(entry.id, "url", event.target.value)
                    }
                    placeholder="https://..."
                    style={{ flex: 2 }}
                  />
                  <LaunchUrlButton rawUrl={entry.url} label={entry.name} disabled={saving} />
                  <button
                    type="button"
                    onClick={() => removeOtherUrlEntry(entry.id)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
                <label className="row" style={{ fontSize: "0.85rem", gap: "0.35rem" }}>
                  <input
                    type="checkbox"
                    checked={entry.includeInResume}
                    onChange={(event) =>
                      updateOtherUrlEntry(
                        entry.id,
                        "includeInResume",
                        event.target.checked,
                      )
                    }
                  />
                  Include in resume
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save demographics"}
      </button>
    </form>
  );
}
