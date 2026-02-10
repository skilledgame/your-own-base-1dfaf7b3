/**
 * UserBadge - Displays tester, dev, or admin badges next to player names.
 * 
 * Usage:
 *   <UserBadges badges={['tester', 'dev']} />
 *   <UserBadge badge="admin" />
 */

import { Shield, Code, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeType = 'tester' | 'dev' | 'admin';

const badgeConfig: Record<BadgeType, {
  label: string;
  icon: typeof Shield;
  className: string;
}> = {
  tester: {
    label: 'Tester',
    icon: FlaskConical,
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  dev: {
    label: 'Dev',
    icon: Code,
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
};

interface UserBadgeProps {
  badge: BadgeType;
  size?: 'sm' | 'md';
  className?: string;
}

export function UserBadge({ badge, size = 'sm', className }: UserBadgeProps) {
  const config = badgeConfig[badge];
  if (!config) return null;

  const Icon = config.icon;
  const isSmall = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wider',
        isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        config.className,
        className,
      )}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {config.label}
    </span>
  );
}

interface UserBadgesProps {
  badges: string[];
  size?: 'sm' | 'md';
  className?: string;
}

export function UserBadges({ badges, size = 'sm', className }: UserBadgesProps) {
  const validBadges = badges.filter((b): b is BadgeType => b in badgeConfig);
  if (validBadges.length === 0) return null;

  return (
    <span className={cn('inline-flex items-center gap-1 flex-wrap', className)}>
      {validBadges.map((badge) => (
        <UserBadge key={badge} badge={badge} size={size} />
      ))}
    </span>
  );
}
