export interface SkillRecord {
  id: string;
  user_id: string;
  skill_name: string;
  skill_category: string | null;
  description: string | null;
  years_of_experience: number | null;
  last_used_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiErrorBody {
  error?: string;
}

export class ApiRequestError extends Error {
  status: number;
  body?: ApiErrorBody;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let parsedBody: unknown = null;
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    const body = (parsedBody ?? undefined) as ApiErrorBody | undefined;
    throw new ApiRequestError(
      response.status,
      body?.error || `Request failed with status ${response.status}.`,
      body,
    );
  }

  return parsedBody as T;
}

export async function listSkills(): Promise<{ skills: SkillRecord[] }> {
  return requestJson<{ skills: SkillRecord[] }>("/api/skills", { method: "GET" });
}

export async function createSkill(input: {
  skillName: string;
  skillCategory?: string | null;
  description?: string | null;
  yearsOfExperience?: number | null;
  lastUsedDate?: string | null;
}): Promise<{ skill: SkillRecord }> {
  return requestJson<{ skill: SkillRecord }>("/api/skills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateSkill(
  id: string,
  input: {
    skillName: string;
    skillCategory?: string | null;
    description?: string | null;
    yearsOfExperience?: number | null;
    lastUsedDate?: string | null;
  },
): Promise<{ skill: SkillRecord }> {
  return requestJson<{ skill: SkillRecord }>(`/api/skills/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteSkill(
  id: string,
): Promise<{ deleted: boolean; affectedRows: number; id: string }> {
  return requestJson<{ deleted: boolean; affectedRows: number; id: string }>(
    `/api/skills/${id}`,
    {
      method: "DELETE",
    },
  );
}
