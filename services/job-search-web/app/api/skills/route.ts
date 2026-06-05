import { NextRequest, NextResponse } from "next/server";

import {
  DatabaseOperationError,
  isPreparedClientError,
} from "../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../src/lib/server/current-user";
import { skillRepository } from "../../../src/lib/server/repositories";

interface CreateSkillBody {
  skillName?: string;
  skillCategory?: string | null;
  description?: string | null;
  yearsOfExperience?: number | null;
  lastUsedDate?: string | null;
}

function validateCreateBody(body: CreateSkillBody): string | null {
  if (!body || typeof body !== "object") {
    return "Invalid JSON body.";
  }
  if (!body.skillName || typeof body.skillName !== "string" || !body.skillName.trim()) {
    return "Missing required field: skillName.";
  }
  if (
    body.yearsOfExperience !== undefined &&
    body.yearsOfExperience !== null &&
    (!Number.isInteger(body.yearsOfExperience) || body.yearsOfExperience < 0)
  ) {
    return "yearsOfExperience must be a non-negative integer when provided.";
  }
  if (
    body.lastUsedDate !== undefined &&
    body.lastUsedDate !== null &&
    typeof body.lastUsedDate !== "string"
  ) {
    return "lastUsedDate must be a string (YYYY-MM-DD) when provided.";
  }
  return null;
}

export async function GET(request: NextRequest) {
  void request;
  try {
    const { user } = await getOrCreateCurrentUser();
    const skills = await skillRepository.listSkillsByUser(user.id);
    return NextResponse.json({ skills });
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
    return NextResponse.json({ error: "Failed to fetch skills." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: CreateSkillBody;
  try {
    body = (await request.json()) as CreateSkillBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateCreateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateCurrentUser();
    const created = await skillRepository.insertSkillForUser({
      userId: user.id,
      skillName: body.skillName!.trim(),
      skillCategory:
        typeof body.skillCategory === "string" ? body.skillCategory.trim() || null : null,
      description:
        typeof body.description === "string" ? body.description.trim() || null : null,
      yearsOfExperience: body.yearsOfExperience ?? null,
      lastUsedDate:
        typeof body.lastUsedDate === "string" ? body.lastUsedDate.trim() || null : null,
    });
    if (!created) {
      return NextResponse.json({ error: "Failed to create skill." }, { status: 500 });
    }
    return NextResponse.json({ skill: created }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof DatabaseOperationError) {
      const message = (error.message || "").toLowerCase();
      if (message.includes("duplicate key") || message.includes("already exists")) {
        return NextResponse.json(
          { error: "Skill already exists for this user." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: error.message || "Database operation failed." },
        { status: 500 },
      );
    }
    if (isPreparedClientError(error)) {
      return NextResponse.json(
        { error: error.message || "Database API request failed." },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json({ error: "Failed to create skill." }, { status: 500 });
  }
}
