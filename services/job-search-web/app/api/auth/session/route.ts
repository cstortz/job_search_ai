import { NextResponse } from "next/server";

import { auth0 } from "../../../../src/lib/server/auth0";

export async function GET() {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      sub: user.sub ?? null,
      email: user.email ?? null,
      name: user.name ?? user.nickname ?? null,
      email_verified: user.email_verified ?? null,
    },
  });
}
