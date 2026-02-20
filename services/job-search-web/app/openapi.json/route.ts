import { NextResponse } from "next/server";

import { buildOpenApiSpec } from "../../src/lib/server/openapi";

export async function GET() {
  return NextResponse.json(buildOpenApiSpec());
}
