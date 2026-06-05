import "server-only";

import {
  PreparedClient,
  PreparedClientError,
  PreparedDeleteRequest,
  PreparedInsertRequest,
  PreparedSQLResponse,
  PreparedSelectRequest,
  PreparedUpdateRequest,
  ValidationResponse,
  createPreparedClient,
} from "./prepared-client";

export class DatabaseOperationError extends Error {
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "DatabaseOperationError";
    this.details = details;
  }
}

function ensureSuccess<T>(response: PreparedSQLResponse<T>): PreparedSQLResponse<T> {
  if (!response.success) {
    throw new DatabaseOperationError(
      response.message || "Prepared SQL operation failed.",
      response,
    );
  }
  return response;
}

/**
 * Generic repository helper that centralizes Prepared SQL usage.
 * Feature repositories should extend this class and expose domain methods.
 */
export class PreparedRepository {
  protected readonly client: PreparedClient;

  constructor(client: PreparedClient = createPreparedClient()) {
    this.client = client;
  }

  protected async selectMany<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<T[]> {
    const request: PreparedSelectRequest = { sql, parameters: parameters ?? null };
    const response = await this.client.preparedSelect<T>(request);
    return ensureSuccess(response).data ?? [];
  }

  protected async selectOne<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<T | null> {
    const rows = await this.selectMany<T>(sql, parameters);
    return rows.length > 0 ? rows[0] : null;
  }

  protected async insert<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<PreparedSQLResponse<T>> {
    const request: PreparedInsertRequest = { sql, parameters: parameters ?? null };
    return ensureSuccess(await this.client.preparedInsert<T>(request));
  }

  protected async update<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<PreparedSQLResponse<T>> {
    const request: PreparedUpdateRequest = { sql, parameters: parameters ?? null };
    return ensureSuccess(await this.client.preparedUpdate<T>(request));
  }

