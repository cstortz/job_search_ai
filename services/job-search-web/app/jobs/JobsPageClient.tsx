"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ApiRequestError,
  JobListingRecord,
  JobSiteRecord,
  createJobListing,
  listJobListings,
  listJobSites,
} from "../../src/lib/api/job-client";
import {
  JOB_LIST_TAB_IDS,
  JOB_LIST_TAB_LABELS,
  countJobListingsByTab,
  filterJobListingsByTab,
  isJobListTabId,
  sortJobListingsForTab,
  type JobListTabId,
} from "../../src/lib/models/job-list-filters";

const DEFAULT_TAB: JobListTabId = "high-matches";

function formatMatchScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return "—";
  }
  return `${score}%`;
}

function formatWorkType(listing: JobListingRecord): string {
  const locationType = listing.job_location_type?.trim();
  if (locationType) {
    return locationType;
  }
  const location = listing.location?.toLowerCase() ?? "";
  if (/\bremote\b/.test(location)) {
    return "remote";
  }
  return "—";
}

export default function JobsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") ?? DEFAULT_TAB;
  const activeTab: JobListTabId = isJobListTabId(tabParam) ? tabParam : DEFAULT_TAB;

  const [jobSites, setJobSites] = useState<JobSiteRecord[]>([]);
  const [jobListings, setJobListings] = useState<JobListingRecord[]>([]);
  const [jobPreferences, setJobPreferences] = useState<Record<string, unknown> | null>(
    null,
  );
  const [matchThresholdPercent, setMatchThresholdPercent] = useState(70);
  const [statusFilter, setStatusFilter] = useState("");
  const [jobSourceIdFilter, setJobSourceIdFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createJobUrl, setCreateJobUrl] = useState("");
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [sitesResult, listingsResult] = await Promise.all([
        listJobSites(),
        listJobListings({
          status: statusFilter || null,
          jobSourceId: jobSourceIdFilter || null,
        }),
      ]);
      setJobSites(sitesResult.jobSites);
      setJobListings(listingsResult.jobListings);
      setJobPreferences(listingsResult.jobPreferences);
      setMatchThresholdPercent(listingsResult.matchThresholdPercent);
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to load job data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabCounts = useMemo(
    () => countJobListingsByTab(jobListings, jobPreferences),
    [jobListings, jobPreferences],
  );

  const visibleListings = useMemo(
    () =>
      sortJobListingsForTab(
        filterJobListingsByTab(jobListings, activeTab, jobPreferences),
        activeTab,
      ),
    [jobListings, activeTab, jobPreferences],
  );

  const sourceOptions = useMemo(
    () => [{ id: "", label: "All job sites" }].concat(
      jobSites.map((site) => ({
        id: site.id,
        label: site.company || site.url,
      })),
    ),
    [jobSites],
  );

  function selectTab(tabId: JobListTabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.replace(`/jobs?${params.toString()}`);
  }

  async function onCreateJob() {
    const trimmedUrl = createJobUrl.trim();
    if (!trimmedUrl) {
      setError("Job URL is required.");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError("Job URL must be valid.");
      return;
    }

    setCreating(true);
    setError(null);
    setCreateMessage(null);
    try {
      const created = await createJobListing({ jobUrl: trimmedUrl });
      setCreateMessage(created.message);
      setCreateJobUrl("");
      await loadData();
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to add job listing.";
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Job Listings</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Browse tracked opportunities by match score, work type, and relocation
          fit. High matches uses your{" "}
          <Link href="/profile?tab=job-search">profile match threshold</Link> (
          {matchThresholdPercent}%).
        </p>
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            padding: "0.75rem",
            marginBottom: "0.9rem",
          }}
        >
          <strong>Add single job URL</strong>
          <p className="muted" style={{ margin: 0 }}>
            Add a job posting URL to start the resume creation process.
          </p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <input
              value={createJobUrl}
              onChange={(event) => setCreateJobUrl(event.target.value)}
              placeholder="https://company.com/jobs/software-engineer"
            />
            <button type="button" onClick={() => void onCreateJob()} disabled={creating}>
              {creating ? "Adding..." : "Add Job URL"}
            </button>
          </div>
          {createMessage ? (
            <p style={{ margin: 0, color: "#065f46" }}>{createMessage}</p>
          ) : null}
        </div>

        <nav
          className="profile-tabs"
          aria-label="Job listing views"
          style={{ marginBottom: "0.85rem" }}
        >
          {JOB_LIST_TAB_IDS.map((tabId) => (
            <button
              key={tabId}
              type="button"
              className={
                activeTab === tabId
                  ? "profile-tab profile-tab--active"
                  : "profile-tab"
              }
              aria-current={activeTab === tabId ? "page" : undefined}
              onClick={() => selectTab(tabId)}
            >
              {JOB_LIST_TAB_LABELS[tabId]} ({tabCounts[tabId]})
            </button>
          ))}
        </nav>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
            <option value="expired">expired</option>
          </select>
          <select
            value={jobSourceIdFilter}
            onChange={(event) => setJobSourceIdFilter(event.target.value)}
          >
            {sourceOptions.map((option) => (
              <option key={option.id || "all"} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button onClick={() => void loadData()} disabled={loading}>
            {loading ? "Loading..." : "Apply Filters"}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        <div className="row space-between" style={{ marginBottom: "0.5rem" }}>
          <strong>
            {visibleListings.length} listing(s) in {JOB_LIST_TAB_LABELS[activeTab]}
          </strong>
          <span className="muted">{jobSites.length} site(s) configured</span>
        </div>

        {visibleListings.length === 0 && !loading ? (
          <p className="muted">
            {activeTab === "high-matches"
              ? `No scored jobs at or above ${matchThresholdPercent}%. Jobs appear here after assessment.`
              : "No job listings found for this view and filters."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Match</th>
                <th>Work type</th>
                <th>Status</th>
                <th>Location</th>
                <th>Posted</th>
              </tr>
            </thead>
            <tbody>
              {visibleListings.map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <Link href={`/jobs/${listing.id}`}>
                      <strong>{listing.job_title}</strong>
                    </Link>
                  </td>
                  <td>{listing.company_name}</td>
                  <td>{formatMatchScore(listing.match_score)}</td>
                  <td>{formatWorkType(listing)}</td>
                  <td>{listing.status || "-"}</td>
                  <td>{listing.location || "-"}</td>
                  <td>{listing.posting_date || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
