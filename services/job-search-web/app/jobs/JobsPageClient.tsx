"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ApiRequestError,
  JobListingRecord,
  JobSiteRecord,
  createJobListing,
  listJobListings,
  listJobSites,
} from "../../src/lib/api/job-client";

export default function JobsPageClient() {
  const [jobSites, setJobSites] = useState<JobSiteRecord[]>([]);
  const [jobListings, setJobListings] = useState<JobListingRecord[]>([]);
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

  const sourceOptions = useMemo(
    () => [{ id: "", label: "All job sites" }].concat(
      jobSites.map((site) => ({
        id: site.id,
        label: site.company || site.url,
      })),
    ),
    [jobSites],
  );

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
          Browse and manage tracked job opportunities.
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
          <strong>{jobListings.length} listing(s)</strong>
          <span className="muted">{jobSites.length} site(s) configured</span>
        </div>

        {jobListings.length === 0 && !loading ? (
          <p className="muted">No job listings found for selected filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Company</th>
                <th>Status</th>
                <th>Location</th>
                <th>Posted</th>
              </tr>
            </thead>
            <tbody>
              {jobListings.map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <Link href={`/jobs/${listing.id}`}>
                      <strong>{listing.job_title}</strong>
                    </Link>
                  </td>
                  <td>{listing.company_name}</td>
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
