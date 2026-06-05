"use client";

import { type CSSProperties, FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import {
  ApiRequestError,
  JobSiteRecord,
  createJobSite,
  deleteJobSite,
  listJobSites,
  updateJobSite,
} from "../../src/lib/api/job-client";

interface JobSiteFormState {
  url: string;
  company: string;
  industry: string;
  usPostalAddress: string;
  frequency: string;
  enabled: boolean;
  timezone: string;
  authenticationType: string;
}

type SiteSortField = "company" | "url" | "industry" | "frequency" | "enabled";
type SiteFilterField = "company" | "url" | "industry" | "frequency" | "enabled";

const emptyForm: JobSiteFormState = {
  url: "",
  company: "",
  industry: "",
  usPostalAddress: "",
  frequency: "",
  enabled: true,
  timezone: "UTC",
  authenticationType: "",
};

function fromJobSite(site: JobSiteRecord): JobSiteFormState {
  return {
    url: site.url,
    company: site.company ?? "",
    industry: site.industry ?? "",
    usPostalAddress: site.us_postal_address ?? "",
    frequency: site.frequency ?? "",
    enabled: site.enabled,
    timezone: site.timezone ?? "UTC",
    authenticationType: site.authentication_type ?? "",
  };
}

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

export default function JobSitesPageClient() {
  const [jobSites, setJobSites] = useState<JobSiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<JobSiteFormState>(emptyForm);
  const [sortField, setSortField] = useState<SiteSortField | null>("company");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showFilter, setShowFilter] = useState<Record<SiteFilterField, boolean>>({
    company: false,
    url: false,
    industry: false,
    frequency: false,
    enabled: false,
  });
  const [columnFilter, setColumnFilter] = useState<Record<SiteFilterField, string>>({
    company: "",
    url: "",
    industry: "",
    frequency: "",
    enabled: "",
  });

  async function loadJobSites() {
    setLoading(true);
    setError(null);
    try {
      const result = await listJobSites();
      setJobSites(result.jobSites);
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to load job sites.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobSites();
  }, []);

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function beginEdit(site: JobSiteRecord) {
    setEditingId(site.id);
    setForm(fromJobSite(site));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.url.trim()) {
      setError("URL is required.");
      return;
    }
    try {
      new URL(form.url.trim());
    } catch {
      setError("URL must be valid.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        url: form.url.trim(),
        company: form.company.trim() || null,
        industry: form.industry.trim() || null,
        usPostalAddress: form.usPostalAddress.trim() || null,
        frequency: form.frequency.trim() || null,
        enabled: form.enabled,
        timezone: form.timezone.trim() || null,
        authenticationType: form.authenticationType.trim() || null,
      };
      if (editingId) {
        await updateJobSite(editingId, payload);
      } else {
        await createJobSite(payload);
      }
      await loadJobSites();
      beginCreate();
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to save job site.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      await deleteJobSite(id);
      await loadJobSites();
      if (expandedId === id) {
        setExpandedId(null);
      }
      if (editingId === id) {
        beginCreate();
      }
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to delete job site.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function toggleSort(field: SiteSortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
      return;
    }
    setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
  }

  function toggleFilter(field: SiteFilterField) {
    setShowFilter((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  }

  const displayed = useMemo(() => {
    const filtered = jobSites.filter((site) => {
      const companyFilter = columnFilter.company.trim().toLowerCase();
      const urlFilter = columnFilter.url.trim().toLowerCase();
      const industryFilter = columnFilter.industry.trim().toLowerCase();
      const frequencyFilter = columnFilter.frequency.trim().toLowerCase();
      const enabledFilter = columnFilter.enabled.trim().toLowerCase();

      const matchesCompany =
        !companyFilter ||
        String(site.company ?? "").toLowerCase().includes(companyFilter);
      const matchesUrl = !urlFilter || site.url.toLowerCase().includes(urlFilter);
      const matchesIndustry =
        !industryFilter ||
        String(site.industry ?? "").toLowerCase().includes(industryFilter);
      const matchesFrequency =
        !frequencyFilter ||
        String(site.frequency ?? "").toLowerCase().includes(frequencyFilter);
      const enabledLabel = site.enabled ? "yes" : "no";
      const matchesEnabled =
        !enabledFilter || enabledLabel.toLowerCase().includes(enabledFilter);

      return (
        matchesCompany &&
        matchesUrl &&
        matchesIndustry &&
        matchesFrequency &&
        matchesEnabled
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      if (!sortField) {
        return 0;
      }
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortField === "enabled") {
        const aVal = a.enabled ? 1 : 0;
        const bVal = b.enabled ? 1 : 0;
        return (aVal - bVal) * dir;
      }
      const aText = String(a[sortField] ?? "").toLowerCase();
      const bText = String(b[sortField] ?? "").toLowerCase();
      return aText.localeCompare(bText) * dir;
    });

    return sorted;
  }, [jobSites, columnFilter, sortField, sortDirection]);

  const isCompanyActive =
    sortField === "company" || columnFilter.company.trim().length > 0;
  const isUrlActive = sortField === "url" || columnFilter.url.trim().length > 0;
  const isIndustryActive =
    sortField === "industry" || columnFilter.industry.trim().length > 0;
  const isFrequencyActive =
    sortField === "frequency" || columnFilter.frequency.trim().length > 0;
  const isEnabledActive =
    sortField === "enabled" || columnFilter.enabled.trim().length > 0;

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Job Sites</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Configure source sites for job discovery.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.6rem" }}>
          <input
            value={form.url}
            onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="Source URL (required)"
            required
          />
          <div className="row">
            <input
              value={form.company}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, company: event.target.value }))
              }
              placeholder="Company"
            />
            <input
              value={form.industry}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, industry: event.target.value }))
              }
              placeholder="Industry"
            />
            <input
              value={form.frequency}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, frequency: event.target.value }))
              }
              placeholder="Frequency (daily/weekly)"
            />
          </div>
          <div className="row">
            <input
              value={form.timezone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, timezone: event.target.value }))
              }
              placeholder="Timezone"
            />
            <input
              value={form.authenticationType}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  authenticationType: event.target.value,
                }))
              }
              placeholder="Authentication type"
            />
            <label className="row" style={{ whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              Enabled
            </label>
          </div>
          <input
            value={form.usPostalAddress}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, usPostalAddress: event.target.value }))
            }
            placeholder="US postal address"
          />
          <div className="row">
            <button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Job Site"
                  : "Create Job Site"}
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
          <strong>{displayed.length} site(s)</strong>
          <span className="muted">{jobSites.length} total</span>
        </div>
        {loading ? (
          <p className="muted">Loading job sites...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "42px" }}></th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isCompanyActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Company
                    </span>
                    <button
                      type="button"
                      title="Sort by Company"
                      onClick={() => toggleSort("company")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "company"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Company"
                      onClick={() => toggleFilter("company")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.company ? (
                    <input
                      value={columnFilter.company}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          company: event.target.value,
                        }))
                      }
                      placeholder="Filter company"
                    />
                  ) : null}
                </th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isUrlActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      URL
                    </span>
                    <button
                      type="button"
                      title="Sort by URL"
                      onClick={() => toggleSort("url")}
                      style={iconButtonStyle}
                    >
                      <SortIcon active={sortField === "url"} direction={sortDirection} />
                    </button>
                    <button
                      type="button"
                      title="Filter URL"
                      onClick={() => toggleFilter("url")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.url ? (
                    <input
                      value={columnFilter.url}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          url: event.target.value,
                        }))
                      }
                      placeholder="Filter url"
                    />
                  ) : null}
                </th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isIndustryActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Industry
                    </span>
                    <button
                      type="button"
                      title="Sort by Industry"
                      onClick={() => toggleSort("industry")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "industry"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Industry"
                      onClick={() => toggleFilter("industry")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.industry ? (
                    <input
                      value={columnFilter.industry}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          industry: event.target.value,
                        }))
                      }
                      placeholder="Filter industry"
                    />
                  ) : null}
                </th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isFrequencyActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Frequency
                    </span>
                    <button
                      type="button"
                      title="Sort by Frequency"
                      onClick={() => toggleSort("frequency")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "frequency"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Frequency"
                      onClick={() => toggleFilter("frequency")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.frequency ? (
                    <input
                      value={columnFilter.frequency}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          frequency: event.target.value,
                        }))
                      }
                      placeholder="Filter frequency"
                    />
                  ) : null}
                </th>
                <th>
                  <div className="row">
                    <span
                      style={{
                        fontWeight: isEnabledActive ? 700 : 500,
                        fontSize: "1rem",
                        color: "#111827",
                      }}
                    >
                      Enabled
                    </span>
                    <button
                      type="button"
                      title="Sort by Enabled"
                      onClick={() => toggleSort("enabled")}
                      style={iconButtonStyle}
                    >
                      <SortIcon
                        active={sortField === "enabled"}
                        direction={sortDirection}
                      />
                    </button>
                    <button
                      type="button"
                      title="Filter Enabled"
                      onClick={() => toggleFilter("enabled")}
                      style={iconButtonStyle}
                    >
                      <FilterIcon />
                    </button>
                  </div>
                  {showFilter.enabled ? (
                    <input
                      value={columnFilter.enabled}
                      onChange={(event) =>
                        setColumnFilter((previous) => ({
                          ...previous,
                          enabled: event.target.value,
                        }))
                      }
                      placeholder="yes/no"
                    />
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No job sites found.
                  </td>
                </tr>
              ) : (
                displayed.map((site) => (
                  <Fragment key={site.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((prev) => (prev === site.id ? null : site.id))
                          }
                          style={iconButtonStyle}
                        >
                          <ChevronIcon expanded={expandedId === site.id} />
                        </button>
                      </td>
                      <td style={{ fontWeight: isCompanyActive ? 700 : 400 }}>
                        {site.company || "-"}
                      </td>
                      <td style={{ fontWeight: isUrlActive ? 700 : 400 }}>{site.url}</td>
                      <td style={{ fontWeight: isIndustryActive ? 700 : 400 }}>
                        {site.industry || "-"}
                      </td>
                      <td style={{ fontWeight: isFrequencyActive ? 700 : 400 }}>
                        {site.frequency || "-"}
                      </td>
                      <td style={{ fontWeight: isEnabledActive ? 700 : 400 }}>
                        {site.enabled ? "yes" : "no"}
                      </td>
                    </tr>
                    {expandedId === site.id ? (
                      <tr>
                        <td colSpan={6}>
                          <p className="muted" style={{ margin: 0 }}>
                            <strong>ID:</strong> {site.id}
                          </p>
                          <p className="muted" style={{ margin: "0.3rem 0 0 0" }}>
                            <strong>Timezone:</strong> {site.timezone || "-"}
                          </p>
                          <p className="muted" style={{ margin: "0.3rem 0 0 0" }}>
                            <strong>Auth Type:</strong> {site.authentication_type || "-"}
                          </p>
                          <p className="muted" style={{ margin: "0.3rem 0 0 0" }}>
                            <strong>Address:</strong> {site.us_postal_address || "-"}
                          </p>
                          <div className="row" style={{ marginTop: "0.6rem" }}>
                            <button type="button" onClick={() => beginEdit(site)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void onDelete(site.id)}
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
