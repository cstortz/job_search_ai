import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../../src/lib/server/current-user";
import { chatRepository } from "../../../../../src/lib/server/repositories";

interface PatchConversationBody {
  title?: string | null;
}

function validatePatchBody(body: PatchConversationBody): string | null {
  if (!body || typeof body !== "object") {
    return "Invalid JSON body.";
  }
  if (!Object.prototype.hasOwnProperty.call(body, "title")) {
    return "Missing required field: title.";
  }
  if (body.title !== null && typeof body.title !== "string") {
    return "title must be a string or null.";
  }
  if (typeof body.title === "string" && body.title.trim().length > 500) {
    return "title must be 500 characters or fewer.";
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  let body: PatchConversationBody;
  try {
    body = (await request.json()) as PatchConversationBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validatePatchBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateCurrentUser();
    const { conversationId } = await params;

    const normalizedTitle =
      typeof body.title === "string" ? body.title.trim() || null : null;

    const conversation = await chatRepository.updateConversationTitleForUser(
      conversationId,
      user.id,
      normalizedTitle,
    );
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation });
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
    return NextResponse.json(
      { error: "Failed to update conversation title." },
      { status: 500 },
    );
  }
}
