"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, type ReactNode } from "react";

import {
  ApiRequestError,
  UserRecord,
  syncUser,
} from "../../../src/lib/api/auth-client";
import {
  ApiRequestError as SkillsApiRequestError,
  listSkills,
  type SkillRecord,
} from "../../../src/lib/api/skills-client";
import {
  createEmptyJobHistoryEntry,
  parseJobHistory,
  type JobHistoryEntry,
} from "../../../src/lib/models/job-history";
import { includeLabel, SaveFeedback, SaveFeedbackBanner } from "./profile-shared";

function workHistoryFromUser(user: UserRecord): JobHistoryEntry[] {
  return parseJobHistory(user.work_history);
}

function EntryCard({
  title,
  onRemove,
  disabled,
  children,
}: {
  title: string;
  onRemove: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "0.85rem",
        display: "grid",
        gap: "0.65rem",
        background: "#f9fafb",
      }}
    >
      <div className="row space-between">
        <strong>{title}</strong>
        <button type="button" disabled={disabled} onClick={onRemove}>
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}

export default function JobHistoryTab({
  user,
  onSaved,
}: {
  user: UserRecord;
  onSaved: (user: UserRecord) => void;
}) {
  const [entries, setEntries] = useState<JobHistoryEntry[]>(() =>
    workHistoryFromUser(user),
  );
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    setEntries(workHistoryFromUser(user));
  }, [user]);

  useEffect(() => {
    async function loadSkills() {
      setSkillsLoading(true);
      setSkillsError(null);
      try {
        const result = await listSkills();
        setSkills(result.skills);
      } catch (caught) {
        const message =
          caught instanceof SkillsApiRequestError
            ? caught.message
            : "Failed to load skills.";
        setSkillsError(message);
      } finally {
        setSkillsLoading(false);
      }
    }

    void loadSkills();
  }, []);

  function updateEntry(id: string, patch: Partial<JobHistoryEntry>) {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function toggleSkill(entryId: string, skillId: string, checked: boolean) {
    setEntries((previous) =>
      previous.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }
        const skillIds = checked
          ? [...entry.skillIds, skillId]
          : entry.skillIds.filter((id) => id !== skillId);
        return { ...entry, skillIds };
      }),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      const result = await syncUser({ workHistory: entries });
      onSaved(result.user);
      setEntries(workHistoryFromUser(result.user));
      setSaveFeedback({
        type: "success",
        message: "Job history saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save job history.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Employment timeline linked to your{" "}
        <Link href="/skills">skills library</Link>. Select skills used in each
        role for resume generation and job matching.
      </p>
      {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

      <div className="row space-between">
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Roles</h2>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            setEntries((previous) => [
              ...previous,
              createEmptyJobHistoryEntry(),
            ])
          }
        >
          Add role
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No employment entries yet.
        </p>
      ) : (
        entries.map((entry, index) => (
          <EntryCard
            key={entry.id}
            title={`Role ${index + 1}`}
            disabled={saving}
            onRemove={() =>
              setEntries((previous) =>
                previous.filter((item) => item.id !== entry.id),
              )
            }
          >
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Employer
              <input
                value={entry.employer}
                onChange={(event) =>
                  updateEntry(entry.id, { employer: event.target.value })
                }
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Title
              <input
                value={entry.title}
                onChange={(event) =>
                  updateEntry(entry.id, { title: event.target.value })
                }
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Location
              <input
                value={entry.location}
                onChange={(event) =>
                  updateEntry(entry.id, { location: event.target.value })
                }
              />
            </label>
            <div className="row" style={{ gap: "0.65rem" }}>
              <label style={{ display: "grid", gap: "0.25rem", flex: 1 }}>
                Start date
                <input
                  value={entry.startDate}
                  placeholder="YYYY-MM"
                  onChange={(event) =>
                    updateEntry(entry.id, { startDate: event.target.value })
                  }
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem", flex: 1 }}>
                End date
                <input
                  value={entry.endDate}
                  placeholder="YYYY-MM or Present"
                  onChange={(event) =>
                    updateEntry(entry.id, { endDate: event.target.value })
                  }
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Description
              <textarea
                rows={3}
                value={entry.description}
                onChange={(event) =>
                  updateEntry(entry.id, { description: event.target.value })
                }
              />
            </label>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <strong style={{ fontSize: "0.95rem" }}>Linked skills</strong>
              {skillsLoading ? (
                <p className="muted" style={{ margin: 0 }}>
                  Loading skills…
                </p>
              ) : skillsError ? (
                <p className="error" style={{ margin: 0 }}>
                  {skillsError}
                </p>
              ) : skills.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No skills yet.{" "}
                  <Link href="/skills">Add skills</Link> to link them here.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "0.35rem",
                    maxHeight: "10rem",
                    overflowY: "auto",
                    padding: "0.5rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.35rem",
                  }}
                >
                  {skills.map((skill) => (
                    <label
                      key={skill.id}
                      className="row"
                      style={{ gap: "0.35rem", fontSize: "0.9rem" }}
                    >
                      <input
                        type="checkbox"
                        checked={entry.skillIds.includes(skill.id)}
                        onChange={(event) =>
                          toggleSkill(entry.id, skill.id, event.target.checked)
                        }
                      />
                      <span>
                        {skill.skill_name}
                        {skill.skill_category
                          ? ` (${skill.skill_category})`
                          : ""}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="row" style={{ gap: "0.35rem" }}>
              <input
                type="checkbox"
                checked={entry.includeInResume}
                onChange={(event) =>
                  updateEntry(entry.id, {
                    includeInResume: event.target.checked,
                  })
                }
              />
              Include in resume ({includeLabel(entry.includeInResume)})
            </label>
          </EntryCard>
        ))
      )}

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save job history"}
      </button>
    </form>
  );
}
