/**
 * ELO Rating System
 *
 * Chess-style ELO rating with title tiers similar to chess.com.
 * Starting ELO is 1200. K-factor logic lives server-side in the
 * update_elo_after_game() SQL function.
 */

export interface EloTitleInfo {
  title: string;
  minElo: number;
  maxElo: number | null;
  colorClass: string;       // Tailwind text color
  bgClass: string;          // Tailwind badge background
  borderClass: string;      // Tailwind badge border
}

export const ELO_TITLES: EloTitleInfo[] = [
  {
    title: 'Beginner',
    minElo: 0,
    maxElo: 799,
    colorClass: 'text-zinc-400',
    bgClass: 'bg-zinc-500/20',
    borderClass: 'border-zinc-500/30',
  },
  {
    title: 'Intermediate',
    minElo: 800,
    maxElo: 1199,
    colorClass: 'text-green-400',
    bgClass: 'bg-green-500/20',
    borderClass: 'border-green-500/30',
  },
  {
    title: 'Advanced',
    minElo: 1200,
    maxElo: 1599,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/20',
    borderClass: 'border-blue-500/30',
  },
  {
    title: 'Expert',
    minElo: 1600,
    maxElo: 1999,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/20',
    borderClass: 'border-purple-500/30',
  },
  {
    title: 'Master',
    minElo: 2000,
    maxElo: 2399,
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/20',
    borderClass: 'border-orange-500/30',
  },
  {
    title: 'Grandmaster',
    minElo: 2400,
    maxElo: null,
    colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/20',
    borderClass: 'border-yellow-500/30',
  },
];

/**
 * Get the ELO title info for a given rating.
 */
export function getEloTitle(elo: number): EloTitleInfo {
  for (let i = ELO_TITLES.length - 1; i >= 0; i--) {
    if (elo >= ELO_TITLES[i].minElo) {
      return ELO_TITLES[i];
    }
  }
  return ELO_TITLES[0];
}

/**
 * Format ELO for display — just the number.
 */
export function formatElo(elo: number | null | undefined): string {
  return String(elo ?? 800);
}

/**
 * Default starting ELO.
 */
export const DEFAULT_ELO = 800;
