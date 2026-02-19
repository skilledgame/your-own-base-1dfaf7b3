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
  bronze: 2_500,
  silver: 10_000,
  gold: 50_000,
  platinum: 100_000,
  diamond: 1_000_000,
  goat: 10_000_000,
} as const;

// Perks per tier
export const RANK_PERKS: Record<string, string[]> = {
  unranked: ["Basic access", "Standard matchmaking"],
  bronze: ["Exclusive badge", "Basic leaderboard access"],
  silver: ["Reduced fee (coming soon)", "Priority matchmaking (coming soon)"],
  gold: ["VIP badge", "Monthly bonus drops (coming soon)"],
  platinum: ["Lower house fee (coming soon)", "VIP support (coming soon)"],
  diamond: ["Best fee tier (coming soon)", "Early access features (coming soon)"],
  goat: ["GOAT status", "Exclusive GOAT badge", "Best possible perks (coming soon)"],
};

/**
 * Get rank information from total wagered amount
 */
export function getRankFromTotalWagered(totalWageredSc: number | null | undefined): RankInfo {
  const wagered = totalWageredSc ?? 0;

  if (wagered >= RANK_THRESHOLDS.goat) {
    return {
      tierName: "goat",
      displayName: "GOAT",
      currentMin: RANK_THRESHOLDS.goat,
      nextMin: null,
      perks: RANK_PERKS.goat,
    };
  }

  if (wagered >= RANK_THRESHOLDS.diamond) {
    return {
      tierName: "diamond",
      displayName: "Diamond",
      currentMin: RANK_THRESHOLDS.diamond,
      nextMin: RANK_THRESHOLDS.goat,
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
    displayName: "Noob",
    currentMin: RANK_THRESHOLDS.unranked,
    nextMin: RANK_THRESHOLDS.bronze,
    perks: RANK_PERKS.unranked,
  };
}

/**
 * Get rank information from total wagered amount using dynamic tier config.
 * Tiers should be sorted by threshold descending for lookup.
 */
export function getRankFromDynamicConfig(
  totalWageredSc: number | null | undefined,
  tiers: { tier_name: string; display_name: string; threshold: number; perks: string[]; sort_order: number }[]
): RankInfo {
  const wagered = totalWageredSc ?? 0;

  // Sort by threshold descending for lookup
  const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    if (wagered >= tier.threshold) {
      // Find next tier (one with higher threshold)
      const nextTier = i > 0 ? sorted[i - 1] : null;
      return {
        tierName: tier.tier_name,
        displayName: tier.display_name,
        currentMin: tier.threshold,
        nextMin: nextTier ? nextTier.threshold : null,
        perks: tier.perks,
      };
    }
  }

  // Fallback to lowest tier
  const lowest = sorted[sorted.length - 1];
  if (lowest) {
    const nextTier = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    return {
      tierName: lowest.tier_name,
      displayName: lowest.display_name,
      currentMin: lowest.threshold,
      nextMin: nextTier ? nextTier.threshold : null,
      perks: lowest.perks,
    };
  }

  // Ultimate fallback
  return getRankFromTotalWagered(totalWageredSc);
}

/**
 * Rank badge image paths (served from /public/ranks/)
 * Returns null if no custom image exists for the tier.
 */
export const RANK_IMAGES: Record<string, string> = {
  bronze: '/ranks/bronze.png',
  silver: '/ranks/silver.png',
  gold: '/ranks/gold.png',
  platinum: '/ranks/platinum.png',
  diamond: '/ranks/diamond.png',
  goat: '/ranks/goat.png',
};

export function getRankImage(tierName: string): string | null {
  return RANK_IMAGES[tierName] ?? null;
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
