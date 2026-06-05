"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ApiRequestError,
  JobListingRecord,
  ResumePacketRecord,
  getJobListingById,
  listResumePackets,
  patchJobListingStatus,
} from "../../../src/lib/api/job-client";

interface JobDetailClientProps {
  id: string;
}

export default function JobDetailClient({ id }: JobDetailClientProps) {
  const [jobListing, setJobListing] = useState<JobListingRecord | null>(null);
  const [resumePackets, setResumePackets] = useState<ResumePacketRecord[]>([]);
  const [statusDraft, setStatusDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const listingResult = await getJobListingById(id);
      setJobListing(listingResult.jobListing);
      setStatusDraft(listingResult.jobListing.status || "");

      const packetsResult = await listResumePackets({ jobId: id });
      setResumePackets(packetsResult.resumePackets);
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to load job detail.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onSaveStatus() {
    if (!statusDraft.trim()) {
      setError("Status cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await patchJobListingStatus(id, statusDraft.trim());
      setJobListing(result.jobListing);
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to update status.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <p style={{ marginTop: "1rem" }}>Loading job detail...</p>;
  }

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="row">
        <Link href="/jobs">&larr; Back to Jobs</Link>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {!jobListing ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Job not found</h2>
          <p className="muted">
            This listing may not exist or may not belong to your account.
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
            <h1 style={{ margin: 0 }}>{jobListing.job_title}</h1>
            <div className="muted">{jobListing.company_name}</div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <span>
                <strong>Status:</strong> {jobListing.status || "-"}
              </span>
              <span>
                <strong>Location:</strong> {jobListing.location || "-"}
              </span>
              <span>
                <strong>Posted:</strong> {jobListing.posting_date || "-"}
              </span>
            </div>
            <div className="row">
              <input
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value)}
                placeholder="Set status"
              />
              <button onClick={() => void onSaveStatus()} disabled={saving}>
                {saving ? "Saving..." : "Update Status"}
              </button>
            </div>
            {jobListing.job_url ? (
              <a href={jobListing.job_url} target="_blank" rel="noreferrer">
                Open Original Job Posting
              </a>
            ) : null}
            {jobListing.application_url ? (
              <a href={jobListing.application_url} target="_blank" rel="noreferrer">
                Open Application URL
              </a>
            ) : null}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Description</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {jobListing.job_description_text || "No description available."}
            </p>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Resume Packets</h2>
            {resumePackets.length === 0 ? (
              <p className="muted">No resume packets linked to this job yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Packet ID</th>
                    <th>Status</th>
                    <th>Application Status</th>
                    <th>Version</th>
                    <th>Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {resumePackets.map((packet) => (
                    <tr key={packet.id}>
                      <td>{packet.id}</td>
                      <td>{packet.status || "-"}</td>
                      <td>{packet.application_status || "-"}</td>
                      <td>{packet.version_number ?? "-"}</td>
                      <td>{packet.date_applied || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
