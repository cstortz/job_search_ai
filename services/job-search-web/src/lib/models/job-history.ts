import { parseJsonbField } from "./profile";

export interface JobHistoryEntry {
  id: string;
  employer: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  skillIds: string[];
  includeInResume: boolean;
}

export function parseJobHistory(value: unknown): JobHistoryEntry[] {
  const parsed = parseJsonbField(value);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const employer = String(record.employer ?? "").trim();
      const title = String(record.title ?? "").trim();
      if (!employer || !title) {
        return null;
      }
      const skillIds = Array.isArray(record.skillIds)
        ? record.skillIds.map((id) => String(id).trim()).filter(Boolean)
        : [];
      return {
        id:
          String(record.id ?? "").trim() ||
          `job-${employer}-${title}`.toLowerCase().replace(/\s+/g, "-"),
        employer,
        title,
        location: String(record.location ?? "").trim(),
        startDate: String(record.startDate ?? "").trim(),
        endDate: String(record.endDate ?? "").trim(),
        description: String(record.description ?? "").trim(),
        skillIds,
        includeInResume: record.includeInResume !== false,
      };
    })
    .filter((entry): entry is JobHistoryEntry => entry !== null);
}

export function serializeJobHistory(entries: JobHistoryEntry[]): string {
  const normalized = parseJobHistory(entries);
  return JSON.stringify(normalized);
}

export function createEmptyJobHistoryEntry(): JobHistoryEntry {
  return {
    id: `job-new-${Date.now()}`,
    employer: "",
    title: "",
    location: "",
    startDate: "",
    endDate: "",
    description: "",
    skillIds: [],
    includeInResume: true,
  };
}