  protected async delete<T>(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<PreparedSQLResponse<T>> {
    const request: PreparedDeleteRequest = { sql, parameters: parameters ?? null };
    return ensureSuccess(await this.client.preparedDelete<T>(request));
  }

  protected async validate(
    sql: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<ValidationResponse> {
    const response = await this.client.validatePreparedSql({
      sql,
      parameters: parameters ?? null,
      operation_type: "read",
    });

    if (!response.valid) {
      throw new DatabaseOperationError(
        response.message || "Prepared SQL validation failed.",
        response,
      );
    }

    return response;
  }
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: "processing" | "ready" | "error";
  uploaded_at: string;
}

export interface DocumentSqlTemplates {
  listDocumentsByUser: string;
  findDocumentByIdForUser: string;
  deleteDocumentByIdForUser: string;
  insertUploadedDocument: string;
}

export interface UserRecord {
  id: string;
  auth0_subject_id: string;
  name: string;
  email: string;
  email_verified: boolean;
  phone: string | null;
  linkedin_url: string | null;
  other_urls: unknown;
  address: string | null;
  resume_field_includes: Record<string, boolean> | null;
  notification_preferences: Record<string, boolean> | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSqlTemplates {
  upsertUserByAuth0Subject: string;
  findUserByAuth0Subject: string;
}

export interface ChatConversationRecord {
  id: string;
  user_id: string;
  title: string | null;
  skill_type: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content_text: string;
  attachment_document_ids: string[] | null;
  skill_type: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatStreamSessionRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  request_message_id: string | null;
  status: "pending" | "streaming" | "done" | "error" | "expired";
  stream_payload: unknown;
  error_message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSqlTemplates {
  findConversationByIdForUser: string;
  listConversationsByUser: string;
  listMessagesByConversationForUser: string;
  updateConversationTitleForUser: string;
  createConversationForUser: string;
  touchConversationLastMessageAt: string;
  insertMessage: string;
  createStreamSession: string;
  getStreamSessionForUser: string;
  updateStreamSessionStatus: string;
}

export interface JobSiteRecord {
  id: string;
  user_id: string;
  company: string | null;
  industry: string | null;
  us_postal_address: string | null;
  url: string;
  frequency: string | null;
  last_polled_at: string | null;
  enabled: boolean;
  last_error_message: string | null;
  error_count: number;
  timezone: string | null;
  authentication_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobListingRecord {
  id: string;
  user_id: string;
  job_source_id: string | null;
  job_title: string;
  company_name: string;
  job_description_text: string | null;
  requirements_text: string | null;
  application_url: string | null;
  job_url: string;
  external_job_id: string | null;
  posting_date: string | null;
  salary_range: unknown;
  location: string | null;
  job_location_type: string | null;
  job_type: string | null;
  job_level: string | null;
  application_deadline: string | null;
  user_interest_level: string | null;
  user_tags: unknown;
  status: string;
  first_seen_at: string | null;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumePacketRecord {
  id: string;
  user_id: string;
  job_id: string;
  status: string | null;
  application_status: string | null;
  date_applied: string | null;
  date_of_last_status_change: string | null;
  application_method: string | null;
  application_tracking_number: string | null;
  portal_url: string | null;
  version_number: number | null;
  parent_resume_package_id: string | null;
  resume_file_url: string | null;
  resume_file_path: string | null;
  resume_storage_type: string | null;
  resume_file_size: number | null;
  resume_file_format: string | null;
  cover_letter_file_url: string | null;
  cover_letter_file_path: string | null;
  cover_letter_storage_type: string | null;
  cover_letter_file_size: number | null;
  cover_letter_file_format: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobSqlTemplates {
  listJobSitesByUser: string;
  findJobSiteByIdForUser: string;
  insertJobSiteForUser: string;
  updateJobSiteForUser: string;
  deleteJobSiteForUser: string;
  listJobListingsByUser: string;
  insertJobListingForUser: string;
  findJobListingByIdForUser: string;
  updateJobListingStatusForUser: string;
  listResumePacketsByUser: string;
  insertResumePacketForUser: string;
}

export interface SkillRecord {
  id: string;
  user_id: string;
  skill_name: string;
  skill_category: string | null;
  description: string | null;
  years_of_experience: number | null;
  last_used_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillSqlTemplates {
  listSkillsByUser: string;
  findSkillByIdForUser: string;
  insertSkillForUser: string;
  updateSkillForUser: string;
  deleteSkillForUser: string;
}

/**
 * Example domain repository.
 * Keep SQL here (server-side), never in UI/client components.
 */
export class DocumentRepository extends PreparedRepository {
  private readonly sql: DocumentSqlTemplates;

  constructor(
    sqlTemplates: DocumentSqlTemplates,
    client: PreparedClient = createPreparedClient(),
  ) {
    super(client);
    this.sql = sqlTemplates;
  }

  async listByUserId(userId: string): Promise<DocumentRecord[]> {
    return this.selectMany<DocumentRecord>(this.sql.listDocumentsByUser, {
      "1": userId,
    });
  }

  async findByIdForUser(
    documentId: string,
    userId: string,
  ): Promise<DocumentRecord | null> {
    return this.selectOne<DocumentRecord>(this.sql.findDocumentByIdForUser, {
      "1": documentId,
      "2": userId,
    });
  }

  async deleteByIdForUser(documentId: string, userId: string): Promise<number> {
    const response = await this.delete(this.sql.deleteDocumentByIdForUser, {
      "1": documentId,
      "2": userId,
    });
    return response.affected_rows ?? 0;
  }

  async createUploadedDocument(input: {
    userId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    filePath: string;
    fileUrl?: string | null;
  }): Promise<DocumentRecord | null> {
    const response = await this.insert<DocumentRecord>(
      this.sql.insertUploadedDocument,
      {
        "1": input.userId,
        "2": "other",
        "3": input.filename,
        "4": input.fileUrl ?? null,
        "5": input.filePath,
        "6": "local",
        "7": input.sizeBytes,
        "8": input.filename.includes(".")
          ? input.filename.split(".").pop()?.toLowerCase() ?? null
          : null,
        "9": "unverified",
        "10": JSON.stringify({ contentType: input.contentType }),
      },
    );

    return response.data?.[0] ?? null;
  }
}

export class UserRepository extends PreparedRepository {
  private readonly sql: UserSqlTemplates;

  constructor(
    sqlTemplates: UserSqlTemplates,
    client: PreparedClient = createPreparedClient(),
  ) {
    super(client);
    this.sql = sqlTemplates;
  }

  async upsertByAuth0Subject(input: {
    auth0SubjectId: string;
    email: string;
    name: string;
    emailVerified?: boolean;
    phone?: string | null;
    linkedinUrl?: string | null;
    otherUrlsJson?: string | null;
    address?: string | null;
    resumeFieldIncludesJson?: string | null;
    notificationPreferencesJson?: string | null;
    timezone?: string | null;
  }): Promise<UserRecord | null> {
    const response = await this.insert<UserRecord>(
      this.sql.upsertUserByAuth0Subject,
      {
        "1": input.auth0SubjectId,
        "2": input.name,
        "3": input.email,
        "4": input.emailVerified ?? false,
        "5": input.phone ?? null,
        "6": input.linkedinUrl ?? null,
        "7": input.timezone ?? "UTC",
        "8": input.otherUrlsJson ?? null,
        "9": input.address ?? null,
        "10": input.resumeFieldIncludesJson ?? null,
        "11": input.notificationPreferencesJson ?? null,
      },
    );

    return response.data?.[0] ?? null;
  }

  async findByAuth0Subject(auth0SubjectId: string): Promise<UserRecord | null> {
    return this.selectOne<UserRecord>(this.sql.findUserByAuth0Subject, {
      "1": auth0SubjectId,
    });
  }
}

export class ChatRepository extends PreparedRepository {
  private readonly sql: ChatSqlTemplates;

  constructor(
    sqlTemplates: ChatSqlTemplates,
    client: PreparedClient = createPreparedClient(),
  ) {
    super(client);
    this.sql = sqlTemplates;
  }

  async getConversationByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<ChatConversationRecord | null> {
    return this.selectOne<ChatConversationRecord>(
      this.sql.findConversationByIdForUser,
      { "1": conversationId, "2": userId },
    );
  }

  async listConversationsByUser(userId: string): Promise<ChatConversationRecord[]> {
    return this.selectMany<ChatConversationRecord>(this.sql.listConversationsByUser, {
      "1": userId,
    });
  }

  async updateConversationTitleForUser(
    conversationId: string,
    userId: string,
    title: string | null,
  ): Promise<ChatConversationRecord | null> {
    const response = await this.update<ChatConversationRecord>(
      this.sql.updateConversationTitleForUser,
      { "1": title, "2": conversationId, "3": userId },
    );
    return response.data?.[0] ?? null;
  }

  async createConversationForUser(userId: string): Promise<ChatConversationRecord | null> {
    const response = await this.insert<ChatConversationRecord>(
      this.sql.createConversationForUser,
      { "1": userId },
    );
    return response.data?.[0] ?? null;
  }

  async touchConversationLastMessageAt(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.update(this.sql.touchConversationLastMessageAt, {
      "1": conversationId,
      "2": userId,
    });
  }

  async insertMessage(input: {
    conversationId: string;
    userId: string;
    role: "user" | "assistant" | "system";
    contentText: string;
    attachmentDocumentIds?: string[] | null;
    skillType?: string | null;
    model?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
  }): Promise<ChatMessageRecord | null> {
    const response = await this.insert<ChatMessageRecord>(this.sql.insertMessage, {
      "1": input.conversationId,
      "2": input.userId,
      "3": input.role,
      "4": input.contentText,
      "5":
        input.attachmentDocumentIds && input.attachmentDocumentIds.length > 0
          ? JSON.stringify(input.attachmentDocumentIds)
          : null,
      "6": input.skillType ?? null,
      "7": input.model ?? null,
      "8": input.promptTokens ?? null,
      "9": input.completionTokens ?? null,
      "10": input.totalTokens ?? null,
    });
    return response.data?.[0] ?? null;
  }

  async createStreamSession(input: {
    conversationId: string;
    userId: string;
    requestMessageId: string | null;
    streamPayload: Record<string, unknown> | null;
    expiresAt: string | null;
  }): Promise<ChatStreamSessionRecord | null> {
    const response = await this.insert<ChatStreamSessionRecord>(
      this.sql.createStreamSession,
      {
        "1": input.conversationId,
        "2": input.userId,
        "3": input.requestMessageId,
        "4": input.streamPayload ? JSON.stringify(input.streamPayload) : null,
        "5": input.expiresAt,
      },
    );
    return response.data?.[0] ?? null;
  }

  async getStreamSessionForUser(
    sessionId: string,
    userId: string,
  ): Promise<ChatStreamSessionRecord | null> {
    return this.selectOne<ChatStreamSessionRecord>(
      this.sql.getStreamSessionForUser,
      { "1": sessionId, "2": userId },
    );
  }

  async listMessagesByConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<ChatMessageRecord[]> {
    return this.selectMany<ChatMessageRecord>(
      this.sql.listMessagesByConversationForUser,
      { "1": conversationId, "2": userId },
    );
  }

  async updateStreamSessionStatus(
    sessionId: string,
    userId: string,
    status: "pending" | "streaming" | "done" | "error" | "expired",
    errorMessage?: string | null,
  ): Promise<void> {
    await this.update(this.sql.updateStreamSessionStatus, {
      "1": status,
      "2": errorMessage ?? null,
      "3": sessionId,
      "4": userId,
    });
  }
}

export class JobRepository extends PreparedRepository {
  private readonly sql: JobSqlTemplates;

  constructor(
    sqlTemplates: JobSqlTemplates,
    client: PreparedClient = createPreparedClient(),
  ) {
    super(client);
    this.sql = sqlTemplates;
  }

  async listJobSitesByUser(userId: string): Promise<JobSiteRecord[]> {
    return this.selectMany<JobSiteRecord>(this.sql.listJobSitesByUser, {
      "1": userId,
    });
  }

  async findJobSiteByIdForUser(
    siteId: string,
    userId: string,
  ): Promise<JobSiteRecord | null> {
    return this.selectOne<JobSiteRecord>(this.sql.findJobSiteByIdForUser, {
      "1": siteId,
      "2": userId,
    });
  }

  async insertJobSiteForUser(input: {
    userId: string;
    url: string;
    company?: string | null;
    industry?: string | null;
    usPostalAddress?: string | null;
    frequency?: string | null;
    enabled?: boolean;
    timezone?: string | null;
    authenticationType?: string | null;
  }): Promise<JobSiteRecord | null> {
    const response = await this.insert<JobSiteRecord>(this.sql.insertJobSiteForUser, {
      "1": input.userId,
      "2": input.company ?? null,
      "3": input.industry ?? null,
      "4": input.usPostalAddress ?? null,
      "5": input.url,
      "6": input.frequency ?? null,
      "7": input.enabled ?? true,
      "8": input.timezone ?? "UTC",
      "9": input.authenticationType ?? null,
    });
    return response.data?.[0] ?? null;
  }

  async updateJobSiteForUser(input: {
    siteId: string;
    userId: string;
    url: string;
    company?: string | null;
    industry?: string | null;
    usPostalAddress?: string | null;
    frequency?: string | null;
    enabled?: boolean;
    timezone?: string | null;
    authenticationType?: string | null;
  }): Promise<JobSiteRecord | null> {
    const response = await this.update<JobSiteRecord>(this.sql.updateJobSiteForUser, {
      "1": input.company ?? null,
      "2": input.industry ?? null,
      "3": input.usPostalAddress ?? null,
      "4": input.url,
      "5": input.frequency ?? null,
      "6": input.enabled ?? true,
      "7": input.timezone ?? "UTC",
      "8": input.authenticationType ?? null,
      "9": input.siteId,
      "10": input.userId,
    });
    return response.data?.[0] ?? null;
  }

  async deleteJobSiteForUser(siteId: string, userId: string): Promise<number> {
    const response = await this.delete(this.sql.deleteJobSiteForUser, {
      "1": siteId,
      "2": userId,
    });
    return response.affected_rows ?? 0;
  }

  async listJobListingsByUser(input: {
    userId: string;
    status?: string | null;
    jobSourceId?: string | null;
  }): Promise<JobListingRecord[]> {
    return this.selectMany<JobListingRecord>(this.sql.listJobListingsByUser, {
      "1": input.userId,
      "2": input.status ?? null,
      "3": input.jobSourceId ?? null,
    });
  }

  async insertJobListingForUser(input: {
    userId: string;
    jobUrl: string;
    jobTitle: string;
    companyName: string;
    jobSourceId?: string | null;
    status?: string | null;
  }): Promise<JobListingRecord | null> {
    const response = await this.insert<JobListingRecord>(this.sql.insertJobListingForUser, {
      "1": input.userId,
      "2": input.jobSourceId ?? null,
      "3": input.jobTitle,
      "4": input.companyName,
      "5": input.jobUrl,
      "6": input.status ?? "active",
    });
    return response.data?.[0] ?? null;
  }

  async findJobListingByIdForUser(
    jobId: string,
    userId: string,
  ): Promise<JobListingRecord | null> {
    return this.selectOne<JobListingRecord>(this.sql.findJobListingByIdForUser, {
      "1": jobId,
      "2": userId,
    });
  }

  async updateJobListingStatusForUser(
    jobId: string,
    userId: string,
    status: string,
  ): Promise<JobListingRecord | null> {
    const response = await this.update<JobListingRecord>(
      this.sql.updateJobListingStatusForUser,
      {
        "1": status,
        "2": jobId,
        "3": userId,
      },
    );
    return response.data?.[0] ?? null;
  }

  async insertResumePacketForUser(input: {
    userId: string;
    jobId: string;
    status?: string | null;
  }): Promise<ResumePacketRecord | null> {
    const response = await this.insert<ResumePacketRecord>(
      this.sql.insertResumePacketForUser,
      {
        "1": input.userId,
        "2": input.jobId,
        "3": input.status ?? "draft",
      },
    );
    return response.data?.[0] ?? null;
  }

  async listResumePacketsByUser(input: {
    userId: string;
    jobId?: string | null;
    status?: string | null;
    applicationStatus?: string | null;
  }): Promise<ResumePacketRecord[]> {
    return this.selectMany<ResumePacketRecord>(this.sql.listResumePacketsByUser, {
      "1": input.userId,
      "2": input.jobId ?? null,
      "3": input.status ?? null,
      "4": input.applicationStatus ?? null,
    });
  }
}

export class SkillRepository extends PreparedRepository {
  private readonly sql: SkillSqlTemplates;

  constructor(
    sqlTemplates: SkillSqlTemplates,
    client: PreparedClient = createPreparedClient(),
  ) {
    super(client);
    this.sql = sqlTemplates;
  }

  async listSkillsByUser(userId: string): Promise<SkillRecord[]> {
    return this.selectMany<SkillRecord>(this.sql.listSkillsByUser, {
      "1": userId,
    });
  }

  async findSkillByIdForUser(
    skillId: string,
    userId: string,
  ): Promise<SkillRecord | null> {
    return this.selectOne<SkillRecord>(this.sql.findSkillByIdForUser, {
      "1": skillId,
      "2": userId,
    });
  }

  async insertSkillForUser(input: {
    userId: string;
    skillName: string;
    skillCategory?: string | null;
    description?: string | null;
    yearsOfExperience?: number | null;
    lastUsedDate?: string | null;
  }): Promise<SkillRecord | null> {
    const response = await this.insert<SkillRecord>(this.sql.insertSkillForUser, {
      "1": input.userId,
      "2": input.skillName,
      "3": input.skillCategory ?? null,
      "4": input.description ?? null,
      "5": input.yearsOfExperience ?? null,
      "6": input.lastUsedDate ?? null,
    });
    return response.data?.[0] ?? null;
  }

  async updateSkillForUser(input: {
    skillId: string;
    userId: string;
    skillName: string;
    skillCategory?: string | null;
    description?: string | null;
    yearsOfExperience?: number | null;
    lastUsedDate?: string | null;
  }): Promise<SkillRecord | null> {
    const response = await this.update<SkillRecord>(this.sql.updateSkillForUser, {
      "1": input.skillName,
      "2": input.skillCategory ?? null,
      "3": input.description ?? null,
      "4": input.yearsOfExperience ?? null,
      "5": input.lastUsedDate ?? null,
      "6": input.skillId,
      "7": input.userId,
    });
    return response.data?.[0] ?? null;
  }

  async deleteSkillForUser(skillId: string, userId: string): Promise<number> {
    const response = await this.delete(this.sql.deleteSkillForUser, {
      "1": skillId,
      "2": userId,
    });
    return response.affected_rows ?? 0;
  }
}

export function isPreparedClientError(error: unknown): error is PreparedClientError {
  return error instanceof PreparedClientError;
}

