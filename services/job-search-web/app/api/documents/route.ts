import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../src/lib/db/db-repository";
import { documentRepository } from "../../../src/lib/server/repositories";

function getUserId(request: NextRequest): string | null {
  return request.headers.get("x-user-id");
}

export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Missing x-user-id header." },
      { status: 401 },
    );
  }

  try {
    const documents = await documentRepository.listByUserId(userId);
    return NextResponse.json({ documents });
  } catch (error) {
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
