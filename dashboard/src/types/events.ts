// Event log sent by the extension (privacy: hashed path, domain + score bins)
export type ActionTaken = "ignored" | "left" | "reported";

export interface EventLog {
  timestamp: string; // ISO
  domain: string;
  riskScore: number; // 0–1 or binned
  category: string;
  price?: number;
  actionTaken: ActionTaken;
  // Optional: hashed path for privacy when storing server-side
  pathHash?: string;
}

// Daily stats per user (from aggregation)
export interface DailyUserStats {
  date: string; // YYYY-MM-DD
  totalEvents: number;
  byAction: Record<ActionTaken, number>;
  byCategory: Record<string, number>;
  riskScoreBins: { bin: string; count: number }[];
  domains: { domain: string; count: number }[];
}

// Global anonymized stats
export interface GlobalStats {
  date: string;
  totalEvents: number;
  uniqueDomains: number;
  byAction: Record<ActionTaken, number>;
  riskScoreBins: { bin: string; count: number }[];
}
