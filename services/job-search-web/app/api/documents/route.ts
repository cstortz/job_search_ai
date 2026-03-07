import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../src/lib/server/current-user";
import { documentRepository } from "../../../src/lib/server/repositories";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getOrCreateCurrentUser();
    const userId = user.id;
    const documents = await documentRepository.listByUserId(userId);
    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (isPreparedClientError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch documents." },
      { status: 500 },
    );
  }
}
