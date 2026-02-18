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

export interface ColorTheme {
  from: string;
  to: string;
  label: string;
  preview: string;
}

export interface AnimalIcon {
  icon: LucideIcon;
  label: string;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
  purple: {
    from: 'from-purple-500',
    to: 'to-indigo-600',
    label: 'Purple',
    preview: 'bg-gradient-to-br from-purple-500 to-indigo-600',
  },
  blue: {
    from: 'from-blue-500',
    to: 'to-cyan-500',
    label: 'Blue',
    preview: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  },
  green: {
    from: 'from-emerald-500',
    to: 'to-teal-500',
    label: 'Green',
    preview: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  },
  red: {
    from: 'from-red-500',
    to: 'to-orange-500',
    label: 'Red',
    preview: 'bg-gradient-to-br from-red-500 to-orange-500',
  },
  gold: {
    from: 'from-amber-500',
    to: 'to-yellow-500',
    label: 'Gold',
    preview: 'bg-gradient-to-br from-amber-500 to-yellow-500',
  },
  pink: {
    from: 'from-pink-500',
    to: 'to-rose-500',
    label: 'Pink',
    preview: 'bg-gradient-to-br from-pink-500 to-rose-500',
  },
  cyan: {
    from: 'from-cyan-500',
    to: 'to-sky-500',
    label: 'Cyan',
    preview: 'bg-gradient-to-br from-cyan-500 to-sky-500',
  },
  slate: {
    from: 'from-slate-500',
    to: 'to-zinc-600',
    label: 'Slate',
    preview: 'bg-gradient-to-br from-slate-500 to-zinc-600',
  },
};

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

const DEFAULT_COLOR = 'purple';
const DEFAULT_ICON = 'cat';

export function getColorTheme(key: string | null | undefined): ColorTheme {
  return COLOR_THEMES[key ?? DEFAULT_COLOR] ?? COLOR_THEMES[DEFAULT_COLOR];
}

export function getAnimalIcon(key: string | null | undefined): AnimalIcon {
  return ANIMAL_ICONS[key ?? DEFAULT_ICON] ?? ANIMAL_ICONS[DEFAULT_ICON];
}

export function getSkinGradientClass(colorKey: string | null | undefined): string {
  const theme = getColorTheme(colorKey);
  return `bg-gradient-to-br ${theme.from} ${theme.to}`;
}
