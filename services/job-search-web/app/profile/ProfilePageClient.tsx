"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  ApiRequestError,
  UserRecord,
  getCurrentUser,
  syncUser,
} from "../../src/lib/api/auth-client";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_RESUME_INCLUDES,
  emptyProfileAddress,
  formatFullStreetAddress,
  formatNotificationPreferencesDisplay,
  formatResumeLocation,
  formatLinkedInDisplay,
  formatLinkedInProfileValue,
  LINKEDIN_IN_PATH_PREFIX,
  NOTIFICATION_PREFERENCE_LABELS,
  parseLinkedInHandle,
  parseNotificationPreferences,
  parseOtherUrlsFromDb,
  parseProfileAddress,
  parseResumeIncludes,
  type NotificationPreferenceKey,
  type NotificationPreferences,
  type ProfileAddress,
  type ProfileOtherUrl,
  type ProfileResumeFieldKey,
  type ProfileResumeIncludes,
} from "../../src/lib/models/profile";
import { resolveLaunchUrl } from "../../src/lib/validation/url";

interface OtherUrlEntry extends ProfileOtherUrl {
  id: string;
}

interface ProfileFormState {
  phone: string;
  linkedinHandle: string;
  timezone: string;
  address: ProfileAddress;
  otherUrlEntries: OtherUrlEntry[];
  resumeIncludes: ProfileResumeIncludes;
  notificationPreferences: NotificationPreferences;
}

