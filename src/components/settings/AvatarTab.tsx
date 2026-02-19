import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useUserDataStore } from '@/stores/userDataStore';
import { supabase } from '@/integrations/supabase/client';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { COLOR_THEMES, ANIMAL_ICONS } from '@/lib/skinConfig';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function AvatarTab() {
  const { user } = useAuth();
  const { skinColor, skinIcon, displayName } = useProfile();
  const [selectedColor, setSelectedColor] = useState(skinColor);
  const [selectedIcon, setSelectedIcon] = useState(skinIcon);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Preview */}
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
            />
            <p className="text-sm font-medium text-muted-foreground">
              {displayName ?? 'Player'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Color Theme */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Color Theme</CardTitle>
          <CardDescription>Choose your avatar gradient</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(COLOR_THEMES).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => setSelectedColor(key)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                  selectedColor === key
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-muted-foreground/50',
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full',
                    theme.preview,
                  )}
                />
                {selectedColor === key && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <span className="text-[11px] font-medium text-muted-foreground">
                  {theme.label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Animal Icon */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Animal Icon</CardTitle>
          <CardDescription>Pick your avatar icon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(ANIMAL_ICONS).map(([key, animal]) => {
              const Icon = animal.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedIcon(key)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    selectedIcon === key
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-muted-foreground/50',
                  )}
                >
                  <Icon className="w-6 h-6 text-foreground" />
                  {selectedIcon === key && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {animal.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-8 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg',
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
