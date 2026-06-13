"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApiRequestError,
  UserRecord,
  getCurrentUser,
} from "../../src/lib/api/auth-client";
import {
  PROFILE_TAB_IDS,
  PROFILE_TAB_LABELS,
  isProfileTabId,
  type ProfileTabId,
} from "../../src/lib/models/profile-tabs";
import CommunicationsTab from "./components/CommunicationsTab";
import DemographicsTab from "./components/DemographicsTab";
import EducationTab from "./components/EducationTab";
import JobHistoryTab from "./components/JobHistoryTab";
import JobSearchTab from "./components/JobSearchTab";
import OfficeTypeTab from "./components/OfficeTypeTab";
import RelocationTab from "./components/RelocationTab";
import { SaveFeedback, SaveFeedbackBanner } from "./components/profile-shared";

const DEFAULT_TAB: ProfileTabId = "demographics";

export default function ProfilePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") ?? DEFAULT_TAB;
  const activeTab: ProfileTabId = isProfileTabId(tabParam)
    ? tabParam
    : DEFAULT_TAB;

  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFeedback, setLoadFeedback] = useState<SaveFeedback | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadFeedback(null);
    try {
      const result = await getCurrentUser();
      setUser(result.user);
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to load profile.";
      setLoadFeedback({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function selectTab(tabId: ProfileTabId) {
    router.replace(`/profile?tab=${tabId}`);
  }

  function handleSaved(updatedUser: UserRecord) {
    setUser(updatedUser);
  }

  function renderTabContent() {
    if (!user) {
      return null;
    }

    switch (activeTab) {
      case "demographics":
        return <DemographicsTab user={user} onSaved={handleSaved} />;
      case "communications":
        return <CommunicationsTab user={user} onSaved={handleSaved} />;
      case "relocation":
        return <RelocationTab user={user} onSaved={handleSaved} />;
      case "office-type":
        return <OfficeTypeTab user={user} onSaved={handleSaved} />;
      case "job-search":
        return <JobSearchTab user={user} onSaved={handleSaved} />;
      case "job-history":
        return <JobHistoryTab user={user} onSaved={handleSaved} />;
      case "education":
        return <EducationTab user={user} onSaved={handleSaved} />;
      default:
        return <DemographicsTab user={user} onSaved={handleSaved} />;
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Profile</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Manage demographics, communications, and job-matching preferences across
          separate tabs.
        </p>
        {loadFeedback ? <SaveFeedbackBanner feedback={loadFeedback} /> : null}

        <nav
          className="profile-tabs"
          aria-label="Profile sections"
          style={{ marginTop: "1rem" }}
        >
          {PROFILE_TAB_IDS.map((tabId) => (
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
              {PROFILE_TAB_LABELS[tabId]}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "1rem" }}>
          {loading ? (
            <p className="muted">Loading profile...</p>
          ) : user ? (
            renderTabContent()
          ) : (
            <p className="error">Sign in to manage your profile.</p>
          )}
        </div>
      </div>
    </section>
  );
}
