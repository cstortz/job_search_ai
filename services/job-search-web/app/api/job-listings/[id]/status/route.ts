import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../../src/lib/server/current-user";
import { jobRepository } from "../../../../../src/lib/server/repositories";

interface PatchStatusBody {
  status?: string;
}

function validatePatchBody(body: PatchStatusBody): string | null {
  if (!body || typeof body !== "object") {
    return "Invalid JSON body.";
  }
  if (!body.status || typeof body.status !== "string" || !body.status.trim()) {
    return "Missing required field: status.";
  }
  if (body.status.trim().length > 50) {
    return "status must be 50 characters or fewer.";
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: PatchStatusBody;
  try {
    body = (await request.json()) as PatchStatusBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validatePatchBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateCurrentUser();
    const { id } = await params;
    const nextStatus = body.status!.trim();

    const jobListing = await jobRepository.updateJobListingStatusForUser(
      id,
      user.id,
      nextStatus,
    );
    if (!jobListing) {
      return NextResponse.json({ error: "Job listing not found." }, { status: 404 });
    }

    return NextResponse.json({ jobListing });
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
      { error: "Failed to update job listing status." },
      { status: 500 },
    );
  }
}
