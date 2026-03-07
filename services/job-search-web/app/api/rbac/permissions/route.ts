import { NextResponse } from "next/server";

import { listPermissions } from "../../../../src/lib/server/rbac";

export async function GET() {
  return NextResponse.json({ permissions: listPermissions() });
}
