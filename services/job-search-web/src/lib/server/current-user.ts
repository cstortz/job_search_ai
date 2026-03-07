import "server-only";

import { auth0 } from "./auth0";
import { userRepository } from "./repositories";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface AuthenticatedProfile {
  auth0SubjectId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function requireAuthenticatedProfile(): Promise<AuthenticatedProfile> {
  const session = await auth0.getSession();
  const user = session?.user;
  const auth0SubjectId = user?.sub?.trim();
  const email = user?.email?.trim().toLowerCase();
  const name = (user?.name || user?.nickname || "").trim();

  if (!auth0SubjectId || !email || !name) {
    throw new UnauthorizedError(
      "Missing required Auth0 session claims (sub, email, name).",
    );
  }

  return {
    auth0SubjectId,
    email,
    name,
    emailVerified: Boolean(user.email_verified),
  };
}

export async function getOrCreateCurrentUser(options?: {
  phone?: string | null;
  linkedinUrl?: string | null;
  timezone?: string | null;
}) {
  const profile = await requireAuthenticatedProfile();
  const user = await userRepository.upsertByAuth0Subject({
    auth0SubjectId: profile.auth0SubjectId,
    email: profile.email,
    name: profile.name,
    emailVerified: profile.emailVerified,
    phone: options?.phone ?? null,
    linkedinUrl: options?.linkedinUrl ?? null,
    timezone: options?.timezone ?? "UTC",
  });

  if (!user) {
    throw new Error("Failed to resolve current user.");
  }

  return { profile, user };
}
