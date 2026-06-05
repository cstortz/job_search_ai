import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../../../src/lib/server/current-user";
import { chatRepository } from "../../../../../../src/lib/server/repositories";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  void request;

  try {
    const { user } = await getOrCreateCurrentUser();
    const { conversationId } = await params;

    const conversation = await chatRepository.getConversationByIdForUser(
      conversationId,
      user.id,
    );
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    const messages = await chatRepository.listMessagesByConversationForUser(
      conversationId,
      user.id,
    );
    return NextResponse.json({ conversation, messages });
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
    return NextResponse.json({ error: "Failed to fetch messages." }, { status: 500 });
  }
}
