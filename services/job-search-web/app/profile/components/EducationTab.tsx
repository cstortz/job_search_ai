"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";

import {
  ApiRequestError,
  UserRecord,
  syncUser,
} from "../../../src/lib/api/auth-client";
import {
  createEmptyCertification,
  createEmptyDegree,
  createEmptyPostGradClass,
  parseUserEducation,
  type CertificationEntry,
  type EducationDegree,
  type PostGradClassEntry,
  type UserEducationProfile,
} from "../../../src/lib/models/education";
import { includeLabel, SaveFeedback, SaveFeedbackBanner } from "./profile-shared";

function educationFromUser(user: UserRecord): UserEducationProfile {
  return parseUserEducation(user.education);
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

export default function EducationTab({
  user,
  onSaved,
}: {
  user: UserRecord;
  onSaved: (user: UserRecord) => void;
}) {
  const [form, setForm] = useState<UserEducationProfile>(() =>
    educationFromUser(user),
  );
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    setForm(educationFromUser(user));
  }, [user]);

  function updateDegree(id: string, patch: Partial<EducationDegree>) {
    setForm((previous) => ({
      ...previous,
      degrees: previous.degrees.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function updateCertification(id: string, patch: Partial<CertificationEntry>) {
    setForm((previous) => ({
      ...previous,
      certifications: previous.certifications.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function updatePostGradClass(id: string, patch: Partial<PostGradClassEntry>) {
    setForm((previous) => ({
      ...previous,
      postGradClasses: previous.postGradClasses.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      const result = await syncUser({ education: form });
      onSaved(result.user);
      setForm(educationFromUser(result.user));
      setSaveFeedback({
        type: "success",
        message: "Education saved.",
        savedAt: result.user.updated_at,
      });
    } catch (caught) {
      setSaveFeedback({
        type: "error",
        message:
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to save education.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Degrees, certifications, and post-graduate classes. Toggle resume
        inclusion per entry.
      </p>
      {saveFeedback ? <SaveFeedbackBanner feedback={saveFeedback} /> : null}

      <section style={{ display: "grid", gap: "0.65rem" }}>
        <div className="row space-between">
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Degrees</h2>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setForm((previous) => ({
                ...previous,
                degrees: [...previous.degrees, createEmptyDegree()],
              }))
            }
          >
            Add degree
          </button>
        </div>
        {form.degrees.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No degrees yet.
          </p>
        ) : (
          form.degrees.map((degree, index) => (
            <EntryCard
              key={degree.id}
              title={`Degree ${index + 1}`}
              disabled={saving}
              onRemove={() =>
                setForm((previous) => ({
                  ...previous,
                  degrees: previous.degrees.filter((entry) => entry.id !== degree.id),
                }))
              }
            >
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Institution
                <input
                  value={degree.institution}
                  onChange={(event) =>
                    updateDegree(degree.id, { institution: event.target.value })
                  }
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Degree
                <input
                  value={degree.degree}
                  onChange={(event) =>
                    updateDegree(degree.id, { degree: event.target.value })
                  }
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Field of study
                <input
                  value={degree.field}
                  onChange={(event) =>
                    updateDegree(degree.id, { field: event.target.value })
                  }
                />
              </label>
              <div className="row" style={{ gap: "0.65rem" }}>
                <label style={{ display: "grid", gap: "0.25rem", flex: 1 }}>
                  Start year
                  <input
                    value={degree.startYear}
                    onChange={(event) =>
                      updateDegree(degree.id, { startYear: event.target.value })
                    }
                  />
                </label>
                <label style={{ display: "grid", gap: "0.25rem", flex: 1 }}>
                  End year
                  <input
                    value={degree.endYear}
                    onChange={(event) =>
                      updateDegree(degree.id, { endYear: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="row" style={{ gap: "0.35rem" }}>
                <input
                  type="checkbox"
                  checked={degree.includeInResume}
                  onChange={(event) =>
                    updateDegree(degree.id, {
                      includeInResume: event.target.checked,
                    })
                  }
                />
                Include in resume ({includeLabel(degree.includeInResume)})
              </label>
            </EntryCard>
          ))
        )}
      </section>

      <section style={{ display: "grid", gap: "0.65rem" }}>
        <div className="row space-between">
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Certifications</h2>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setForm((previous) => ({
                ...previous,
                certifications: [
                  ...previous.certifications,
                  createEmptyCertification(),
                ],
              }))
            }
          >
            Add certification
          </button>
        </div>
        {form.certifications.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No certifications yet.
          </p>
        ) : (
          form.certifications.map((cert, index) => (
            <EntryCard
              key={cert.id}
              title={`Certification ${index + 1}`}
              disabled={saving}
              onRemove={() =>
                setForm((previous) => ({
                  ...previous,
                  certifications: previous.certifications.filter(
                    (entry) => entry.id !== cert.id,
                  ),
                }))
              }
            >
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Name
                <input
                  value={cert.name}
                  onChange={(event) =>
                    updateCertification(cert.id, { name: event.target.value })
                  }
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Issuer
                <input
                  value={cert.issuer}
                  onChange={(event) =>
                    updateCertification(cert.id, { issuer: event.target.value })
                  }
                />
              </label>
              <div className="row" style={{ gap: "0.65rem" }}>
                <label style={{ display: "grid", gap: "0.25rem", flex: 1 }}>
                  Issued
                  <input
                    value={cert.issuedDate}
                    onChange={(event) =>
                      updateCertification(cert.id, {
                        issuedDate: event.target.value,
                      })
                    }
                  />
                </label>
                <label style={{ display: "grid", gap: "0.25rem", flex: 1 }}>
                  Expires
                  <input
                    value={cert.expiryDate}
                    onChange={(event) =>
                      updateCertification(cert.id, {
                        expiryDate: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Credential URL
                <input
                  value={cert.url}
                  onChange={(event) =>
                    updateCertification(cert.id, { url: event.target.value })
                  }
                />
              </label>
              <label className="row" style={{ gap: "0.35rem" }}>
                <input
                  type="checkbox"
                  checked={cert.includeInResume}
                  onChange={(event) =>
                    updateCertification(cert.id, {
                      includeInResume: event.target.checked,
                    })
                  }
                />
                Include in resume ({includeLabel(cert.includeInResume)})
              </label>
            </EntryCard>
          ))
        )}
      </section>

      <section style={{ display: "grid", gap: "0.65rem" }}>
        <div className="row space-between">
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Post-graduate classes</h2>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setForm((previous) => ({
                ...previous,
                postGradClasses: [
                  ...previous.postGradClasses,
                  createEmptyPostGradClass(),
                ],
              }))
            }
          >
            Add class
          </button>
        </div>
        {form.postGradClasses.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No post-graduate classes yet.
          </p>
        ) : (
          form.postGradClasses.map((course, index) => (
            <EntryCard
              key={course.id}
              title={`Class ${index + 1}`}
              disabled={saving}
              onRemove={() =>
                setForm((previous) => ({
                  ...previous,
                  postGradClasses: previous.postGradClasses.filter(
                    (entry) => entry.id !== course.id,
                  ),
                }))
              }
            >
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Course name
                <input
                  value={course.courseName}
                  onChange={(event) =>
                    updatePostGradClass(course.id, {
                      courseName: event.target.value,
                    })
                  }
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Institution
                <input
                  value={course.institution}
                  onChange={(event) =>
                    updatePostGradClass(course.id, {
                      institution: event.target.value,
                    })
                  }
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Completed
                <input
                  value={course.completedDate}
                  onChange={(event) =>
                    updatePostGradClass(course.id, {
                      completedDate: event.target.value,
                    })
                  }
                />
              </label>
              <label className="row" style={{ gap: "0.35rem" }}>
                <input
                  type="checkbox"
                  checked={course.includeInResume}
                  onChange={(event) =>
                    updatePostGradClass(course.id, {
                      includeInResume: event.target.checked,
                    })
                  }
                />
                Include in resume ({includeLabel(course.includeInResume)})
              </label>
            </EntryCard>
          ))
        )}
      </section>

      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save education"}
      </button>
    </form>
  );
}
