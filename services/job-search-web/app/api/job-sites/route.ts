import { NextRequest, NextResponse } from "next/server";

import { DatabaseOperationError } from "../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../src/lib/server/current-user";
import { jobRepository } from "../../../src/lib/server/repositories";

interface JobSiteBody {
  url?: string;
  company?: string | null;
  industry?: string | null;
  usPostalAddress?: string | null;
  frequency?: string | null;
  enabled?: boolean;
  timezone?: string | null;
  authenticationType?: string | null;
}

function validateBody(body: JobSiteBody): string | null {
  if (!body || typeof body !== "object") {
    return "Invalid JSON body.";
  }
  if (!body.url || typeof body.url !== "string" || !body.url.trim()) {
    return "Missing required field: url.";
  }
  try {
    new URL(body.url.trim());
  } catch {
    return "url must be a valid URL.";
  }
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return "enabled must be a boolean when provided.";
  }
  return null;
}

export async function GET(request: NextRequest) {
  void request;

  try {
    const { user } = await getOrCreateCurrentUser();
    const jobSites = await jobRepository.listJobSitesByUser(user.id);
    return NextResponse.json({ jobSites });
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
      { error: "Failed to fetch job sites." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: JobSiteBody;
  try {
    body = (await request.json()) as JobSiteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateCurrentUser();
    const jobSite = await jobRepository.insertJobSiteForUser({
      userId: user.id,
      url: body.url!.trim(),
      company: typeof body.company === "string" ? body.company.trim() || null : null,
      industry: typeof body.industry === "string" ? body.industry.trim() || null : null,
      usPostalAddress:
        typeof body.usPostalAddress === "string"
          ? body.usPostalAddress.trim() || null
          : null,
      frequency:
        typeof body.frequency === "string" ? body.frequency.trim() || null : null,
      enabled: body.enabled ?? true,
      timezone: typeof body.timezone === "string" ? body.timezone.trim() || null : null,
      authenticationType:
        typeof body.authenticationType === "string"
          ? body.authenticationType.trim() || null
          : null,
    });
    if (!jobSite) {
      return NextResponse.json({ error: "Failed to create job site." }, { status: 500 });
    }
    return NextResponse.json({ jobSite }, { status: 201 });
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
      { error: "Failed to create job site." },
      { status: 500 },
    );
  }
}
