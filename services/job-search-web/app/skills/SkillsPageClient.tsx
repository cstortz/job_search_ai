"use client";

import { type CSSProperties, FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import {
  ApiRequestError,
  SkillRecord,
  createSkill,
  deleteSkill,
  listSkills,
  updateSkill,
} from "../../src/lib/api/skills-client";

interface SkillFormState {
  skillName: string;
  skillCategory: string;
  description: string;
  yearsOfExperience: string;
  lastUsedDate: string;
}

const emptyForm: SkillFormState = {
  skillName: "",
  skillCategory: "",
  description: "",
  yearsOfExperience: "",
  lastUsedDate: "",
};

type SkillSortField =
  | "skill_name"
  | "skill_category"
  | "years_of_experience"
  | "last_used_date";

type SkillFilterField = "name" | "category" | "years" | "lastUsed";

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  if (!active) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M5 1.5L2.8 4.2h1.5v5.1h1.4V4.2h1.5L5 1.5z" fill="currentColor" />
        <path d="M9 12.5l2.2-2.7H9.7V4.7H8.3v5.1H6.8L9 12.5z" fill="currentColor" />
      </svg>
    );
  }
  return direction === "asc" ? (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.5L4.8 4.2h1.5v7.8h1.4V4.2h1.5L7 1.5z" fill="currentColor" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 12.5l2.2-2.7H7.7V2h-1.4v7.8H4.8L7 12.5z" fill="currentColor" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2 3h10L8 7v3l-2 1V7L2 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {expanded ? (
        <path
          d="M3 5l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M5 3l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const iconButtonStyle: CSSProperties = {
  padding: "0.2rem 0.35rem",
  background: "transparent",
  borderColor: "#9ca3af",
  color: "#4b5563",
};

function fromSkill(skill: SkillRecord): SkillFormState {
  return {
    skillName: skill.skill_name,
    skillCategory: skill.skill_category ?? "",
    description: skill.description ?? "",
    yearsOfExperience:
      typeof skill.years_of_experience === "number"
        ? String(skill.years_of_experience)
        : "",
    lastUsedDate: skill.last_used_date ?? "",
  };
}

function toPayload(form: SkillFormState) {
  return {
    skillName: form.skillName.trim(),
    skillCategory: form.skillCategory.trim() || null,
    description: form.description.trim() || null,
    yearsOfExperience: form.yearsOfExperience.trim()
      ? Number(form.yearsOfExperience.trim())
      : null,
    lastUsedDate: form.lastUsedDate.trim() || null,
  };
}

export default function SkillsPageClient() {
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SkillFormState>(emptyForm);
  const [sortField, setSortField] = useState<SkillSortField | null>("skill_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState<Record<SkillFilterField, boolean>>({
    name: false,
    category: false,
    years: false,
    lastUsed: false,
  });
  const [columnFilter, setColumnFilter] = useState<Record<SkillFilterField, string>>({
    name: "",
    category: "",
    years: "",
    lastUsed: "",
  });

  async function loadSkills() {
    setLoading(true);
    setError(null);
    try {
      const result = await listSkills();
      setSkills(result.skills);
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError ? caught.message : "Failed to load skills.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSkills();
  }, []);

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function beginEdit(skill: SkillRecord) {
    setEditingId(skill.id);
    setForm(fromSkill(skill));
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.skillName.trim()) {
      setError("Skill name is required.");
      return;
    }
    if (
      form.yearsOfExperience.trim() &&
      (!/^\d+$/.test(form.yearsOfExperience.trim()) ||
        Number(form.yearsOfExperience.trim()) < 0)
    ) {
      setError("Years of experience must be a non-negative integer.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateSkill(editingId, payload);
      } else {
        await createSkill(payload);
      }
      await loadSkills();
      beginCreate();
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to save skill.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      await deleteSkill(id);
      await loadSkills();
      if (editingId === id) {
        beginCreate();
      }
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to delete skill.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function toggleSort(field: SkillSortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
      return;
    }
    setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
  }

  function toggleFilter(field: SkillFilterField) {
    setShowFilter((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  }

  const displayedSkills = useMemo(() => {
    const nameFilter = columnFilter.name.trim().toLowerCase();
    const categoryFilter = columnFilter.category.trim().toLowerCase();
    const yearsFilter = columnFilter.years.trim();
    const lastUsedFilter = columnFilter.lastUsed.trim().toLowerCase();
    const filtered = skills.filter((skill) => {
      const matchesName =
        !nameFilter ||
        skill.skill_name.toLowerCase().includes(nameFilter) ||
        (skill.description ?? "").toLowerCase().includes(nameFilter);
      const matchesCategory =
        !categoryFilter ||
        (skill.skill_category ?? "").toLowerCase().includes(categoryFilter);
      const matchesYears =
        !yearsFilter ||
        String(skill.years_of_experience ?? "").includes(yearsFilter);
      const matchesLastUsed =
        !lastUsedFilter ||
        String(skill.last_used_date ?? "").toLowerCase().includes(lastUsedFilter);
      return matchesName && matchesCategory && matchesYears && matchesLastUsed;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (!sortField) {
        return 0;
      }
      const dir = sortDirection === "asc" ? 1 : -1;
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === "number" || typeof bValue === "number") {
        const aNum = typeof aValue === "number" ? aValue : Number.NEGATIVE_INFINITY;
        const bNum = typeof bValue === "number" ? bValue : Number.NEGATIVE_INFINITY;
        return (aNum - bNum) * dir;
      }

      const aText = String(aValue ?? "").toLowerCase();
      const bText = String(bValue ?? "").toLowerCase();
      return aText.localeCompare(bText) * dir;
    });

    return sorted;
  }, [skills, columnFilter, sortField, sortDirection]);

  const isNameActive =
    sortField === "skill_name" || columnFilter.name.trim().length > 0;
  const isCategoryActive =
    sortField === "skill_category" || columnFilter.category.trim().length > 0;
  const isYearsActive =
    sortField === "years_of_experience" || columnFilter.years.trim().length > 0;
  const isLastUsedActive =
    sortField === "last_used_date" || columnFilter.lastUsed.trim().length > 0;

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Skills</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Capture and maintain your reusable skill inventory.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.6rem" }}>
          <input
            value={form.skillName}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, skillName: event.target.value }))
            }
            placeholder="Skill name (required)"
            required
          />
          <div className="row">
            <input
              value={form.skillCategory}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, skillCategory: event.target.value }))
              }
              placeholder="Category (technical, tool, language...)"
            />
            <input
              value={form.yearsOfExperience}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, yearsOfExperience: event.target.value }))
              }
              placeholder="Years of experience"
              inputMode="numeric"
            />
            <input
              value={form.lastUsedDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, lastUsedDate: event.target.value }))
              }
              placeholder="Last used date (YYYY-MM-DD)"
            />
          </div>
          <input
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Description"
          />
          <div className="row">
            <button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Skill"
                  : "Create Skill"}
            </button>
            {editingId ? (
              <button type="button" onClick={beginCreate} disabled={saving}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="row space-between" style={{ marginBottom: "0.75rem" }}>
          <strong>{displayedSkills.length} skill(s)</strong>
          <span className="muted">{skills.length} total</span>
        </div>

        {loading ? (
          <p className="muted">Loading skills...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "42px" }}></th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isNameActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Name
                    </span>
                    <button
                      type="button"
                      title="Sort by Name"
                      onClick={() => toggleSort("skill_name")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "skill_name"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Name"
                      onClick={() => toggleFilter("name")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  <div className="row">
                    {showFilter.name ? (
                      <input
                        value={columnFilter.name}
                        onChange={(event) =>
                          setColumnFilter((previous) => ({
                            ...previous,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Filter name/desc"
                      />
                    ) : null}
                  </div>
                </th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isCategoryActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Category
                    </span>
                    <button
                      type="button"
                      title="Sort by Category"
                      onClick={() => toggleSort("skill_category")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "skill_category"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Category"
                      onClick={() => toggleFilter("category")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.category ? (
                    <input
                      value={columnFilter.category}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Filter category"
                    />
                  ) : null}
                </th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isYearsActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Years
                    </span>
                    <button
                      type="button"
                      title="Sort by Years"
                      onClick={() => toggleSort("years_of_experience")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "years_of_experience"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Years"
                      onClick={() => toggleFilter("years")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.years ? (
                    <input
                      value={columnFilter.years}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          years: event.target.value,
                        }))
                      }
                      placeholder="Filter years"
                    />
                  ) : null}
                </th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isLastUsedActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Last Used
                    </span>
                    <button
                      type="button"
                      title="Sort by Last Used"
                      onClick={() => toggleSort("last_used_date")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "last_used_date"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Last Used"
                      onClick={() => toggleFilter("lastUsed")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.lastUsed ? (
                    <input
                      value={columnFilter.lastUsed}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          lastUsed: event.target.value,
                        }))
                      }
                      placeholder="Filter last used"
                    />
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedSkills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No skills match the current filters.
                  </td>
                </tr>
              ) : (
                displayedSkills.map((skill) => (
                  <Fragment key={skill.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          title={
                            expandedSkillId === skill.id
                              ? "Collapse row"
                              : "Expand row"
                          }
                          onClick={() =>
                            setExpandedSkillId((prev) =>
                              prev === skill.id ? null : skill.id,
                            )
                          }
                          style={iconButtonStyle}
                        >
                          <ChevronIcon expanded={expandedSkillId === skill.id} />
                        </button>
                      </td>
                      <td style={{ fontWeight: isNameActive ? 700 : 400 }}>
                        {skill.skill_name}
                      </td>
                      <td style={{ fontWeight: isCategoryActive ? 700 : 400 }}>
                        {skill.skill_category || "-"}
                      </td>
                      <td>
                        <span style={{ fontWeight: isYearsActive ? 700 : 400 }}>
                          {typeof skill.years_of_experience === "number"
                            ? skill.years_of_experience
                            : "-"}
                        </span>
                      </td>
                      <td style={{ fontWeight: isLastUsedActive ? 700 : 400 }}>
                        {skill.last_used_date || "-"}
                      </td>
                    </tr>
                    {expandedSkillId === skill.id ? (
                      <tr>
                        <td colSpan={5}>
                          <strong>Description</strong>
                          <p
                            style={{
                              margin: "0.35rem 0 0 0",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {skill.description || "No description provided."}
                          </p>
                          <p className="muted" style={{ margin: "0.5rem 0 0 0" }}>
                            <strong>ID:</strong> {skill.id}
                          </p>
                          <p className="muted" style={{ margin: "0.2rem 0 0 0" }}>
                            <strong>Created:</strong> {skill.created_at || "-"}
                          </p>
                          <p className="muted" style={{ margin: "0.2rem 0 0 0" }}>
                            <strong>Updated:</strong> {skill.updated_at || "-"}
                          </p>
                          <div className="row" style={{ marginTop: "0.6rem" }}>
                            <button type="button" onClick={() => beginEdit(skill)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDelete(skill.id)}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
