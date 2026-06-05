import "server-only";

export type PreparedOperationType =
  | "read"
  | "insert"
  | "update"
  | "delete"
  | "execute";

export interface PreparedSQLRequest {
  sql: string;
  parameters?: Record<string, unknown> | null;
  operation_type?: PreparedOperationType | string;
}

export interface PreparedSelectRequest {
  sql: string;
  parameters?: Record<string, unknown> | null;
}

export interface PreparedInsertRequest {
  sql: string;
  parameters?: Record<string, unknown> | null;
}

export interface PreparedUpdateRequest {
  sql: string;
  parameters?: Record<string, unknown> | null;
}

export interface PreparedDeleteRequest {
  sql: string;
  parameters?: Record<string, unknown> | null;
}

export interface PreparedSQLResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T[] | null;
  row_count: number | null;
  affected_rows: number | null;
  sql: string;
  parameters: Record<string, unknown> | null;
}

export interface ValidationResponse {
  valid: boolean;
  message: string;
  sql: string;
  parameters: Record<string, unknown> | null;
  placeholder_count: number | null;
  parameter_count: number | null;
  operation_type: string | null;
  error: string | null;
}

export interface PreparedStatementInfo {
  name: string;
  sql: string;
  parameter_count: number;
  created_at: string;
}

export interface StatementsResponse {
  statements: PreparedStatementInfo[];
  count: number;
  message: string;
}

export interface PreparedClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  headers?: HeadersInit;
}

export class PreparedClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "PreparedClientError";
    this.status = status;
    this.details = details;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BASE_URL = "http://dev01.int.stortz.tech:8000";

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function endpoint(path: string, baseUrl: string): string {
  return `${normalizedBaseUrl(baseUrl)}${path}`;
}

function extractApiErrorDetail(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const detail = record.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) {
      const message = (first as { msg?: unknown }).msg;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  return null;
}

function toClientMessage(
  status: number,
  fallback: string,
  parsed?: unknown,
): string {
  const detail = extractApiErrorDetail(parsed);
  if (detail) {
    return detail;
  }

  if (status === 401 || status === 403) {
    return "Database API authorization failed.";
  }
  if (status === 404) {
    return "Requested Prepared SQL endpoint was not found.";
  }
  if (status === 422) {
    return "Prepared SQL request validation failed.";
  }
  if (status >= 500) {
    return "Database API returned a server error.";
  }
  return fallback;
}

function parseJsonIfPossible(rawText: string): unknown {
  if (!rawText) {
    return null;
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

export class PreparedClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly headers: HeadersInit | undefined;

  constructor(config: PreparedClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ??
      process.env.DB_API_BASE_URL ??
      process.env.NEXT_PUBLIC_DB_API_BASE_URL ??
      DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.headers = config.headers;
  }

  private async request<TResponse>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint(path, this.baseUrl), {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(this.headers ?? {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });

      const rawText = await response.text();
      const parsed = parseJsonIfPossible(rawText);

      if (!response.ok) {
        const fallback = `Prepared SQL API request failed with status ${response.status}.`;
        throw new PreparedClientError(
          toClientMessage(response.status, fallback, parsed),
          response.status,
          parsed,
        );
      }

      return parsed as TResponse;
    } catch (error) {
      if (error instanceof PreparedClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new PreparedClientError(
          `Prepared SQL API request timed out after ${this.timeoutMs}ms.`,
          408,
        );
      }
      throw new PreparedClientError(
        "Prepared SQL API request failed due to a network or runtime error.",
        0,
        error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async preparedSelect<T = unknown>(
    request: PreparedSelectRequest,
  ): Promise<PreparedSQLResponse<T>> {
    return this.request<PreparedSQLResponse<T>>(
      "POST",
      "/crud/prepared/select",
      request,
    );
  }

  async preparedInsert<T = unknown>(
    request: PreparedInsertRequest,
  ): Promise<PreparedSQLResponse<T>> {
    return this.request<PreparedSQLResponse<T>>(
      "POST",
      "/crud/prepared/insert",
      request,
    );
  }

  async preparedUpdate<T = unknown>(
    request: PreparedUpdateRequest,
  ): Promise<PreparedSQLResponse<T>> {
    return this.request<PreparedSQLResponse<T>>(
      "POST",
      "/crud/prepared/update",
      request,
    );
  }

  async preparedDelete<T = unknown>(
    request: PreparedDeleteRequest,
  ): Promise<PreparedSQLResponse<T>> {
    return this.request<PreparedSQLResponse<T>>(
      "POST",
      "/crud/prepared/delete",
      request,
    );
  }

  async preparedExecute<T = unknown>(
    request: PreparedSQLRequest,
  ): Promise<PreparedSQLResponse<T>> {
    return this.request<PreparedSQLResponse<T>>(
      "POST",
      "/crud/prepared/execute",
      request,
    );
  }

  async validatePreparedSql(
    request: PreparedSQLRequest,
  ): Promise<ValidationResponse> {
    return this.request<ValidationResponse>(
      "POST",
      "/crud/prepared/validate",
      request,
    );
  }

  async getPreparedStatements(): Promise<StatementsResponse> {
    return this.request<StatementsResponse>("GET", "/crud/prepared/statements");
  }

  async clearPreparedStatements(): Promise<unknown> {
    return this.request<unknown>("DELETE", "/crud/prepared/statements");
  }

  async clearPreparedStatement(statementName: string): Promise<unknown> {
    const encodedName = encodeURIComponent(statementName);
    return this.request<unknown>(
      "DELETE",
      `/crud/prepared/statements/${encodedName}`,
    );
  }
}

export function createPreparedClient(
  config?: PreparedClientConfig,
): PreparedClient {
  return new PreparedClient(config);
}
