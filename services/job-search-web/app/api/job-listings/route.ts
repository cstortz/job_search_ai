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

    const status = searchParams.get("status")?.trim() || null;
    const jobSourceId = searchParams.get("jobSourceId")?.trim() || null;

    const jobListings = await jobRepository.listJobListingsByUser({
      userId: user.id,
      status,
      jobSourceId,
    });
    return NextResponse.json({ jobListings });
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
      { error: "Failed to fetch job listings." },
      { status: 500 },
    );
  }
}

interface CreateJobListingBody {
  jobUrl?: unknown;
}

function deriveCompanyFromUrl(urlValue: string): string {
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase();
    return hostname.replace(/^www\./, "") || "Unknown company";
  } catch {
    return "Unknown company";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getOrCreateCurrentUser();
    const body = (await request.json()) as CreateJobListingBody;
    const jobUrl = typeof body.jobUrl === "string" ? body.jobUrl.trim() : "";

    if (!jobUrl) {
      return NextResponse.json({ error: "jobUrl is required." }, { status: 400 });
    }

    try {
      new URL(jobUrl);
    } catch {
      return NextResponse.json({ error: "jobUrl must be a valid URL." }, { status: 400 });
    }

    const knownSites = await jobRepository.listJobSitesByUser(user.id);
    const sourceSite = knownSites.find((site) => site.url === jobUrl) ?? null;

    const jobListing = await jobRepository.insertJobListingForUser({
      userId: user.id,
      jobUrl,
      jobTitle: "Pending extraction",
      companyName: deriveCompanyFromUrl(jobUrl),
      jobSourceId: sourceSite?.id ?? null,
      status: "active",
    });

    if (!jobListing) {
      return NextResponse.json(
        { error: "Failed to create job listing." },
        { status: 500 },
      );
    }

    const resumePacket = await jobRepository.insertResumePacketForUser({
      userId: user.id,
      jobId: jobListing.id,
      status: "draft",
    });

    if (!resumePacket) {
      return NextResponse.json(
        { error: "Job created but failed to start resume creation process." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        jobListing,
        resumePacket,
        message: "Job added and resume creation process started.",
      },
      { status: 201 },
    );
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
      { error: "Failed to create job listing." },
      { status: 500 },
    );
  }
}
