export const WORK_AUTHORIZATION_OPTIONS = [
  { value: "", label: "Not specified" },
  {
    value: "no_sponsorship_required",
    label: "Authorized to work (no sponsorship needed)",
  },
  { value: "requires_sponsorship", label: "Requires visa sponsorship" },
  {
    value: "open_to_sponsorship",
    label: "Open to sponsorship discussion",
  },
] as const;

export type WorkAuthorizationValue =
  (typeof WORK_AUTHORIZATION_OPTIONS)[number]["value"];

export function formatWorkAuthorization(
  value: string | null | undefined,
): string {
  const normalized = value?.trim() ?? "";
  const match = WORK_AUTHORIZATION_OPTIONS.find(
    (option) => option.value === normalized,
  );
  return match?.label ?? (normalized || "Not specified");
}
