import { NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../src/lib/server/current-user";
import { chatRepository } from "../../../../src/lib/server/repositories";

export async function GET() {
  try {
    const { user } = await getOrCreateCurrentUser();
    const conversations = await chatRepository.listConversationsByUser(user.id);
    return NextResponse.json({ conversations });
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
      { error: "Failed to fetch conversations." },
      { status: 500 },
    );
  }
}
