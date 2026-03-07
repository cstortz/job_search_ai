import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../../src/lib/db/db-repository";
import {
  resolvePermissionsForRoles,
  resolveRolesForUser
} from "../../../../src/lib/server/rbac";
import {
  UnauthorizedError,
  getOrCreateCurrentUser
} from "../../../../src/lib/server/current-user";

export async function GET(request: NextRequest) {
  try {
    const { profile, user } = await getOrCreateCurrentUser();

    const roles = resolveRolesForUser(profile.auth0SubjectId);
    const permissions = resolvePermissionsForRoles(roles);

    return NextResponse.json({
      user,
      roles,
      permissions,
    });
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
    return NextResponse.json({ error: "Failed to fetch user." }, { status: 500 });
  }
}
