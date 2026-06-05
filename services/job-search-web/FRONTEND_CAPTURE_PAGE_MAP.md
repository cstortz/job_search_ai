# Frontend Capture Page Map (MVP-first)

This document defines the data-capture pages/forms to build before retrieval-heavy views.

## 1) MVP Capture Routes (Simple -> Moderate)

## `/profile`
- **Purpose:** Capture baseline user profile metadata.
- **Form fields:**
  - `phone` (string, optional)
  - `linkedinUrl` (string URL, optional)
  - `timezone` (string, required, default `UTC`)
  - `otherUrls` (JSON key/value list, optional)
- **API dependencies:**
  - `POST /api/auth/sync-user`
- **Validation:**
  - URL fields must be valid URLs
  - timezone non-empty

## `/skills`
- **Purpose:** Capture reusable skill records.
- **Form fields:**
  - `skillName` (string, required)
  - `skillCategory` (string, optional; enum-like UI choices)
  - `description` (string, optional)
  - `yearsOfExperience` (integer >= 0, optional)
  - `lastUsedDate` (`YYYY-MM-DD`, optional)
- **API dependencies:**
  - `GET /api/skills`
  - `POST /api/skills`
  - `PATCH /api/skills/{id}`
  - `DELETE /api/skills/{id}`
- **Validation:**
  - required `skillName`
  - years integer >= 0

## `/roles`
- **Purpose:** Capture work experience entries.
- **Form fields:**
  - `jobTitle` (required)
  - `companyName` (required)
  - `startDate` (required)
  - `endDate` (optional)
  - `employmentType` (optional)
  - `reasonForLeaving` (optional)
  - `achievements` (optional)
  - `description` (optional)
- **API dependencies:**
  - `GET /api/roles` (to implement)
  - `POST /api/roles` (to implement)
  - `PATCH /api/roles/{id}` (to implement)
  - `DELETE /api/roles/{id}` (to implement)
- **Validation:**
  - required title/company/start
  - endDate >= startDate when present

## `/job-sites`
- **Purpose:** Capture job source definitions.
- **Form fields:**
  - `url` (required)
  - `company` (optional)
  - `industry` (optional)
  - `frequency` (optional; daily/weekly/etc)
  - `enabled` (boolean)
  - `timezone` (optional)
- **API dependencies:**
  - `GET /api/job-sites`
  - `POST /api/job-sites` (to implement)
  - `PATCH /api/job-sites/{id}` (to implement)
  - `DELETE /api/job-sites/{id}` (to implement)
- **Validation:**
  - valid URL required

## `/jobs/new`
- **Purpose:** Manual job listing intake.
- **Form fields:**
  - `jobTitle` (required)
  - `companyName` (required)
  - `jobUrl` (required)
  - `applicationUrl` (optional)
  - `location` (optional)
  - `jobLocationType` (optional)
  - `jobType` (optional)
  - `jobLevel` (optional)
  - `postingDate` (optional)
  - `applicationDeadline` (optional)
  - `status` (default `active`)
  - `userTags` (optional array)
- **API dependencies:**
  - `POST /api/job-listings` (to implement)
- **Validation:**
  - required title/company/jobUrl
  - URL/date validation

## `/applications/new` (resume packet create)
- **Purpose:** Create packet/application metadata linked to a job.
- **Form fields:**
  - `jobId` (required)
  - `status` (default `draft`)
  - `applicationStatus` (optional)
  - `applicationMethod` (optional)
  - `dateApplied` (optional)
  - `applicationTrackingNumber` (optional)
  - `portalUrl` (optional)
  - `applicationNotes` (optional)
- **API dependencies:**
  - `POST /api/resume-packets` (to implement)
  - `GET /api/job-listings` (for job selector)
- **Validation:**
  - required `jobId`
  - date/URL validation

## `/documents/upload`
- **Purpose:** Upload and link supporting documents.
- **Form fields:**
  - `file` (required)
  - `documentType` (optional UI metadata)
  - `jobId` (optional linkage; future endpoint needed)
  - `resumePacketId` (optional linkage; future endpoint needed)
- **API dependencies:**
  - `POST /api/documents/upload`
  - `GET /api/documents`
- **Validation:**
  - file size/type constraints

## 2) Chat-Assisted Capture Routes (Complex)

## `/capture/skills-chat`
- **Purpose:** Convert unstructured text/resume into draft skill records.
- **Flow:**
  - user prompt + optional attachments
  - AI proposes structured skill rows
  - user confirms -> batch create skills
- **API dependencies:**
  - `POST /api/chat/message`
  - `GET /api/chat/stream/{sessionId}`
  - `POST /api/skills` (batch through client loop or future batch endpoint)

## `/capture/job-chat`
- **Purpose:** Parse pasted posting URL/text into normalized job listing.
- **Flow:**
  - user pastes job posting
  - AI extracts fields
  - user edits/approves
  - submit to job listing create endpoint
- **API dependencies:**
  - chat endpoints + `POST /api/job-listings` (to implement)

## `/capture/interview-chat`
- **Purpose:** Convert interview notes into structured interview record + follow-ups.
- **API dependencies:**
  - chat endpoints
  - interview CRUD endpoints (to implement)

## `/capture/offer-chat`
- **Purpose:** Convert offer/negotiation notes into structured offer record.
- **API dependencies:**
  - chat endpoints
  - offer CRUD endpoints (to implement)

## 3) Build Order (Execution Plan)

1. `/profile`
2. `/skills`
3. `/job-sites`
4. `/jobs/new`
5. `/applications/new`
6. `/documents/upload` enhancements for linkage metadata
7. `/capture/skills-chat`
8. `/capture/job-chat`
9. `/capture/interview-chat`
10. `/capture/offer-chat`

## 4) Prerequisite API Gaps To Implement

- Roles CRUD (`/api/roles`, `/api/roles/{id}`)
- Job site write endpoints (`POST/PATCH/DELETE /api/job-sites`)
- Job listing create endpoint (`POST /api/job-listings`)
- Resume packet create/update endpoints (`POST/PATCH /api/resume-packets`)
- Interview CRUD endpoints
- Offer CRUD endpoints

Without these, corresponding capture pages can be scaffolded but not fully functional.
