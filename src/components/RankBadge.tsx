import { getRankImage } from '@/lib/rankSystem';
import type { RankInfo } from '@/lib/rankSystem';

interface RankBadgeProps {
  rank: RankInfo | undefined;
  /** Image size in pixels (default 16 for sm, 24 for md, 32 for lg) */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Show tier name text next to the icon */
  showLabel?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-10 h-10',
};

const LABEL_SIZE_MAP = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
};

function getRankTextColor(tierName: string): string {
  switch (tierName) {
    case 'goat': return 'text-purple-400';
    case 'diamond': return 'text-blue-400';
    case 'platinum': return 'text-sky-300';
    case 'gold': return 'text-yellow-400';
    case 'silver': return 'text-slate-300';
    case 'bronze': return 'text-orange-500';
    default: return 'text-muted-foreground';
  }
}

export function RankBadge({ rank, size = 'sm', showLabel = false, className = '' }: RankBadgeProps) {
  if (!rank) return null;

  const tierName = rank.tierName;
  const image = getRankImage(tierName);
  const colorClass = getRankTextColor(tierName);

  if (image) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <img
          src={image}
          alt={`${rank.displayName} rank`}
          className={`${SIZE_MAP[size]} object-contain drop-shadow-sm`}
          draggable={false}
        />
        {showLabel && (
          <span className={`font-semibold ${LABEL_SIZE_MAP[size]} ${colorClass}`}>
            {rank.displayName}
          </span>
        )}
      </span>
    );
  }

  // Fallback for tiers without custom images (unranked)
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`font-medium ${LABEL_SIZE_MAP[size]} px-1.5 py-0.5 rounded ${colorClass}`}>
        {rank.displayName}
      </span>
    </span>
  );
}
