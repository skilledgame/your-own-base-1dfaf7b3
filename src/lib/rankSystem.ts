/**
 * VIP Ranking System
 *
 * Rank tiers based on total Skilled Coins wagered (lifetime).
 * Ranks are computed dynamically from total_wagered_sc.
 */

export interface RankInfo {
  tierName: string;
  displayName: string;
  currentMin: number;
  nextMin: number | null; // null if max rank
  perks: string[];
}

// Rank thresholds (in Skilled Coins)
export const RANK_THRESHOLDS = {
  unranked: 0,
  bronze: 5_000,
  silver: 25_000,
  gold: 100_000,
  platinum: 250_000,
  diamond: 1_000_000,
} as const;

// Perks per tier
export const RANK_PERKS: Record<string, string[]> = {
  unranked: ["Basic access", "Standard matchmaking"],
  bronze: ["Exclusive badge", "Basic leaderboard access"],
  silver: ["Reduced fee (coming soon)", "Priority matchmaking (coming soon)"],
  gold: ["VIP badge", "Monthly bonus drops (coming soon)"],
  platinum: ["Lower house fee (coming soon)", "VIP support (coming soon)"],
  diamond: ["Best fee tier (coming soon)", "Early access features (coming soon)"],
};

/**
 * Get rank information from total wagered amount
 */
export function getRankFromTotalWagered(totalWageredSc: number | null | undefined): RankInfo {
  const wagered = totalWageredSc ?? 0;

  if (wagered >= RANK_THRESHOLDS.diamond) {
    return {
      tierName: "diamond",
      displayName: "Diamond",
      currentMin: RANK_THRESHOLDS.diamond,
      nextMin: null,
      perks: RANK_PERKS.diamond,
    };
  }

  if (wagered >= RANK_THRESHOLDS.platinum) {
    return {
      tierName: "platinum",
      displayName: "Platinum",
      currentMin: RANK_THRESHOLDS.platinum,
      nextMin: RANK_THRESHOLDS.diamond,
      perks: RANK_PERKS.platinum,
    };
  }

  if (wagered >= RANK_THRESHOLDS.gold) {
    return {
      tierName: "gold",
      displayName: "Gold",
      currentMin: RANK_THRESHOLDS.gold,
      nextMin: RANK_THRESHOLDS.platinum,
      perks: RANK_PERKS.gold,
    };
  }

  if (wagered >= RANK_THRESHOLDS.silver) {
    return {
      tierName: "silver",
      displayName: "Silver",
      currentMin: RANK_THRESHOLDS.silver,
      nextMin: RANK_THRESHOLDS.gold,
      perks: RANK_PERKS.silver,
    };
  }

  if (wagered >= RANK_THRESHOLDS.bronze) {
    return {
      tierName: "bronze",
      displayName: "Bronze",
      currentMin: RANK_THRESHOLDS.bronze,
      nextMin: RANK_THRESHOLDS.silver,
      perks: RANK_PERKS.bronze,
    };
  }

  return {
    tierName: "unranked",
    displayName: "Unranked",
    currentMin: RANK_THRESHOLDS.unranked,
    nextMin: RANK_THRESHOLDS.bronze,
    perks: RANK_PERKS.unranked,
  };
}

/**
 * Format Skilled Coins amount for display
 */
export function formatSkilledCoins(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "0";
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return amount.toLocaleString();
}
