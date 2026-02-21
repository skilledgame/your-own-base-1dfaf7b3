import { cn } from '@/lib/utils';
import { getColorTheme, getAnimalIcon, isRainbow, type ColorTheme } from '@/lib/skinConfig';
import type { UserStatus } from '@/stores/presenceStore';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface PlayerAvatarProps {
  skinColor?: string | null;
  skinIcon?: string | null;
  size?: AvatarSize;
  status?: UserStatus;
  fallbackInitial?: string;
  className?: string;
  /** Fill parent container as a square with no rounding */
  fill?: boolean;
}

const SIZE_CONFIG: Record<AvatarSize, { dim: string; icon: string; text: string; dot: string }> = {
  xs: { dim: 'w-7 h-7', icon: 'w-3.5 h-3.5', text: 'text-[10px]', dot: 'w-2 h-2 border-[1.5px]' },
  sm: { dim: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-xs', dot: 'w-2.5 h-2.5 border-2' },
  md: { dim: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-sm', dot: 'w-2.5 h-2.5 border-2' },
  lg: { dim: 'w-16 h-16', icon: 'w-8 h-8', text: 'text-2xl', dot: 'w-3.5 h-3.5 border-[3px]' },
  xl: { dim: 'w-24 h-24', icon: 'w-12 h-12', text: 'text-4xl', dot: 'w-4 h-4 border-[3px]' },
};

const RAINBOW_STYLE: React.CSSProperties = {
  background: `linear-gradient(
    135deg,
    hsl(0, 85%, 60%),
    hsl(45, 90%, 55%),
    hsl(90, 80%, 50%),
    hsl(180, 80%, 50%),
    hsl(225, 85%, 60%),
    hsl(270, 80%, 60%),
    hsl(315, 85%, 60%),
    hsl(360, 85%, 60%)
  )`,
  backgroundSize: '300% 300%',
  animation: 'avatar-rainbow 4s linear infinite',
};

export function PlayerAvatar({
  skinColor,
  skinIcon,
  size = 'md',
  status,
  fallbackInitial,
  className,
  fill,
}: PlayerAvatarProps) {
  const config = SIZE_CONFIG[size];
  const theme: ColorTheme = getColorTheme(skinColor);
  const animal = getAnimalIcon(skinIcon);
  const IconComponent = animal.icon;
  const rainbow = isRainbow(skinColor);

  const useFallback = !skinIcon && fallbackInitial;

  if (fill) {
    return (
      <div
        className={cn(
          'flex items-center justify-center flex-shrink-0',
          !rainbow && 'bg-gradient-to-br',
          !rainbow && theme.from,
          !rainbow && theme.to,
          className,
        )}
        style={rainbow ? RAINBOW_STYLE : undefined}
      >
        {useFallback ? (
          <span className="text-white font-bold text-base">
            {fallbackInitial.charAt(0).toUpperCase()}
          </span>
        ) : (
          <IconComponent className="text-white w-6 h-6" />
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          config.dim,
          'rounded-full flex items-center justify-center',
          !rainbow && 'bg-gradient-to-br',
          !rainbow && theme.from,
          !rainbow && theme.to,
        )}
        style={rainbow ? RAINBOW_STYLE : undefined}
      >
        {useFallback ? (
          <span className={cn('text-white font-bold', config.text)}>
            {fallbackInitial.charAt(0).toUpperCase()}
          </span>
        ) : (
          <IconComponent className={cn('text-white', config.icon)} />
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-[#0f1923]',
            config.dot,
            status === 'online' && 'bg-emerald-400',
            status === 'in_game' && 'bg-amber-400',
            status === 'offline' && 'bg-slate-600',
          )}
        />
      )}
    </div>
  );
}
