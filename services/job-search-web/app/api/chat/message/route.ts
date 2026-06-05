import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../../src/lib/db/db-repository";
import { ChatMessageRequest } from "../../../../src/lib/server/chat-store";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../src/lib/server/current-user";
import {
  LlmConfigurationError,
  LlmProviderRequestError,
  generateAssistantText,
} from "../../../../src/lib/server/llm";
import { chatRepository } from "../../../../src/lib/server/repositories";

function validateRequestBody(body: ChatMessageRequest): string | null {
  if (!body || typeof body !== "object") {
    return "Invalid JSON body.";
  }
  if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
    return "Missing required field: text.";
  }
  if (
    body.conversationId !== undefined &&
    body.conversationId !== null &&
    typeof body.conversationId !== "string"
  ) {
    return "conversationId must be a string when provided.";
  }
  if (
    body.attachmentIds !== undefined &&
    (!Array.isArray(body.attachmentIds) ||
      body.attachmentIds.some((item) => typeof item !== "string"))
  ) {
    return "attachmentIds must be an array of strings.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: ChatMessageRequest;
  try {
    body = (await request.json()) as ChatMessageRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateRequestBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateCurrentUser();
    const trimmedText = body.text.trim();

    let conversationId = body.conversationId ?? null;
    if (conversationId) {
      const existingConversation = await chatRepository.getConversationByIdForUser(
        conversationId,
        user.id,
      );
      if (!existingConversation) {
        conversationId = null;
      }
    }
    if (!conversationId) {
      const createdConversation = await chatRepository.createConversationForUser(
        user.id,
      );
      if (!createdConversation) {
        return NextResponse.json(
          { error: "Failed to create conversation." },
          { status: 500 },
        );
      }
      conversationId = createdConversation.id;
    }

    const userMessage = await chatRepository.insertMessage({
      conversationId,
      userId: user.id,
      role: "user",
      contentText: trimmedText,
      attachmentDocumentIds: body.attachmentIds ?? [],
    });
    if (!userMessage) {
      return NextResponse.json(
        { error: "Failed to save chat message." },
        { status: 500 },
      );
    }

    await chatRepository.touchConversationLastMessageAt(conversationId, user.id);

    const messageHistory = await chatRepository.listMessagesByConversationForUser(
      conversationId,
      user.id,
    );
    const llmResult = await generateAssistantText({
      messages: messageHistory.map((message) => ({
        role: message.role,
        content: message.content_text,
      })),
    });

    const assistantResponse = llmResult.text;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const streamSession = await chatRepository.createStreamSession({
      conversationId,
      userId: user.id,
      requestMessageId: userMessage.id,
      streamPayload: {
        assistantResponse,
        provider: llmResult.provider,
        model: llmResult.model,
        usage: llmResult.usage ?? null,
        attachmentIds: body.attachmentIds ?? [],
      },
      expiresAt,
    });
    if (!streamSession) {
      return NextResponse.json(
        { error: "Failed to create stream session." },
        { status: 500 },
      );
    }

    return NextResponse.json({ sessionId: streamSession.id, conversationId });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof DatabaseOperationError) {
      return NextResponse.json(
        { error: error.message || "Database operation failed." },
        { status: 500 },
      );
    }
    if (error instanceof LlmConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof LlmProviderRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 502 },
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to create chat session." },
      { status: 500 },
    );
  }
}
