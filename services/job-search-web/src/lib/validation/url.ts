export function resolveLaunchUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isValidHttpUrl(trimmed)) {
    return trimmed;
  }

  const candidates = trimmed.includes("://")
    ? [trimmed]
    : [`https://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeOtherUrls(
  input: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!input) {
    return null;
  }

  const normalized: Record<string, string> = {};
  for (const [rawName, rawUrl] of Object.entries(input)) {
    const name = rawName.trim();
    const url = rawUrl.trim();
    if (!name || !url) {
      continue;
    }
    normalized[name] = url;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}
