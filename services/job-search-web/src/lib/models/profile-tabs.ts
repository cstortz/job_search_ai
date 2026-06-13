export const PROFILE_TAB_IDS = [
  "demographics",
  "relocation",
  "office-type",
  "communications",
  "job-history",
  "education",
  "job-search",
] as const;

export type ProfileTabId = (typeof PROFILE_TAB_IDS)[number];

export const PROFILE_TAB_LABELS: Record<ProfileTabId, string> = {
  demographics: "Demographics",
  relocation: "Relocation",
  "office-type": "Office type",
  communications: "Communications",
  "job-history": "Job history",
  education: "Education",
  "job-search": "Job search",
};

export function isProfileTabId(value: string): value is ProfileTabId {
  return (PROFILE_TAB_IDS as readonly string[]).includes(value);
}

export const PROFILE_PLACEHOLDER_TAB_DESCRIPTIONS: Partial<
  Record<ProfileTabId, string>
> = {
  "job-history": "Employment timeline linked to your skills library.",
  education: "Degrees, certifications, and post-graduate classes.",
};