const TIMEZONE_OPTIONS = [
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

function createEntryId(): string {
  return `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function entriesFromOtherUrls(otherUrls: unknown): OtherUrlEntry[] {
  return parseOtherUrlsFromDb(otherUrls).map((entry) => ({
    ...entry,
    id: createEntryId(),
  }));
}

function fromUser(user: UserRecord): ProfileFormState {
  return {
    phone: user.phone ?? "",
    linkedinHandle: parseLinkedInHandle(user.linkedin_url),
    timezone: user.timezone?.trim() || "UTC",
    address: parseProfileAddress(user.address),
    otherUrlEntries: entriesFromOtherUrls(user.other_urls),
    resumeIncludes: parseResumeIncludes(user.resume_field_includes),
    notificationPreferences: parseNotificationPreferences(
      user.notification_preferences,
    ),
  };
}

function includeLabel(checked: boolean): string {
  return checked ? "Yes" : "No";
}

function formatSavedTimestamp(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

interface SaveFeedback {
  type: "success" | "error";
  message: string;
  savedAt?: string;
}

function SaveFeedbackBanner({ feedback }: { feedback: SaveFeedback }) {
  return (
    <div
      role={feedback.type === "success" ? "status" : "alert"}
      aria-live="polite"
      className={`status-banner status-banner--${feedback.type}`}
    >
      <span>{feedback.message}</span>
      {feedback.type === "success" ? (
        <span className="status-banner__detail">
          Saved at {formatSavedTimestamp(feedback.savedAt)}. Your updated
          profile is shown in the review table below.
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

function LaunchUrlButton({
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

function FieldRow({
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

export default function ProfilePageClient() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    phone: "",
    linkedinHandle: "",
    timezone: "UTC",
    address: emptyProfileAddress(),
    otherUrlEntries: [],
    resumeIncludes: DEFAULT_RESUME_INCLUDES,
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [highlightSavedProfile, setHighlightSavedProfile] = useState(false);
  const savedProfileRef = useRef<HTMLDivElement>(null);

  async function loadProfile() {
    setLoading(true);
    setSaveFeedback(null);
    try {
      const result = await getCurrentUser();
      setUser(result.user);
      setForm(fromUser(result.user));
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to load profile.";
      setSaveFeedback({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  useEffect(() => {
    if (!justSaved) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setJustSaved(false);
    }, 3000);

    return () => window.clearTimeout(timerId);
  }, [justSaved]);

  function setResumeInclude(key: ProfileResumeFieldKey, checked: boolean) {
    setForm((previous) => ({
      ...previous,
      resumeIncludes: {
        ...previous.resumeIncludes,
        [key]: checked,
      },
    }));
  }

  function setNotificationPreference(
    key: NotificationPreferenceKey,
    checked: boolean,
  ) {
    setForm((previous) => ({
      ...previous,
      notificationPreferences: {
        ...previous.notificationPreferences,
        [key]: checked,
      },
    }));
  }

  function updateAddress(field: keyof ProfileAddress, value: string) {
    setForm((previous) => ({
      ...previous,
      address: {
        ...previous.address,
        [field]: value,
      },
    }));
  }

  function addOtherUrlEntry() {
    setForm((previous) => ({
      ...previous,
      otherUrlEntries: [
        ...previous.otherUrlEntries,
        {
          id: createEntryId(),
          name: "",
          url: "",
          includeInResume: true,
        },
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
    setJustSaved(false);
    setHighlightSavedProfile(false);

    const timezone = form.timezone.trim();
    if (!timezone) {
      setSaveFeedback({
        type: "error",
        message: "Timezone is required.",
      });
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
    setSaveFeedback(null);
    try {
      const result = await syncUser({
        phone: form.phone.trim() || null,
        linkedinUrl: linkedinUrl || null,
        address: form.address,
        otherUrls: form.otherUrlEntries.map(({ id: _id, ...entry }) => entry),
        resumeIncludes: form.resumeIncludes,
        notificationPreferences: form.notificationPreferences,
        timezone,
      });
      setUser(result.user);
      setForm(fromUser(result.user));
      setSaveFeedback({
        type: "success",
        message: "Profile saved successfully.",
        savedAt: result.user.updated_at,
      });
      setJustSaved(true);
      setHighlightSavedProfile(true);
      window.setTimeout(() => setHighlightSavedProfile(false), 2500);
      savedProfileRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to save profile.";
      setSaveFeedback({
        type: "error",
        message,
      });
    } finally {
      setSaving(false);
    }
  }

  const savedIncludes = useMemo(
    () => parseResumeIncludes(user?.resume_field_includes),
    [user],
  );
  const savedAddress = useMemo(
    () => parseProfileAddress(user?.address ?? null),
    [user],
  );
  const savedOtherUrls = useMemo(
    () => parseOtherUrlsFromDb(user?.other_urls),
    [user],
  );
  const savedNotificationPreferences = useMemo(
    () => parseNotificationPreferences(user?.notification_preferences),
    [user],
  );

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Profile</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Contact and location metadata for applications and resume generation.
          Toggle <em>Include in resume</em> per field to control what appears on
          generated resumes.
        </p>
        {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

        {loading ? (
          <p className="muted">Loading profile...</p>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
            <FieldRow
              label="Name (from Auth0)"
              includeKey="name"
              includes={form.resumeIncludes}
              onIncludeChange={setResumeInclude}
            >
              <input value={user?.name ?? ""} readOnly disabled />
            </FieldRow>

            <FieldRow
              label="Email (from Auth0)"
              includeKey="email"
              includes={form.resumeIncludes}
              onIncludeChange={setResumeInclude}
            >
              <input value={user?.email ?? ""} readOnly disabled />
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
                  setForm((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
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
                  onChange={(event) =>
                    updateAddress("streetLine2", event.target.value)
                  }
                  placeholder="Apt, suite, unit (optional)"
                />
                <div className="row">
                  <input
                    value={form.address.postalCode}
                    onChange={(event) =>
                      updateAddress("postalCode", event.target.value)
                    }
                    placeholder="Postal code"
                    style={{ flex: 1 }}
                  />
                  <input
                    value={form.address.country}
                    onChange={(event) =>
                      updateAddress("country", event.target.value)
                    }
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
                    style={{
                      flex: 1,
                      borderRadius: "0",
                      minWidth: 0,
                    }}
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
                  setForm((previous) => ({
                    ...previous,
                    timezone: event.target.value,
                  }))
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

            <div>
              <strong style={{ fontSize: "0.95rem" }}>Notification preferences</strong>
              <p className="muted" style={{ margin: "0.35rem 0 0.5rem 0", fontSize: "0.9rem" }}>
                Choose which channels can be used for job-search reminders and updates.
              </p>
              <div
                className="row"
                style={{ flexWrap: "wrap", gap: "0.75rem 1.25rem", alignItems: "flex-start" }}
              >
                {(Object.keys(NOTIFICATION_PREFERENCE_LABELS) as NotificationPreferenceKey[]).map(
                  (key) => (
                    <label
                      key={key}
                      className="row"
                      style={{ fontSize: "0.9rem", gap: "0.35rem" }}
                    >
                      <input
                        type="checkbox"
                        checked={form.notificationPreferences[key]}
                        onChange={(event) =>
                          setNotificationPreference(key, event.target.checked)
                        }
                      />
                      {NOTIFICATION_PREFERENCE_LABELS[key]}
                    </label>
                  ),
                )}
              </div>
            </div>

            <div>
              <div className="row space-between" style={{ marginBottom: "0.35rem" }}>
                <strong>Other URLs</strong>
                <button type="button" onClick={addOtherUrlEntry} disabled={saving}>
                  Add URL
                </button>
              </div>
              {form.otherUrlEntries.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No additional URLs yet. Add portfolio, GitHub, or personal site links.
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
                        <LaunchUrlButton
                          rawUrl={entry.url}
                          label={entry.name || "website"}
                          disabled={saving}
                        />
                        <button
                          type="button"
                          onClick={() => removeOtherUrlEntry(entry.id)}
                          disabled={saving}
                          aria-label={`Remove ${entry.name || "URL entry"}`}
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

            <div className="row">
              <button
                type="submit"
                disabled={saving}
                className={justSaved ? "save-button--saved" : undefined}
                aria-busy={saving}
              >
                {saving ? "Saving..." : justSaved ? "Saved" : "Save Profile"}
              </button>
              {saving ? (
                <span className="muted" aria-live="polite">
                  Saving profile...
                </span>
              ) : null}
            </div>
          </form>
        )}
      </div>

      <div
        ref={savedProfileRef}
        className={`card${highlightSavedProfile ? " card--saved-highlight" : ""}`}
      >
        <div className="row space-between" style={{ marginBottom: "0.75rem" }}>
          <div>
            <strong>Saved profile</strong>
            {user?.updated_at ? (
              <p className="muted" style={{ margin: "0.2rem 0 0 0", fontSize: "0.9rem" }}>
                Last saved: {formatSavedTimestamp(user.updated_at)}
              </p>
            ) : null}
          </div>
          <span className="muted">{user ? "1 record" : "0 records"}</span>
        </div>

        {loading ? (
          <p className="muted">Loading saved profile...</p>
        ) : !user ? (
          <p className="muted">No profile loaded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ fontSize: "1rem", color: "#111827" }}>Field</th>
                <th style={{ fontSize: "1rem", color: "#111827" }}>Value</th>
                <th style={{ fontSize: "1rem", color: "#111827" }}>Resume</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Name</td>
                <td>{user.name}</td>
                <td>{includeLabel(savedIncludes.name)}</td>
              </tr>
              <tr>
                <td>Email</td>
                <td>
                  {user.email}
                  {user.email_verified ? " (verified)" : " (unverified)"}
                </td>
                <td>{includeLabel(savedIncludes.email)}</td>
              </tr>
              <tr>
                <td>Phone</td>
                <td>{user.phone || "-"}</td>
                <td>{includeLabel(savedIncludes.phone)}</td>
              </tr>
              <tr>
                <td>Location</td>
                <td>{formatResumeLocation(savedAddress) || "-"}</td>
                <td>{includeLabel(savedIncludes.location)}</td>
              </tr>
              <tr>
                <td>Street address</td>
                <td style={{ whiteSpace: "pre-wrap" }}>
                  {formatFullStreetAddress(savedAddress) || "-"}
                </td>
                <td>{includeLabel(savedIncludes.streetAddress)}</td>
              </tr>
              <tr>
                <td>LinkedIn</td>
                <td>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    <span>{formatLinkedInDisplay(user.linkedin_url)}</span>
                    <LaunchUrlButton
                      rawUrl={
                        user.linkedin_url ||
                        formatLinkedInProfileValue(
                          parseLinkedInHandle(user.linkedin_url),
                        )
                      }
                      label="LinkedIn profile"
                    />
                  </div>
                </td>
                <td>{includeLabel(savedIncludes.linkedinUrl)}</td>
              </tr>
              <tr>
                <td>Timezone</td>
                <td>{user.timezone || "UTC"}</td>
                <td>{includeLabel(savedIncludes.timezone)}</td>
              </tr>
              <tr>
                <td>Notifications</td>
                <td>
                  {formatNotificationPreferencesDisplay(savedNotificationPreferences)}
                </td>
                <td>-</td>
              </tr>
              <tr>
                <td>Other URLs</td>
                <td>
                  {savedOtherUrls.length === 0 ? (
                    "-"
                  ) : (
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "1.1rem",
                        display: "grid",
                        gap: "0.35rem",
                      }}
                    >
                      {savedOtherUrls.map((entry) => (
                        <li key={`${entry.name}-${entry.url}`}>
                          <div className="row" style={{ flexWrap: "wrap" }}>
                            <span>
                              <strong>{entry.name}:</strong> {entry.url}
                            </span>
                            <LaunchUrlButton
                              rawUrl={entry.url}
                              label={entry.name || "website"}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  {savedOtherUrls.length === 0
                    ? "-"
                    : savedOtherUrls
                        .map((entry) => `${entry.name}: ${includeLabel(entry.includeInResume)}`)
                        .join("; ")}
                </td>
              </tr>
              <tr>
                <td>Updated</td>
                <td className="muted" colSpan={2}>
                  {user.updated_at || "-"}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
