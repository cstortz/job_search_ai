import { NextRequest, NextResponse } from "next/server";

import {
  DatabaseOperationError,
  isPreparedClientError,
} from "../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../src/lib/server/current-user";
import { skillRepository } from "../../../../src/lib/server/repositories";

interface UpdateSkillBody {
  skillName?: string;
  skillCategory?: string | null;
  description?: string | null;
  yearsOfExperience?: number | null;
  lastUsedDate?: string | null;
}

function validateUpdateBody(body: UpdateSkillBody): string | null {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  try {
    const { user } = await getOrCreateCurrentUser();
    const { id } = await params;
    const skill = await skillRepository.findSkillByIdForUser(id, user.id);
    if (!skill) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 });
    }
    return NextResponse.json({ skill });
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
    if (isPreparedClientError(error)) {
      return NextResponse.json(
        { error: error.message || "Database API request failed." },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json({ error: "Failed to fetch skill." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: UpdateSkillBody;
  try {
    body = (await request.json()) as UpdateSkillBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateUpdateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { user } = await getOrCreateCurrentUser();
    const { id } = await params;
    const updated = await skillRepository.updateSkillForUser({
      skillId: id,
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
    if (!updated) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 });
    }
    return NextResponse.json({ skill: updated });
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
    return NextResponse.json({ error: "Failed to update skill." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  try {
    const { user } = await getOrCreateCurrentUser();
    const { id } = await params;
    const affectedRows = await skillRepository.deleteSkillForUser(id, user.id);
    if (affectedRows < 1) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true, affectedRows, id });
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
    if (isPreparedClientError(error)) {
      return NextResponse.json(
        { error: error.message || "Database API request failed." },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json({ error: "Failed to delete skill." }, { status: 500 });
  }
}
