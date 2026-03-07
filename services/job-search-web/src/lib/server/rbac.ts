import "server-only";

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
}

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
}

const ROLE_CATALOG: RoleDefinition[] = [
  {
    id: "user",
    name: "User",
    description: "Standard user role for personal job-search workflows.",
  },
  {
    id: "admin",
    name: "Admin",
    description: "Administrative role with elevated management capabilities.",
  },
];

const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    id: "documents.read",
    name: "documents.read",
    description: "Read own uploaded documents.",
  },
  {
    id: "documents.write",
    name: "documents.write",
    description: "Upload and delete own documents.",
  },
  {
    id: "chat.use",
    name: "chat.use",
    description: "Send chat messages and receive streaming AI responses.",
  },
  {
    id: "admin.manage",
    name: "admin.manage",
    description: "Administrative access to global management operations.",
  },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  user: ["documents.read", "documents.write", "chat.use"],
  admin: ["documents.read", "documents.write", "chat.use", "admin.manage"],
};

export function listRoles(): RoleDefinition[] {
  return ROLE_CATALOG;
}

export function listPermissions(): PermissionDefinition[] {
  return PERMISSION_CATALOG;
}

export function resolveRolesForUser(auth0SubjectId: string): string[] {
  const adminSubjects = (process.env.RBAC_ADMIN_AUTH0_SUBJECTS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (adminSubjects.includes(auth0SubjectId)) {
    return ["admin", "user"];
  }
  return ["user"];
}

export function resolvePermissionsForRoles(roles: string[]): string[] {
  const permissionSet = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissionSet.add(permission);
    }
  }
  return [...permissionSet];
}
