import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../src/lib/server/current-user";
import { jobRepository } from "../../../../src/lib/server/repositories";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;

  try {
    const { user } = await getOrCreateCurrentUser();
    const { id } = await params;

    const jobListing = await jobRepository.findJobListingByIdForUser(id, user.id);
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
      { error: "Failed to fetch job listing." },
      { status: 500 },
    );
  }
}
