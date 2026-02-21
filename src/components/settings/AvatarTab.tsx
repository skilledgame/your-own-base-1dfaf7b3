import { useState } from 'react';
import { Check, Sparkles, Lock, Crown, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useUserDataStore } from '@/stores/userDataStore';
import { supabase } from '@/integrations/supabase/client';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  COLOR_THEMES,
  AVATAR_ICONS,
  FREE_THEMES,
  RANK_THEMES,
  PREMIUM_THEMES,
  hasReachedRank,
} from '@/lib/skinConfig';
import { getRankFromTotalWagered } from '@/lib/rankSystem';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Inline rainbow preview style (mirrors PlayerAvatar rainbow) */
const RAINBOW_PREVIEW_STYLE: React.CSSProperties = {
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

export function AvatarTab() {
  const { user } = useAuth();
  const { skinColor, skinIcon, displayName, totalWageredSc } = useProfile();
  const [selectedColor, setSelectedColor] = useState(skinColor);
  const [selectedIcon, setSelectedIcon] = useState(skinIcon);
  const [saving, setSaving] = useState(false);

  const rankInfo = getRankFromTotalWagered(totalWageredSc);
  const currentTier = rankInfo.tierName;

  const hasChanges = selectedColor !== skinColor || selectedIcon !== skinIcon;

  const handleSave = async () => {
    if (!user?.id || !hasChanges) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ skin_color: selectedColor, skin_icon: selectedIcon })
        .eq('user_id', user.id);

      if (error) throw error;

      const store = useUserDataStore.getState();
      if (store.profile) {
        useUserDataStore.setState({
          profile: {
            ...store.profile,
            skin_color: selectedColor,
            skin_icon: selectedIcon,
          },
        });
      }

      toast.success('Avatar updated!');
    } catch {
      toast.error('Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  /** Try to select a color — guard against locked themes */
  const handleColorSelect = (key: string) => {
    const theme = COLOR_THEMES[key];
    if (!theme) return;

    // Premium themes are locked
    if (theme.isPremium) return;

    // Rank themes need the rank
    if (theme.category === 'rank' && theme.requiredRank) {
      if (!hasReachedRank(currentTier, theme.requiredRank)) return;
    }

    setSelectedColor(key);
  };

  return (
    <div className="space-y-6">
      {/* ─── Preview ──────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Your Avatar</CardTitle>
              <CardDescription>Preview your avatar customization</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-4">
            <PlayerAvatar
              skinColor={selectedColor}
              skinIcon={selectedIcon}
              size="xl"
              fallbackInitial={displayName ?? 'P'}
            />
            <p className="text-sm font-medium text-muted-foreground">
              {displayName ?? 'Player'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Free Color Themes ────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Color Theme</CardTitle>
          <CardDescription>Choose your avatar color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {FREE_THEMES.map(([key, theme]) => {
              const isSelected = selectedColor === key;
              return (
                <button
                  key={key}
                  onClick={() => handleColorSelect(key)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-md border-2 transition-all',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-muted-foreground/50',
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-full', theme.preview)} />
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Rank Color Themes (unlockable) ───────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <div>
              <CardTitle className="text-lg font-semibold">Rank Colors</CardTitle>
              <CardDescription>
                Unlock exclusive colors by reaching higher ranks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {RANK_THEMES.map(([key, theme]) => {
              const isUnlocked = hasReachedRank(currentTier, theme.requiredRank!);
              const isSelected = selectedColor === key;

              return (
                <button
                  key={key}
                  onClick={() => handleColorSelect(key)}
                  disabled={!isUnlocked}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-md border-2 transition-all',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : isUnlocked
                      ? 'border-border hover:border-muted-foreground/50'
                      : 'border-border/50 opacity-50 cursor-not-allowed',
                  )}
                >
                  <div className="relative">
                    <div className={cn('w-10 h-10 rounded-full overflow-hidden relative', theme.preview)}>
                      {/* Animated shine sweep */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                          width: '50%',
                          height: '200%',
                          top: '-50%',
                          animation: 'rank-shine 2.5s ease-in-out infinite',
                          animationDelay: `${RANK_THEMES.findIndex(([k]) => k === key) * 0.35}s`,
                        }}
                      />
                    </div>
                    {!isUnlocked && (
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-white/80" />
                      </div>
                    )}
                  </div>
                  {isSelected && isUnlocked && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {theme.label}
                  </span>
                  {!isUnlocked && (
                    <span className="text-[9px] text-muted-foreground/60 capitalize">
                      {theme.requiredRank} rank
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Premium / Rainbow (subscription-locked) ──────────── */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-400" />
            <div>
              <CardTitle className="text-lg font-semibold">Premium</CardTitle>
              <CardDescription>Exclusive animated themes for subscribers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {PREMIUM_THEMES.map(([key, theme]) => {
              const isSelected = selectedColor === key;

              return (
                <button
                  key={key}
                  disabled
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-md border-2 transition-all',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-border/50 opacity-70 cursor-not-allowed',
                  )}
                >
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-full"
                      style={RAINBOW_PREVIEW_STYLE}
                    />
                    {/* Lock overlay */}
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                      <Lock className="w-4 h-4 text-white/90" />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {theme.label}
                  </span>
                  <span className="text-[9px] text-purple-400 font-semibold uppercase tracking-wider">
                    Coming Soon
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Avatar Style ─────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Avatar Style</CardTitle>
          <CardDescription>Choose your avatar icon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(AVATAR_ICONS).map(([key, avatar]) => {
              const isSelected = selectedIcon === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedIcon(key)}
                  className={cn(
                    'relative flex flex-col items-center gap-3 p-4 rounded-md border-2 transition-all',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-muted-foreground/50',
                  )}
                >
                  {avatar.imageSrc ? (
                    <img
                      src={avatar.imageSrc}
                      alt={avatar.label}
                      className="w-10 h-10 rounded-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-lg font-bold text-foreground">
                        {(displayName ?? 'P').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {avatar.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Save Button ──────────────────────────────────────── */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-8 py-3 rounded-md font-semibold text-sm transition-all shadow-lg',
              'bg-accent text-white hover:bg-accent/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {saving ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>
      )}
    </div>
  );
}
