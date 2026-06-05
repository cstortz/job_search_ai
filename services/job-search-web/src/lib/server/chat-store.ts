import "server-only";

export interface ChatMessageRequest {
  text: string;
  conversationId?: string | null;
  attachmentIds?: string[];
}

interface PendingChatSession {
  sessionId: string;
  userId: string;
  conversationId: string;
  text: string;
  attachmentIds: string[];
  assistantResponse: string;
  createdAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000;

function getStore(): Map<string, PendingChatSession> {
  const globalRef = globalThis as unknown as {
    __jobSearchChatSessions?: Map<string, PendingChatSession>;
  };
  if (!globalRef.__jobSearchChatSessions) {
    globalRef.__jobSearchChatSessions = new Map<string, PendingChatSession>();
  }
  return globalRef.__jobSearchChatSessions;
}

function cleanExpiredSessions(): void {
  const now = Date.now();
  const store = getStore();
  for (const [sessionId, session] of store.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      store.delete(sessionId);
    }
  }
}

function buildAssistantResponse(text: string, attachmentCount: number): string {
  if (attachmentCount > 0) {
    return `Got it. I received your message and ${attachmentCount} attachment(s). I will use them while helping with your request: "${text}"`;
  }
  return `Got it. I received your message: "${text}". What would you like me to do next?`;
}

export function createChatSession(
  userId: string,
  payload: ChatMessageRequest,
): { sessionId: string; conversationId: string } {
  cleanExpiredSessions();

  const sessionId = crypto.randomUUID();
  const conversationId = payload.conversationId || crypto.randomUUID();
  const attachmentIds = payload.attachmentIds ?? [];

  const session: PendingChatSession = {
    sessionId,
    userId,
    conversationId,
    text: payload.text,
    attachmentIds,
    assistantResponse: buildAssistantResponse(payload.text, attachmentIds.length),
    createdAt: Date.now(),
  };

  getStore().set(sessionId, session);
  return { sessionId, conversationId };
}

export function getChatSession(
  sessionId: string,
  userId: string,
): PendingChatSession | null {
  cleanExpiredSessions();
  const session = getStore().get(sessionId);
  if (!session) {
    return null;
  }
  if (session.userId !== userId) {
    return null;
  }
  return session;
}

export function closeChatSession(sessionId: string): void {
  getStore().delete(sessionId);
}
