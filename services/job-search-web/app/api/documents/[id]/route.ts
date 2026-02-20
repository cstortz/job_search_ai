import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../../src/lib/db/db-repository";
import { documentRepository } from "../../../../src/lib/server/repositories";

function getUserId(request: NextRequest): string | null {
  return request.headers.get("x-user-id");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Missing x-user-id header." },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const affectedRows = await documentRepository.deleteByIdForUser(id, userId);
    if (affectedRows < 1) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true, affectedRows, id });
  } catch (error) {
    if (isPreparedClientError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 },
    );
  }
}
