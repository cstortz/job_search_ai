import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../src/lib/server/current-user";
import { jobRepository } from "../../../src/lib/server/repositories";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getOrCreateCurrentUser();
    const { searchParams } = new URL(request.url);

    const jobId = searchParams.get("jobId")?.trim() || null;
    const status = searchParams.get("status")?.trim() || null;
    const applicationStatus =
      searchParams.get("applicationStatus")?.trim() || null;

    const resumePackets = await jobRepository.listResumePacketsByUser({
      userId: user.id,
      jobId,
      status,
      applicationStatus,
    });
    return NextResponse.json({ resumePackets });
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
      { error: "Failed to fetch resume packets." },
      { status: 500 },
    );
  }
}
