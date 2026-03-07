import { NextResponse } from "next/server";

import { listRoles } from "../../../../src/lib/server/rbac";

export async function GET() {
  return NextResponse.json({ roles: listRoles() });
}
