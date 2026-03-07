import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../src/lib/server/current-user";

interface SyncUserRequestBody {
  phone?: string | null;
  linkedinUrl?: string | null;
  timezone?: string | null;
}

export async function POST(request: NextRequest) {
  let body: SyncUserRequestBody;
  try {
    body = (await request.json()) as SyncUserRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const { user } = await getOrCreateCurrentUser({
      phone: body.phone ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      timezone: body.timezone ?? "UTC",
    });

    return NextResponse.json({ user });
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

    return NextResponse.json({ error: "Failed to sync user." }, { status: 500 });
  }
}
