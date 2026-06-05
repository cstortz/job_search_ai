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

export interface PostChatMessageRequest {
  text: string;
  conversationId?: string | null;
  attachmentIds?: string[];
}

export interface PostChatMessageResponse {
  sessionId: string;
  conversationId: string;
}

export interface ListConversationsResponse {
  conversations: ChatConversationRecord[];
}

export interface ListConversationMessagesResponse {
  conversation: ChatConversationRecord;
  messages: ChatMessageRecord[];
}

export interface PatchConversationTitleResponse {
  conversation: ChatConversationRecord;
}

export interface ApiErrorBody {
  error?: string;
}

export class ApiRequestError extends Error {
  status: number;
  body?: ApiErrorBody;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

async function requestJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let parsedBody: unknown = null;
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const body = (parsedBody ?? undefined) as ApiErrorBody | undefined;
    throw new ApiRequestError(
      response.status,
      body?.error || `Request failed with status ${response.status}.`,
      body,
    );
  }

  return parsedBody as T;
}

export async function postChatMessage(
  payload: PostChatMessageRequest,
): Promise<PostChatMessageResponse> {
  return requestJson<PostChatMessageResponse>("/api/chat/message", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listChatConversations(): Promise<ListConversationsResponse> {
  return requestJson<ListConversationsResponse>("/api/chat/conversations", {
    method: "GET",
  });
}

export async function listChatConversationMessages(
  conversationId: string,
): Promise<ListConversationMessagesResponse> {
  return requestJson<ListConversationMessagesResponse>(
    `/api/chat/conversations/${conversationId}/messages`,
    { method: "GET" },
  );
}

export async function patchChatConversationTitle(
  conversationId: string,
  title: string | null,
): Promise<PatchConversationTitleResponse> {
  return requestJson<PatchConversationTitleResponse>(
    `/api/chat/conversations/${conversationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title }),
    },
  );
}

export function buildChatStreamUrl(sessionId: string): string {
  return `/api/chat/stream/${sessionId}`;
}

export function openChatStream(
  sessionId: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError?: (event: Event) => void,
): EventSource {
  const source = new EventSource(buildChatStreamUrl(sessionId), {
    withCredentials: true,
  });

  source.addEventListener("token", (event) => {
    if (event instanceof MessageEvent) {
      onToken(event.data);
    }
  });

  source.addEventListener("done", () => {
    onDone();
    source.close();
  });

  if (onError) {
    source.addEventListener("error", onError);
  }

  return source;
}
