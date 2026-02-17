import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RANK_THRESHOLDS as DEFAULT_THRESHOLDS, RANK_PERKS as DEFAULT_PERKS } from '@/lib/rankSystem';

export interface RankTier {
  id: string;
  tier_name: string;
  display_name: string;
  threshold: number;
  perks: string[];
  rakeback_percentage: number;
  sort_order: number;
  updated_at: string | null;
}

// Default fallback tiers (matches current hardcoded values)
const DEFAULT_TIERS: RankTier[] = [
  { id: '', tier_name: 'unranked', display_name: 'Unranked', threshold: 0, perks: DEFAULT_PERKS.unranked, rakeback_percentage: 0, sort_order: 0, updated_at: null },
  { id: '', tier_name: 'bronze', display_name: 'Bronze', threshold: DEFAULT_THRESHOLDS.bronze, perks: DEFAULT_PERKS.bronze, rakeback_percentage: 2, sort_order: 1, updated_at: null },
  { id: '', tier_name: 'silver', display_name: 'Silver', threshold: DEFAULT_THRESHOLDS.silver, perks: DEFAULT_PERKS.silver, rakeback_percentage: 5, sort_order: 2, updated_at: null },
  { id: '', tier_name: 'gold', display_name: 'Gold', threshold: DEFAULT_THRESHOLDS.gold, perks: DEFAULT_PERKS.gold, rakeback_percentage: 8, sort_order: 3, updated_at: null },
  { id: '', tier_name: 'platinum', display_name: 'Platinum', threshold: DEFAULT_THRESHOLDS.platinum, perks: DEFAULT_PERKS.platinum, rakeback_percentage: 12, sort_order: 4, updated_at: null },
  { id: '', tier_name: 'diamond', display_name: 'Diamond', threshold: DEFAULT_THRESHOLDS.diamond, perks: DEFAULT_PERKS.diamond, rakeback_percentage: 15, sort_order: 5, updated_at: null },
  { id: '', tier_name: 'goat', display_name: 'GOAT', threshold: DEFAULT_THRESHOLDS.goat, perks: DEFAULT_PERKS.goat, rakeback_percentage: 20, sort_order: 7, updated_at: null },
];

/**
 * useRankConfig - Fetches editable rank configuration from Supabase.
 * Falls back to hardcoded defaults if the table is empty or fetch fails.
 */
export function useRankConfig() {
  const [tiers, setTiers] = useState<RankTier[]>(DEFAULT_TIERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTiers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('rank_config')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        // Keep defaults
      } else if (data && data.length > 0) {
        setTiers(data);
      }
      // If data is empty, keep defaults
    } catch (err) {
      setError('Failed to load rank config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  // Derived helpers
  const thresholds: Record<string, number> = {};
  const perks: Record<string, string[]> = {};
  const rakebackTiers: { rank: string; percentage: number }[] = [];

  for (const tier of tiers) {
    thresholds[tier.tier_name] = tier.threshold;
    perks[tier.tier_name] = tier.perks;
    rakebackTiers.push({ rank: tier.tier_name, percentage: tier.rakeback_percentage });
  }

  return {
    tiers,
    loading,
    error,
    thresholds,
    perks,
    rakebackTiers,
    refetch: fetchTiers,
  };
}
