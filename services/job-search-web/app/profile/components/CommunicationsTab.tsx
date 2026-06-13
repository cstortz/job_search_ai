"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  ApiRequestError,
  UserRecord,
  syncUser,
} from "../../../src/lib/api/auth-client";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_LABELS,
  parseNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "../../../src/lib/models/profile";
import { SaveFeedback, SaveFeedbackBanner } from "./profile-shared";

export default function CommunicationsTab({
  user,
  onSaved,
}: {
  user: UserRecord;
  onSaved: (user: UserRecord) => void;
}) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    parseNotificationPreferences(user.notification_preferences),
  );
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    setPreferences(parseNotificationPreferences(user.notification_preferences));
  }, [user]);

  function setPreference(key: NotificationPreferenceKey, checked: boolean) {
    setPreferences((previous) => ({ ...previous, [key]: checked }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveFeedback(null);
    setSaving(true);
    try {
      const result = await syncUser({
        notificationPreferences: preferences,
      });
      onSaved(result.user);
      setPreferences(parseNotificationPreferences(result.user.notification_preferences));
      setSaveFeedback({
        type: "success",
        message: "Notification preferences saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save notification preferences.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Choose how the app notifies you about job-search updates. These channels
        are for application alerts only — not shared with employers.
      </p>
      {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

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
                checked={preferences[key]}
                onChange={(event) => setPreference(key, event.target.checked)}
              />
              {NOTIFICATION_PREFERENCE_LABELS[key]}
            </label>
          ),
        )}
      </div>

      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Defaults when unset: email {DEFAULT_NOTIFICATION_PREFERENCES.email ? "on" : "off"},
        SMS {DEFAULT_NOTIFICATION_PREFERENCES.sms ? "on" : "off"}, push{" "}
        {DEFAULT_NOTIFICATION_PREFERENCES.push ? "on" : "off"}, in-app{" "}
        {DEFAULT_NOTIFICATION_PREFERENCES.in_app ? "on" : "off"}.
      </p>

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save communications"}
      </button>
    </form>
  );
}
