import { parseJsonbField } from "./profile";

export interface EducationDegree {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
  includeInResume: boolean;
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  issuedDate: string;
  expiryDate: string;
  url: string;
  includeInResume: boolean;
}

export interface PostGradClassEntry {
  id: string;
  courseName: string;
  institution: string;
  completedDate: string;
  includeInResume: boolean;
}

export interface UserEducationProfile {
  degrees: EducationDegree[];
  certifications: CertificationEntry[];
  postGradClasses: PostGradClassEntry[];
}

export const DEFAULT_USER_EDUCATION: UserEducationProfile = {
  degrees: [],
  certifications: [],
  postGradClasses: [],
};

function normalizeDegree(value: unknown): EducationDegree | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const institution = String(record.institution ?? "").trim();
  const degree = String(record.degree ?? "").trim();
  if (!institution || !degree) {
    return null;
  }
  return {
    id:
      String(record.id ?? "").trim() ||
      `degree-${institution}-${degree}`.toLowerCase().replace(/\s+/g, "-"),
    institution,
    degree,
    field: String(record.field ?? "").trim(),
    startYear: String(record.startYear ?? "").trim(),
    endYear: String(record.endYear ?? "").trim(),
    includeInResume: record.includeInResume !== false,
  };
}

function normalizeCertification(value: unknown): CertificationEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const name = String(record.name ?? "").trim();
  if (!name) {
    return null;
  }
  return {
    id:
      String(record.id ?? "").trim() ||
      `cert-${name}`.toLowerCase().replace(/\s+/g, "-"),
    name,
    issuer: String(record.issuer ?? "").trim(),
    issuedDate: String(record.issuedDate ?? "").trim(),
    expiryDate: String(record.expiryDate ?? "").trim(),
    url: String(record.url ?? "").trim(),
    includeInResume: record.includeInResume !== false,
  };
}

function normalizePostGradClass(value: unknown): PostGradClassEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const courseName = String(record.courseName ?? "").trim();
  const institution = String(record.institution ?? "").trim();
  if (!courseName || !institution) {
    return null;
  }
  return {
    id:
      String(record.id ?? "").trim() ||
      `class-${institution}-${courseName}`.toLowerCase().replace(/\s+/g, "-"),
    courseName,
    institution,
    completedDate: String(record.completedDate ?? "").trim(),
    includeInResume: record.includeInResume !== false,
  };
}

export function parseUserEducation(value: unknown): UserEducationProfile {
  const parsed = parseJsonbField(value) as Partial<UserEducationProfile> | null;
  return {
    degrees: Array.isArray(parsed?.degrees)
      ? parsed.degrees
          .map(normalizeDegree)
          .filter((entry): entry is EducationDegree => entry !== null)
      : [],
    certifications: Array.isArray(parsed?.certifications)
      ? parsed.certifications
          .map(normalizeCertification)
          .filter((entry): entry is CertificationEntry => entry !== null)
      : [],
    postGradClasses: Array.isArray(parsed?.postGradClasses)
      ? parsed.postGradClasses
          .map(normalizePostGradClass)
          .filter((entry): entry is PostGradClassEntry => entry !== null)
      : [],
  };
}

export function serializeUserEducation(value: UserEducationProfile): string {
  return JSON.stringify(parseUserEducation(value));
}

export function createEmptyDegree(): EducationDegree {
  return {
    id: `degree-new-${Date.now()}`,
    institution: "",
    degree: "",
    field: "",
    startYear: "",
    endYear: "",
    includeInResume: true,
  };
}

export function createEmptyCertification(): CertificationEntry {
  return {
    id: `cert-new-${Date.now()}`,
    name: "",
    issuer: "",
    issuedDate: "",
    expiryDate: "",
    url: "",
    includeInResume: true,
  };
}

export function createEmptyPostGradClass(): PostGradClassEntry {
  return {
    id: `class-new-${Date.now()}`,
    courseName: "",
    institution: "",
    completedDate: "",
    includeInResume: true,
  };
}
