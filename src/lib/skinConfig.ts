import {
  Cat,
  Dog,
  Bird,
  Fish,
  Rabbit,
  Turtle,
  Squirrel,
  Bug,
  Rat,
  Snail,
  type LucideIcon,
} from 'lucide-react';

export type ColorCategory = 'free' | 'rank' | 'premium';

export interface ColorTheme {
  from: string;
  to: string;
  label: string;
  preview: string;
  category: ColorCategory;
  /** For rank themes — the minimum rank tier required to unlock */
  requiredRank?: string;
  /** For premium — whether it's subscription-locked */
  isPremium?: boolean;
  /** Whether the gradient is animated (e.g. rainbow) */
  animated?: boolean;
}

export interface AnimalIcon {
  icon: LucideIcon;
  label: string;
}

// ─── Rank tier order for comparison ────────────────────────────
const RANK_ORDER: Record<string, number> = {
  unranked: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
  goat: 6,
};

/** Returns true if the user's current rank is >= the required rank */
export function hasReachedRank(
  currentTier: string | null | undefined,
  requiredTier: string,
): boolean {
  const current = RANK_ORDER[currentTier ?? 'unranked'] ?? 0;
  const required = RANK_ORDER[requiredTier] ?? 999;
  return current >= required;
}

// ─── Color Themes ──────────────────────────────────────────────
export const COLOR_THEMES: Record<string, ColorTheme> = {
  // ── Free (available to everyone) ─────────────────────────────
  normal: {
    from: 'from-slate-500',
    to: 'to-zinc-600',
    label: 'Normal',
    preview: 'bg-gradient-to-br from-slate-500 to-zinc-600',
    category: 'free',
  },
  red: {
    from: 'from-red-500',
    to: 'to-rose-600',
    label: 'Red',
    preview: 'bg-gradient-to-br from-red-500 to-rose-600',
    category: 'free',
  },
  green: {
    from: 'from-emerald-500',
    to: 'to-green-600',
    label: 'Green',
    preview: 'bg-gradient-to-br from-emerald-500 to-green-600',
    category: 'free',
  },
  blue: {
    from: 'from-blue-500',
    to: 'to-blue-600',
    label: 'Blue',
    preview: 'bg-gradient-to-br from-blue-500 to-blue-600',
    category: 'free',
  },

  // ── Rank-unlockable ──────────────────────────────────────────
  bronze: {
    from: 'from-amber-600',
    to: 'to-orange-700',
    label: 'Bronze',
    preview: 'bg-gradient-to-br from-amber-600 to-orange-700',
    category: 'rank',
    requiredRank: 'bronze',
  },
  silver: {
    from: 'from-slate-300',
    to: 'to-slate-500',
    label: 'Silver',
    preview: 'bg-gradient-to-br from-slate-300 to-slate-500',
    category: 'rank',
    requiredRank: 'silver',
  },
  gold: {
    from: 'from-yellow-400',
    to: 'to-amber-500',
    label: 'Gold',
    preview: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    category: 'rank',
    requiredRank: 'gold',
  },
  platinum: {
    from: 'from-sky-300',
    to: 'to-cyan-500',
    label: 'Platinum',
    preview: 'bg-gradient-to-br from-sky-300 to-cyan-500',
    category: 'rank',
    requiredRank: 'platinum',
  },
  diamond: {
    from: 'from-blue-400',
    to: 'to-indigo-600',
    label: 'Diamond',
    preview: 'bg-gradient-to-br from-blue-400 to-indigo-600',
    category: 'rank',
    requiredRank: 'diamond',
  },
  goat: {
    from: 'from-purple-500',
    to: 'to-violet-700',
    label: 'GOAT',
    preview: 'bg-gradient-to-br from-purple-500 to-violet-700',
    category: 'rank',
    requiredRank: 'goat',
  },

  // ── Premium (subscription-locked) ───────────────────────────
  rainbow: {
    from: '',
    to: '',
    label: 'Rainbow',
    preview: '',
    category: 'premium',
    isPremium: true,
    animated: true,
  },
};

// ─── Helpers for each category ─────────────────────────────────
export const FREE_THEMES = Object.entries(COLOR_THEMES).filter(
  ([, t]) => t.category === 'free',
);
export const RANK_THEMES = Object.entries(COLOR_THEMES).filter(
  ([, t]) => t.category === 'rank',
);
export const PREMIUM_THEMES = Object.entries(COLOR_THEMES).filter(
  ([, t]) => t.category === 'premium',
);

// ─── Animal Icons ──────────────────────────────────────────────
export const ANIMAL_ICONS: Record<string, AnimalIcon> = {
  cat: { icon: Cat, label: 'Cat' },
  dog: { icon: Dog, label: 'Dog' },
  bird: { icon: Bird, label: 'Bird' },
  fish: { icon: Fish, label: 'Fish' },
  rabbit: { icon: Rabbit, label: 'Rabbit' },
  turtle: { icon: Turtle, label: 'Turtle' },
  squirrel: { icon: Squirrel, label: 'Squirrel' },
  bug: { icon: Bug, label: 'Bug' },
  rat: { icon: Rat, label: 'Rat' },
  snail: { icon: Snail, label: 'Snail' },
};

const DEFAULT_COLOR = 'normal';
const DEFAULT_ICON = 'cat';

/** Maps legacy color keys (from before the rank/free restructure) to new keys */
const LEGACY_COLOR_MAP: Record<string, string> = {
  purple: 'normal',
  pink: 'red',
  cyan: 'blue',
  slate: 'normal',
};

export function getColorTheme(key: string | null | undefined): ColorTheme {
  const resolved = LEGACY_COLOR_MAP[key ?? ''] ?? key ?? DEFAULT_COLOR;
  return COLOR_THEMES[resolved] ?? COLOR_THEMES[DEFAULT_COLOR];
}

export function getAnimalIcon(key: string | null | undefined): AnimalIcon {
  return ANIMAL_ICONS[key ?? DEFAULT_ICON] ?? ANIMAL_ICONS[DEFAULT_ICON];
}

export function getSkinGradientClass(colorKey: string | null | undefined): string {
  const theme = getColorTheme(colorKey);
  if (theme.animated) return ''; // rainbow uses inline styles
  return `bg-gradient-to-br ${theme.from} ${theme.to}`;
}

export function isRainbow(colorKey: string | null | undefined): boolean {
  return colorKey === 'rainbow';
}
