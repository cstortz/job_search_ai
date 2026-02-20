There are multiple parts to this application

**Note: All entities below (1-16) belong to a User. Each user has their own job sources, jobs, assessments, resume packages, skill repository, email tracking, interviews, reminders, job preferences, application notes, offers, references, documents, learning progress, companies, and skills progress.**

0 - User
    - Auth0 subject ID (unique identifier from Auth0)
    - Name
    - Phone
    - Address
    - email
    - Email verified (boolean - whether email is verified)
    - linkedin URL
    - other urls ( Json schema : {"name" : "url"} )
    - Education ( JSON schema : {"institution" : name, "field" : field, "degree" : degree} )
    - Timezone (user's timezone, e.g., "America/New_York", "UTC")
    - Notification preferences (JSON object: {"email": true, "sms": false, "push": true, "in_app": true})
    - Last login timestamp
    - Created at timestamp
    - Updated at timestamp

1 - Job Source - The automated and on request retrieval of job descriptions (belongs to User)
    - Company
    - Industry
    - US Postal Address (Can be null)
    - URL for the job site
    - Frequency to poll the job site
    - Date of last polling
    - Enabled (boolean - whether this job source is active)
    - Last error message (if polling failed, the error message)
    - Error count (number of consecutive errors)
    - Timezone (timezone for scheduling polls, e.g., "America/New_York")
    - Authentication type (e.g., "none", "basic", "api_key", "session_cookie")
    - Authentication credentials (stored as SealedSecret - username, password, API key, session token, etc.)
    - Created at timestamp
    - Updated at timestamp
    - Note: This job source "produces" many Job postings (see section 2). Authentication credentials are stored securely for job sites that require login.

2 - Job/JobPosting - The actual job posting retrieved from a job source (belongs to User, references Job Source)
    - Job title
    - Company name
    - Job description text (full posting content)
    - Requirements/qualifications text
    - Application URL
    - Job URL (original posting URL)
    - External job ID (unique identifier from the source, if available)
    - Posting date (when the job was posted by the employer)
    - Salary range (e.g., "$80k-$120k" or JSON: {"min": 80000, "max": 120000, "currency": "USD"})
    - Location (city, state, country, or "Remote")
    - Job location type (remote, hybrid, onsite)
    - Job type (full-time, part-time, contract, internship)
    - Job level (entry, mid, senior, executive)
    - Application deadline (if specified by the job posting)
    - User interest level (interested, not_interested, maybe, applied)
    - User tags (JSON array of user-defined tags for categorization)
    - Status (active, expired, archived)
    - First seen at timestamp
    - Last fetched at timestamp
    - Created at timestamp
    - Updated at timestamp
    - Note: Multiple users can have the same job posting (same external job ID), but each user's instance is separate

3 - Assessment - The assessment of skills to the job description (belongs to User, references a Job)
    - Markdown assessment of the candidate to the job
    - Score between 0 and 100 for the candidate
    - Skills matched (JSON array of strings - skills that the candidate HAS that match the job, e.g., ["Python", "PostgreSQL", "FastAPI"])
    - Gaps (JSON array of strings, e.g., ["Python", "AWS", "Docker"])
    - Gap-filling resources (JSON array of objects with schema: {"url": "...", "type": "training" | "certification" | "schooling", "title": "..."})
    - Assessment model/version (which AI model and version generated this assessment, e.g., "claude-3-5-sonnet-v1")
    - Generated at timestamp (when the assessment was created)
    - Created at timestamp
    - Updated at timestamp
    - Note: Gaps and resources are stored as JSON since they are only displayed to users, not queried. Gap-filling resources can be tracked via Learning Progress (section 14).

4 - The AI guided skill repository for the job seeker (belongs to User)
    This section contains three related entities:
    
    4a - Role/Work Experience - The "resume" entries (belongs to User)
        - Job title
        - Company name
        - Start date
        - End date (can be null for current role)
        - Employment type (full-time, part-time, contract, internship, freelance)
        - Reason for leaving (optional - why user left this role)
        - Achievements/accomplishments (separate from description - key achievements in this role)
        - Description/notes (optional text about the role)
        - Created at timestamp
        - Updated at timestamp
    
    4b - Skill - Reusable skill definitions (belongs to User)
        - Skill name
        - Skill category (technical, soft_skill, language, certification, tool, framework, methodology)
        - Description (optional)
        - Years of experience (total years of experience with this skill)
        - Last used date (most recent date this skill was used)
        - Created at timestamp
        - Updated at timestamp
        - Note: Skills are reusable across multiple roles
    
    4c - Skill Embedding - Vector embeddings for RAG (belongs to User, references Role and Skill)
        - References a Role (which role this skill was used in)
        - References a Skill (which skill this embedding represents)
        - Chunk text (the specific text/chunk that describes how this skill was used in this role - this is what gets embedded)
        - Embedding vector (pgvector column - the vector representation of the chunk text)
        - Embedding model version (which embedding model was used, e.g., "text-embedding-3-large")
        - Embedding dimension (dimension of the embedding vector, e.g., 1536)
        - Index type (pgvector index type: ivfflat, hnsw, or none)
        - Created at timestamp
        - Updated at timestamp
        - Note: For RAG, similarity search queries the embedding vectors to find relevant skill chunks, then retrieves the associated Role and Skill information

5 - Resume Package - The resume package for the job (belongs to User, references a Job)
    - Status (draft, submitted, withdrawn)
    - Application status (applied, under_review, interview_scheduled, interview_completed, offer_received, rejected, withdrawn)
    - Date applied (when the application was submitted)
    - Date of last status change (when application status was last updated)
    - Application method (email, form, linkedin_easy_apply, company_portal, recruiter, other)
    - Application tracking number (tracking number provided by employer, if available)
    - Portal URL (URL to employer's application portal, if applicable)
    - Portal username (username for application portal, stored as SealedSecret)
    - Portal password (password for application portal, stored as SealedSecret)
    - Application confirmation number/receipt (confirmation number from application submission)
    - Version number (for tracking multiple versions of resume for the same job)
    - Parent resume package ID (references previous version if this is a revision)
    - Resume file URL (URL to generated resume file storage location)
    - Resume file path/key (storage path or object key for the resume file)
    - Resume storage type (e.g., "s3", "local", "object-storage")
    - Resume file size (optional)
    - Resume file format (e.g., "pdf", "docx")
    - Cover letter file URL (URL to generated cover letter file storage location)
    - Cover letter file path/key (storage path or object key for the cover letter file)
    - Cover letter storage type (e.g., "s3", "local", "object-storage")
    - Cover letter file size (optional)
    - Cover letter file format (e.g., "pdf", "docx")
    - Skills used for this resume (List of skills - references to Skill entities)
    - Executive statement (One line about the candidate that stands out)
    - Technical proficiencies (A pipe-delimited list of proficiencies)
    - JSON sent to resume maker to create the resume (the JSON payload sent to resume maker)
    - JSON sent to resume maker to create the Cover Letter (The JSON payload sent to resume maker)
    - Resume maker template/version (template name and version used to generate this resume)
    - Application notes (user notes about the application process, company research, etc.)
    - Application form data (JSON object storing form field data for jobs that require filling out application forms - e.g., previous employers, references, custom questions)
    - Rejection reason (if application status is "rejected", the reason provided by employer or inferred)
    - Rejection feedback (detailed feedback from employer, if provided)
    - Withdrawal reason (if application status is "withdrawn", reason for withdrawal)
    - Archive date (when application was archived, if applicable)
    - Generated at timestamp (when the resume/cover letter files were generated)
    - Created at timestamp
    - Updated at timestamp
    - Note: Resume and cover letter are generated files stored in object storage or filesystem. URLs point to where those files are accessible. Version tracking allows users to maintain multiple resume versions for the same job. Application form data stores structured data for jobs requiring form submissions. Portal credentials are stored securely for checking application status.
6 - Email Tracking - Email tracking for submitted job applications (belongs to User, references a Resume Package or Job)
    - Event type (e.g., "application_sent", "reply_received", "email_opened", "follow_up_sent")
    - Email subject
    - Email body/text (full email content, or reference to stored email file)
    - Recipient email address
    - Sender email address
    - Email date/timestamp (when the email was sent/received)
    - Message ID (email message ID for deduplication)
    - Thread ID (email thread ID for grouping related emails)
    - Status (e.g., "sent", "delivered", "opened", "replied", "bounced")
    - Notes (optional text notes about this email)
    - Created at timestamp
    - Updated at timestamp
    - Note: Tracks all email communications related to job applications. Can reference either a Resume Package (for application emails) or directly to a Job (for general correspondence).

7 - Interview - Interview scheduling and management (belongs to User, references a Job or Resume Package)
    - Interview round number (first_round, second_round, final_round, other - for tracking multiple interview rounds)
    - Interview type (phone, video, onsite, technical_assessment, behavioral)
    - Interview format (panel, one_on_one, group)
    - Interview date/time (scheduled date and time)
    - Interview duration (expected duration in minutes)
    - Location (physical address for onsite, or meeting link for video/phone)
    - Interviewer names (JSON array of interviewer names)
    - Interviewer email addresses (JSON array of interviewer emails)
    - Meeting link (Zoom, Teams, Google Meet URL, etc.)
    - Interview preparation notes (AI-generated common questions, suggested answers, company research)
    - Interview notes (user notes taken during/after interview - questions asked, answers given, feedback)
    - Interview feedback (feedback received from interviewer, if any)
    - Interview rating (user's self-rating of how the interview went: 1-5 stars)
    - Interview cost (travel expenses, if applicable - for onsite interviews)
    - Interview outcome (pending, completed, cancelled, no_show)
    - Cancellation reason (if cancelled, reason for cancellation)
    - Follow-up required (boolean - whether a follow-up email is needed)
    - Created at timestamp
    - Updated at timestamp
    - Note: Tracks all interviews related to job applications. Can reference either a Job or Resume Package. Round number helps track multiple interview rounds for the same application.

8 - Reminder/Notification - Reminders and notifications for job applications (belongs to User, references Job, Resume Package, or Interview)
    - Reminder type (follow_up, application_deadline, interview_reminder, status_check)
    - Title (short title for the reminder)
    - Description (detailed description of what the reminder is for)
    - Due date/time (when the reminder should trigger)
    - Timezone (timezone for the reminder, defaults to user's timezone)
    - Notification channel (email, sms, push, in_app)
    - Recurrence pattern (one_time, daily, weekly, monthly)
    - Reminder status (pending, completed, dismissed, snoozed)
    - Snooze until (if snoozed, when to remind again)
    - Notification sent (boolean - whether notification was sent)
    - Notification sent at (timestamp when notification was sent)
    - Notification delivery status (sent, delivered, failed, pending)
    - Notification read status (read, unread)
    - Notification priority (low, medium, high, urgent)
    - Created at timestamp
    - Updated at timestamp
    - Note: Can reference a Job (for deadline reminders), Resume Package (for follow-up reminders), or Interview (for interview reminders).

9 - Job Preferences/Saved Search - User preferences and saved job searches (belongs to User)
    - Search name (user-friendly name for the saved search)
    - Keywords (search keywords/phrases)
    - Exclude keywords (keywords to exclude from results)
    - Location preferences (JSON array of locations: cities, states, "Remote", etc.)
    - Job location type preferences (JSON array: remote, hybrid, onsite)
    - Job type preferences (JSON array: full-time, part-time, contract, internship)
    - Job level preferences (JSON array: entry, mid, senior, executive)
    - Salary range minimum (minimum desired salary)
    - Salary range maximum (maximum desired salary - optional)
    - Industry preferences (JSON array of industries)
    - Company preferences (JSON array of company names to include/exclude)
    - Minimum match score threshold (minimum assessment score to show jobs)
    - Search frequency (how often to run: daily, weekly, monthly, manual)
    - Notification preferences (JSON: {"email": true, "in_app": true} - how to notify when jobs found)
    - Search results count threshold (only notify if X+ jobs found)
    - Active (boolean - whether this search is currently active)
    - Last run at (timestamp when this search was last executed)
    - Created at timestamp
    - Updated at timestamp
    - Note: Saved searches can be used to automatically filter and notify users of new matching jobs.

10 - Application Note - General notes and journaling for applications (belongs to User, references Job or Resume Package)
    - Note title (optional short title)
    - Note content (full text of the note)
    - Note type (general, company_research, salary_negotiation, interview_prep, other)
    - Tags (JSON array of tags for categorization)
    - Created at timestamp
    - Updated at timestamp
    - Note: Separate from email notes and interview notes. Used for general application journaling, company research, salary negotiation planning, etc.

11 - Offer - Job offer management and negotiation (belongs to User, references Job or Resume Package)
    - Offer status (pending, accepted, rejected, expired, withdrawn, negotiating)
    - Base salary (annual base salary amount)
    - Salary currency (e.g., "USD", "EUR")
    - Sign-on bonus (one-time signing bonus amount)
    - Bonus amount (annual bonus amount, if applicable)
    - Equity/stock options (description or value of equity compensation)
    - Stock vesting schedule (JSON: vesting timeline and details)
    - Relocation assistance (amount or description of relocation package)
    - Benefits summary (JSON object or text describing benefits package - health insurance, 401k, PTO, etc.)
    - Benefits details breakdown (JSON: {"health_insurance": "...", "dental": "...", "vision": "...", "401k_match": "...", "pto_days": 20})
    - PTO/vacation days (number of paid time off days)
    - Work from home policy (days per week/month allowed to work from home)
    - Offer letter file/document (URL to offer letter PDF/document)
    - Start date (proposed start date)
    - Offer expiration date (deadline to respond to offer)
    - Offer date (when the offer was received)
    - Response date (when offer was accepted/rejected)
    - Negotiation history (JSON array of negotiation steps: {"date": "...", "type": "counter_offer" | "request" | "response", "details": "...", "salary": ...})
    - Counter offer details (if user made a counter offer - salary, benefits, etc.)
    - Notes (user notes about the offer, negotiation strategy, etc.)
    - Created at timestamp
    - Updated at timestamp
    - Note: Tracks job offers, negotiation history, and acceptance/rejection. Can reference either a Job or Resume Package.

12 - Reference - Professional references provided to employers (belongs to User)
    - Reference name (full name)
    - Reference title/position (their job title)
    - Company (company where reference works/worked)
    - Email address
    - Phone number (optional)
    - Relationship (e.g., "former_manager", "colleague", "client", "professor")
    - Years known (how long user has known this reference)
    - Relationship strength (strong, moderate, weak)
    - Permission status (permission_given, permission_pending, permission_denied, not_asked)
    - Availability (available, unavailable, limited)
    - Reference provided date (when reference was actually provided to employer)
    - Context (notes about the relationship, what they can speak to, etc.)
    - Provided for jobs (JSON array of Job IDs or Resume Package IDs where this reference was provided)
    - Created at timestamp
    - Updated at timestamp
    - Note: Tracks professional references that can be provided to employers. Can be linked to specific applications.

13 - Document - Supporting documents and attachments (belongs to User, references Job or Resume Package)
    - Document type (portfolio, certificate, transcript, writing_sample, other)
    - Document name/title (user-friendly name for the document)
    - File URL (URL to document file storage location)
    - File path/key (storage path or object key for the document file)
    - Storage type (e.g., "s3", "local", "object-storage")
    - File size (file size in bytes)
    - File format (e.g., "pdf", "docx", "jpg", "url")
    - Document expiration date (for certificates with expiration dates)
    - Document issuer/authority (who issued the certificate or document)
    - Document verification status (verified, unverified, expired)
    - Description (optional description of the document)
    - Tags (JSON array of tags for categorization)
    - Created at timestamp
    - Updated at timestamp
    - Note: Stores portfolio links/files, certificates, transcripts, writing samples, and other supporting documents. Can be linked to specific jobs or resume packages.

14 - Learning Progress - Tracking progress on gap-filling resources (belongs to User, references Assessment)
    - Resource URL (the learning resource URL from the Assessment)
    - Resource type (training, certification, schooling)
    - Resource title (title of the learning resource)
    - Resource provider/platform (e.g., "Coursera", "Udemy", "edX", "university_name")
    - Resource cost (cost of the resource, if paid)
    - Resource duration (expected hours/days to complete)
    - Resource difficulty level (beginner, intermediate, advanced)
    - Progress status (not_started, in_progress, completed, abandoned)
    - Completion percentage (0-100, if applicable)
    - Started at (timestamp when user started the resource)
    - Completed at (timestamp when user completed the resource)
    - Completion certificate (file URL if certificate was earned)
    - Resource rating (user's rating of the resource: 1-5 stars)
    - Notes (user notes about the learning experience, key takeaways, etc.)
    - Skills improved (JSON array of Skill IDs that this resource helped improve)
    - Created at timestamp
    - Updated at timestamp
    - Note: Tracks user progress on learning resources identified in Assessments. Links completed learning to skill improvements.

15 - Company - Company research and information database (belongs to User)
    - Company name (official company name)
    - Industry
    - Company size (e.g., "startup", "50-200", "1000+")
    - Headquarters location (city, state, country)
    - Company website
    - Company logo URL (URL to company logo image)
    - Company social media links (JSON: {"linkedin": "...", "twitter": "...", "facebook": "...", "github": "..."})
    - Company stock ticker (if public company, e.g., "AAPL", "GOOGL")
    - Company description (overview of the company)
    - Company culture notes (user's research notes about company culture)
    - Benefits overview (general benefits information about the company)
    - Glassdoor rating (if available)
    - Company contacts (JSON array of contacts: {"name": "...", "title": "...", "email": "...", "linkedin": "...", "notes": "..."})
    - Research notes (user's research notes about the company)
    - Tags (JSON array of tags for categorization)
    - Created at timestamp
    - Updated at timestamp
    - Note: Centralized company information separate from individual job postings. Can be referenced by multiple Jobs and Application Notes.

16 - Skills Progress - Tracking skill improvement over time (belongs to User, references Skill)
    - Skill ID (reference to the Skill entity)
    - Assessment date (when this skill assessment was recorded)
    - Skill level (self-assessed or AI-assessed level: beginner, intermediate, advanced, expert)
    - Confidence score (0-100, user's confidence in this skill)
    - Skill assessment method (self, test, certification, project, peer_review, ai_assessment)
    - Skill verification (proof/documentation of skill level - link to certificate, project, test result)
    - Skill usage frequency (daily, weekly, monthly, rarely)
    - Evidence (text describing evidence of skill improvement - projects, certifications, etc.)
    - Related learning resources (JSON array of Learning Progress IDs that contributed to this improvement)
    - Created at timestamp
    - Updated at timestamp
    - Note: Tracks how skills improve over time. Can be linked to completed learning resources and certifications.

---

## Analytics and Reporting

While not stored as separate entities, the following analytics can be computed from the data model:

- **Application Success Metrics**: Application success rate, response rate, interview conversion rate, offer acceptance rate
- **Skills Demand Analysis**: Most common skills in job postings, most common gaps across assessments
- **Salary Trends**: Average salary by job level, industry, location
- **Time Metrics**: Average time to response, time to interview, time to offer
- **Rejection Patterns**: Most common rejection reasons, patterns in rejections
- **Learning Effectiveness**: Which learning resources most effectively improve skills and assessment scores

These metrics can be computed on-demand from existing entities or pre-computed and cached for dashboard display.
