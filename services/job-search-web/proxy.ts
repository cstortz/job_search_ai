import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "./src/lib/server/auth0";

const PUBLIC_PAGE_PATHS = new Set<string>(["/docs", "/openapi.json"]);
const AUTH_PATH_PREFIX = "/auth";

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api");
}

function isAuthPath(pathname: string): boolean {
  return pathname === AUTH_PATH_PREFIX || pathname.startsWith(`${AUTH_PATH_PREFIX}/`);
}

function isPublicPagePath(pathname: string): boolean {
  return PUBLIC_PAGE_PATHS.has(pathname);
}

export async function proxy(request: NextRequest) {
  const authResponse = await auth0.middleware(request);
  const pathname = request.nextUrl.pathname;

  if (isApiPath(pathname) || isAuthPath(pathname) || isPublicPagePath(pathname)) {
    return authResponse;
  }

  const session = await auth0.getSession(request);
  if (!session?.user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set(
      "returnTo",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return authResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
