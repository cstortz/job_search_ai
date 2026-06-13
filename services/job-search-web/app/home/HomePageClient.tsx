"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import {
  ApiRequestError,
  UserRecord,
  getCurrentUser,
  syncUser,
} from "../../src/lib/api/auth-client";
import {
  DEFAULT_MARKETING_STATEMENTS,
  isMarketingStatementsEmpty,
  parseMarketingStatements,
  type MarketingStatements,
} from "../../src/lib/models/marketing";
import {
  SaveFeedback,
  SaveFeedbackBanner,
} from "../profile/components/profile-shared";

export default function HomePageClient() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [form, setForm] = useState<MarketingStatements>(DEFAULT_MARKETING_STATEMENTS);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await getCurrentUser();
        setUser(result.user);
        const statements = parseMarketingStatements(result.user.marketing_statements);
        setForm(statements);
        if (isMarketingStatementsEmpty(statements)) {
          setEditing(true);
        }
      } catch (caught) {
        setUser(null);
        if (caught instanceof ApiRequestError && caught.status === 401) {
          setLoadError(null);
        } else {
          setLoadError(
            caught instanceof ApiRequestError
              ? caught.message
              : "Failed to load your marketing message.",
          );
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const displayStatements = user
    ? parseMarketingStatements(user.marketing_statements)
    : form;
  const showEmptyPrompt =
    user !== null && !editing && isMarketingStatementsEmpty(displayStatements);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setSaving(true);
    setSaveFeedback(null);
    try {
      const result = await syncUser({
        marketingStatements: form,
      });
      setUser(result.user);
      setForm(parseMarketingStatements(result.user.marketing_statements));
      setEditing(false);
      setSaveFeedback({
        type: "success",
        message: "Marketing message saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save marketing message.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading...</p>;
  }

  if (!user) {
    return (
      <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Job Search AI</h1>
          <p className="muted">
            Sign in to set your personal marketing message and track matching jobs.
          </p>
          <Link href="/auth/login">Log in</Link>
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="card home-marketing">
        <div className="row space-between">
          <h1 style={{ marginTop: 0 }}>Your marketing message</h1>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : null}
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Keep your headline and pitch visible so you reinforce how you present
          yourself before every search and application.
        </p>

        {loadError ? (
          <p className="error" role="alert">
            {loadError}
          </p>
        ) : null}
        {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

        {showEmptyPrompt ? (
          <div className="status-banner status-banner--error" role="status">
            Add your headline and pitch — this is the message you want top of mind
            during your job search.
          </div>
        ) : null}

        {editing ? (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <div className="row space-between">
                <label htmlFor="marketing-headline">
                  <strong>Headline</strong>
                </label>
                <label className="row" style={{ fontSize: "0.85rem", gap: "0.35rem" }}>
                  <input
                    type="checkbox"
                    checked={form.includeHeadlineInResume}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        includeHeadlineInResume: event.target.checked,
                      }))
                    }
                  />
                  Include in resume
                </label>
              </div>
              <input
                id="marketing-headline"
                value={form.headline}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    headline: event.target.value,
                  }))
                }
                placeholder="e.g. Senior platform engineer who ships reliable systems"
                maxLength={160}
              />
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <div className="row space-between">
                <label htmlFor="marketing-pitch">
                  <strong>Pitch</strong>
                </label>
                <label className="row" style={{ fontSize: "0.85rem", gap: "0.35rem" }}>
                  <input
                    type="checkbox"
                    checked={form.includePitchInResume}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        includePitchInResume: event.target.checked,
                      }))
                    }
                  />
                  Include in resume
                </label>
              </div>
              <textarea
                id="marketing-pitch"
                value={form.pitch}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pitch: event.target.value,
                  }))
                }
                placeholder="2–4 sentences about what you offer and the problems you solve."
                rows={5}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>

            <div className="row" style={{ gap: "0.5rem" }}>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save message"}
              </button>
              {!isMarketingStatementsEmpty(displayStatements) ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setForm(displayStatements);
                    setEditing(false);
                    setSaveFeedback(null);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div>
              <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.35rem" }}>
                {displayStatements.headline.trim() || "No headline yet"}
              </h2>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                {displayStatements.pitch.trim() || "No pitch yet."}
              </p>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Resume includes: headline{" "}
              {displayStatements.includeHeadlineInResume ? "yes" : "no"}, pitch{" "}
              {displayStatements.includePitchInResume ? "yes" : "no"}
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Quick links</h2>
        <nav className="row" style={{ flexWrap: "wrap" }}>
          <Link href="/jobs">Jobs</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/skills">Skills</Link>
          <Link href="/job-sites">Job sites</Link>
        </nav>
      </div>
    </section>
  );
}
