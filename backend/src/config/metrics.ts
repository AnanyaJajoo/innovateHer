const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const RISK_HIGH_THRESHOLD = parseNumber(process.env.RISK_HIGH_THRESHOLD, 80);
export const DEFAULT_AVG_ORDER_VALUE = parseNumber(
  process.env.DEFAULT_AVG_ORDER_VALUE,
  75
);

export const PROTECTION_FACTORS = {
  critical: parseNumber(process.env.PROTECTION_FACTOR_CRITICAL, 0.8),
  high: parseNumber(process.env.PROTECTION_FACTOR_HIGH, 0.5),
  elevated: parseNumber(process.env.PROTECTION_FACTOR_ELEVATED, 0.2)
};

export const HASH_SALT =
  process.env.HASH_SALT ?? process.env.URL_HASH_SALT ?? "local-dev-salt";
