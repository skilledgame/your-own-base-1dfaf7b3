/**
 * Preferences Tab - Theme, Sound, Notifications
 */

import { useState } from 'react';
import { Sun, Moon, Volume2, VolumeX, Bell, BellOff, Globe, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

export function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState([75]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [gameNotifications, setGameNotifications] = useState(true);
  const [promotionalNotifications, setPromotionalNotifications] = useState(false);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Appearance</CardTitle>
              <CardDescription>Customize how Skilled looks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">Theme</p>
                <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
              </div>
            </div>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-32 bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === 'light' 
                  ? 'border-accent bg-accent/10' 
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <div className="w-full h-16 rounded-lg bg-white border border-gray-200 mb-2 flex items-center justify-center">
                <Sun className="w-6 h-6 text-yellow-500" />
              </div>
              <p className="text-xs font-medium">Light</p>
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === 'dark' 
                  ? 'border-accent bg-accent/10' 
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <div className="w-full h-16 rounded-lg bg-slate-900 border border-slate-700 mb-2 flex items-center justify-center">
                <Moon className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-xs font-medium">Dark</p>
            </button>
            <button
              onClick={() => handleThemeChange('system')}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === 'system' 
                  ? 'border-accent bg-accent/10' 
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <div className="w-full h-16 rounded-lg bg-gradient-to-r from-white to-slate-900 border mb-2 flex items-center justify-center">
                <Globe className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-xs font-medium">System</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Sound Settings */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              {soundEnabled ? (
                <Volume2 className="w-5 h-5 text-accent" />
              ) : (
                <VolumeX className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">Sound</CardTitle>
              <CardDescription>Game audio settings</CardDescription>
            </div>
            <Switch 
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>
        </CardHeader>
        {soundEnabled && (
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Volume</p>
                <span className="text-sm text-muted-foreground">{soundVolume[0]}%</span>
              </div>
              <Slider
                value={soundVolume}
                onValueChange={setSoundVolume}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Move Sounds</p>
                <Switch defaultChecked />
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Win/Lose</p>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Notifications */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {notificationsEnabled ? (
                <Bell className="w-5 h-5 text-primary" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
              <CardDescription>Manage your notification preferences</CardDescription>
            </div>
            <Switch 
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
            />
          </div>
        </CardHeader>
        {notificationsEnabled && (
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <p className="font-medium text-sm">Game Invites</p>
                <p className="text-xs text-muted-foreground">Get notified when someone invites you</p>
              </div>
              <Switch 
                checked={gameNotifications}
                onCheckedChange={setGameNotifications}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <p className="font-medium text-sm">Match Results</p>
                <p className="text-xs text-muted-foreground">Updates on your game outcomes</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <p className="font-medium text-sm">Promotional</p>
                <p className="text-xs text-muted-foreground">Special offers and tournaments</p>
              </div>
              <Switch 
                checked={promotionalNotifications}
                onCheckedChange={setPromotionalNotifications}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Language */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Globe className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">Language</CardTitle>
              <CardDescription>Choose your preferred language</CardDescription>
            </div>
            <Select defaultValue="en">
              <SelectTrigger className="w-32 bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
