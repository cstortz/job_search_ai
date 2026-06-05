import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../../src/lib/server/current-user";
import { chatRepository } from "../../../../../src/lib/server/repositories";

export const runtime = "nodejs";

function sseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

function tokenize(text: string): string[] {
  // Keep spaces around tokens so the client can append data directly.
  const chunks = text.match(/\S+\s*/g);
  return chunks && chunks.length > 0 ? chunks : [text];
}

function normalizeStreamPayload(
  streamPayload: unknown,
): Record<string, unknown> | null {
  if (!streamPayload) {
    return null;
  }
  if (typeof streamPayload === "string") {
    try {
      const parsed = JSON.parse(streamPayload) as unknown;
      return normalizeStreamPayload(parsed);
    } catch {
      return null;
    }
  }
  if (typeof streamPayload === "object") {
    return streamPayload as Record<string, unknown>;
  }
  return null;
}

function extractAssistantPayload(
  streamPayload: unknown,
): {
  assistantResponse: string;
  model: string | null;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
} | null {
  const payload = normalizeStreamPayload(streamPayload);
  if (!payload) {
    return null;
  }
  const responseText = payload.assistantResponse;
  if (typeof responseText !== "string" || !responseText.trim()) {
    return null;
  }

  const modelValue = payload.model;
  const usageValue = payload.usage;

  const usage =
    usageValue && typeof usageValue === "object"
      ? {
          promptTokens:
            typeof (usageValue as { promptTokens?: unknown }).promptTokens === "number"
              ? (usageValue as { promptTokens: number }).promptTokens
              : undefined,
          completionTokens:
            typeof (usageValue as { completionTokens?: unknown }).completionTokens ===
            "number"
              ? (usageValue as { completionTokens: number }).completionTokens
              : undefined,
          totalTokens:
            typeof (usageValue as { totalTokens?: unknown }).totalTokens === "number"
              ? (usageValue as { totalTokens: number }).totalTokens
              : undefined,
        }
      : null;

  return {
    assistantResponse: responseText,
    model: typeof modelValue === "string" ? modelValue : null,
    usage,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user } = await getOrCreateCurrentUser();
    const { sessionId } = await params;

    const streamSession = await chatRepository.getStreamSessionForUser(
      sessionId,
      user.id,
    );
    if (!streamSession) {
      return NextResponse.json(
        { error: "Session not found or expired." },
        { status: 404 },
      );
    }
    const assistantPayload = extractAssistantPayload(streamSession.stream_payload);
    if (!assistantPayload) {
      return NextResponse.json(
        { error: "Session payload is missing assistant response." },
        { status: 500 },
      );
    }

    const encoder = new TextEncoder();
    const tokens = tokenize(assistantPayload.assistantResponse);

    await chatRepository.updateStreamSessionStatus(
      sessionId,
      user.id,
      "streaming",
      null,
    );

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const token of tokens) {
            controller.enqueue(encoder.encode(sseEvent("token", token)));
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          await chatRepository.insertMessage({
            conversationId: streamSession.conversation_id,
            userId: user.id,
            role: "assistant",
            contentText: assistantPayload.assistantResponse,
            model: assistantPayload.model,
            promptTokens: assistantPayload.usage?.promptTokens,
            completionTokens: assistantPayload.usage?.completionTokens,
            totalTokens: assistantPayload.usage?.totalTokens,
          });
          await chatRepository.touchConversationLastMessageAt(
            streamSession.conversation_id,
            user.id,
          );
          await chatRepository.updateStreamSessionStatus(
            sessionId,
            user.id,
            "done",
            null,
          );
          controller.enqueue(encoder.encode(sseEvent("done", "")));
          controller.close();
        } catch {
          await chatRepository.updateStreamSessionStatus(
            sessionId,
            user.id,
            "error",
            "Failed to stream chat response.",
          );
          controller.error(new Error("Failed to stream chat response."));
        }
      },
      async cancel() {
        await chatRepository.updateStreamSessionStatus(
          sessionId,
          user.id,
          "expired",
          "Client disconnected before stream completion.",
        );
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
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
    return NextResponse.json({ error: "Failed to stream chat." }, { status: 500 });
  }
}
