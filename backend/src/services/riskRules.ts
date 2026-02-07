const TLD_RISKY = ["zip", "mov", "top", "xyz", "click", "loan", "work"];
const KEYWORDS = [
  "verify",
  "login",
  "account",
  "free",
  "giveaway",
  "crypto",
  "giftcard",
  "refund",
  "support"
];

export interface RuleResult {
  riskScore: number;
  reasons: string[];
}

const clampScore = (score: number) => Math.max(0, Math.min(100, score));

const countDigits = (value: string) => (value.match(/\d/g) || []).length;

export const computeRuleRisk = (input: {
  url: URL;
  rawUrl: string;
  domain: string;
}): RuleResult => {
  let score = 0;
  const reasons: string[] = [];

  const tld = input.domain.split(".").pop() || "";
  if (TLD_RISKY.includes(tld)) {
    score += 20;
    reasons.push("Suspicious top-level domain");
  }

  if (input.url.protocol !== "https:") {
    score += 15;
    reasons.push("Site is not using HTTPS");
  }

  const lowered = input.rawUrl.toLowerCase();
  const keywordHit = KEYWORDS.find((keyword) => lowered.includes(keyword));
  if (keywordHit) {
    score += 20;
    reasons.push("URL contains high-risk keywords");
  }

  const digitCount = countDigits(input.domain);
  if (input.domain.includes("-") || digitCount >= 4) {
    score += 25;
    reasons.push("Domain format looks risky");
  }

  return {
    riskScore: clampScore(score),
    reasons: reasons.slice(0, 6)
  };
};
