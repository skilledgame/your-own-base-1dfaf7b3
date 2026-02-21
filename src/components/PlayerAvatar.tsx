import { cn } from '@/lib/utils';
import { getColorTheme, getAvatarIcon, isRainbow, type ColorTheme } from '@/lib/skinConfig';
import type { UserStatus } from '@/stores/presenceStore';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface PlayerAvatarProps {
  skinColor?: string | null;
  skinIcon?: string | null;
  size?: AvatarSize;
  status?: UserStatus;
  fallbackInitial?: string;
  className?: string;
}

const SIZE_CONFIG: Record<AvatarSize, { dim: string; icon: string; text: string; dot: string; img: string }> = {
  xs: { dim: 'w-7 h-7', icon: 'w-3.5 h-3.5', text: 'text-[10px]', dot: 'w-2 h-2 border-[1.5px]', img: 'w-5 h-5' },
  sm: { dim: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-xs', dot: 'w-2.5 h-2.5 border-2', img: 'w-6 h-6' },
  md: { dim: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-sm', dot: 'w-2.5 h-2.5 border-2', img: 'w-7 h-7' },
  lg: { dim: 'w-16 h-16', icon: 'w-8 h-8', text: 'text-2xl', dot: 'w-3.5 h-3.5 border-[3px]', img: 'w-12 h-12' },
  xl: { dim: 'w-24 h-24', icon: 'w-12 h-12', text: 'text-4xl', dot: 'w-4 h-4 border-[3px]', img: 'w-18 h-18' },
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
}: PlayerAvatarProps) {
  const config = SIZE_CONFIG[size];
  const theme: ColorTheme = getColorTheme(skinColor);
  const avatar = getAvatarIcon(skinIcon);
  const rainbow = isRainbow(skinColor);

  // "default" or no icon → show first letter of username
  const useInitial = (!skinIcon || skinIcon === 'default') && fallbackInitial;
  // image-based avatar (e.g. horse)
  const useImage = avatar.imageSrc && skinIcon && skinIcon !== 'default';

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          config.dim,
          'rounded-full flex items-center justify-center overflow-hidden',
          !rainbow && 'bg-gradient-to-br',
          !rainbow && theme.from,
          !rainbow && theme.to,
        )}
        style={rainbow ? RAINBOW_STYLE : undefined}
      >
        {useImage ? (
          <img
            src={avatar.imageSrc}
            alt={avatar.label}
            className={cn(config.img, 'rounded-full object-cover')}
            draggable={false}
          />
        ) : useInitial ? (
          <span className={cn('text-white font-bold', config.text)}>
            {fallbackInitial.charAt(0).toUpperCase()}
          </span>
        ) : (
          <span className={cn('text-white font-bold', config.text)}>
            {fallbackInitial ? fallbackInitial.charAt(0).toUpperCase() : '?'}
          </span>
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
