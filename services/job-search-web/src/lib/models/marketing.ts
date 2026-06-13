import { parseJsonbField } from "./profile";

export interface MarketingStatements {
  headline: string;
  pitch: string;
  includeHeadlineInResume: boolean;
  includePitchInResume: boolean;
}

export const DEFAULT_MARKETING_STATEMENTS: MarketingStatements = {
  headline: "",
  pitch: "",
  includeHeadlineInResume: true,
  includePitchInResume: true,
};

export function parseMarketingStatements(
  value: Partial<MarketingStatements> | string | null | undefined,
): MarketingStatements {
  const parsed = parseJsonbField(value) as Partial<MarketingStatements> | null;

  return {
    headline: parsed?.headline?.trim() ?? "",
    pitch: parsed?.pitch?.trim() ?? "",
    includeHeadlineInResume:
      parsed?.includeHeadlineInResume ?? DEFAULT_MARKETING_STATEMENTS.includeHeadlineInResume,
    includePitchInResume:
      parsed?.includePitchInResume ?? DEFAULT_MARKETING_STATEMENTS.includePitchInResume,
  };
}

export function serializeMarketingStatements(
  value: MarketingStatements,
): string {
  return JSON.stringify({
    headline: value.headline.trim(),
    pitch: value.pitch.trim(),
    includeHeadlineInResume: value.includeHeadlineInResume,
    includePitchInResume: value.includePitchInResume,
  });
}

export function isMarketingStatementsEmpty(value: MarketingStatements): boolean {
  return !value.headline.trim() && !value.pitch.trim();
}
