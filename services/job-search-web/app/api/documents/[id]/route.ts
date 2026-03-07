import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../src/lib/server/current-user";
import { documentRepository } from "../../../../src/lib/server/repositories";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { user } = await getOrCreateCurrentUser();
    const userId = user.id;
    const document = await documentRepository.findByIdForUser(id, userId);
    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ document });
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
      { error: "Failed to fetch document." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { user } = await getOrCreateCurrentUser();
    const userId = user.id;
    const affectedRows = await documentRepository.deleteByIdForUser(id, userId);
    if (affectedRows < 1) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true, affectedRows, id });
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
      { error: "Failed to delete document." },
      { status: 500 },
    );
  }
}
