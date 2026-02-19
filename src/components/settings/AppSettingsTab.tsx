/**
 * App Settings Tab — Notifications, Sound Effects & Volume
 *
 * Persists all preferences to localStorage so they survive page reloads.
 * Other parts of the app can read these values via the exported helpers.
 */

import { useState, useCallback } from 'react';
import {
  Bell, BellOff, Volume2, VolumeX, Volume1,
  Mail, MessageSquare, Smartphone,
  Swords, MousePointerClick, Music,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

// ─── Storage helpers ───────────────────────────────────────────
const STORAGE_KEY = 'app_settings';

export interface AppSettings {
  // Notifications
  pushNotifications: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;

  // Sound
  gameSounds: boolean;
  uiSounds: boolean;

  // Volume (0–100)
  masterVolume: number;
  gameSoundsVolume: number;
  uiSoundsVolume: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  pushNotifications: true,
  emailNotifications: true,
  inAppNotifications: true,
  gameSounds: true,
  uiSounds: true,
  masterVolume: 80,
  gameSoundsVolume: 100,
  uiSoundsVolume: 70,
};

/** Read stored settings (call from anywhere in the app). */
export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// ─── Component ─────────────────────────────────────────────────

export function AppSettingsTab() {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveAppSettings(next);
        // Dispatch a custom event so other parts of the app can react in real-time
        window.dispatchEvent(new CustomEvent('app-settings-change', { detail: next }));
        return next;
      });
    },
    [],
  );

  const effectiveMaster = settings.masterVolume / 100;

  return (
    <div className="space-y-6">
      {/* ── Notifications ─────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {settings.pushNotifications || settings.emailNotifications || settings.inAppNotifications ? (
                <Bell className="w-5 h-5 text-primary" />
              ) : (
                <BellOff className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Push */}
          <SettingRow
            icon={<Smartphone className="w-4 h-4" />}
            label="Push Notifications"
            description="Receive browser push notifications"
          >
            <Switch
              checked={settings.pushNotifications}
              onCheckedChange={(v) => update('pushNotifications', v)}
            />
          </SettingRow>

          <Separator />

          {/* Email */}
          <SettingRow
            icon={<Mail className="w-4 h-4" />}
            label="Email Notifications"
            description="Get important updates via email"
          >
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(v) => update('emailNotifications', v)}
            />
          </SettingRow>

          <Separator />

          {/* In-app */}
          <SettingRow
            icon={<MessageSquare className="w-4 h-4" />}
            label="In-App Notifications"
            description="Show notification bell and toasts in the app"
          >
            <Switch
              checked={settings.inAppNotifications}
              onCheckedChange={(v) => update('inAppNotifications', v)}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* ── Sound Effects ─────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              {settings.gameSounds || settings.uiSounds ? (
                <Volume2 className="w-5 h-5 text-accent" />
              ) : (
                <VolumeX className="w-5 h-5 text-accent" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Sound Effects</CardTitle>
              <CardDescription>Toggle sounds on or off</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Game sounds */}
          <SettingRow
            icon={<Swords className="w-4 h-4" />}
            label="Game Sounds"
            description="Move, capture, check, and game-end sounds"
          >
            <Switch
              checked={settings.gameSounds}
              onCheckedChange={(v) => update('gameSounds', v)}
            />
          </SettingRow>

          <Separator />

          {/* UI sounds */}
          <SettingRow
            icon={<MousePointerClick className="w-4 h-4" />}
            label="UI Sounds"
            description="Button clicks and interface feedback"
          >
            <Switch
              checked={settings.uiSounds}
              onCheckedChange={(v) => update('uiSounds', v)}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* ── Volume ────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Volume</CardTitle>
              <CardDescription>Adjust audio levels</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master */}
          <VolumeSlider
            icon={
              settings.masterVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              ) : settings.masterVolume < 50 ? (
                <Volume1 className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              )
            }
            label="Master Volume"
            value={settings.masterVolume}
            onChange={(v) => update('masterVolume', v)}
          />

          <Separator />

          {/* Game sounds volume */}
          <VolumeSlider
            icon={<Swords className="w-4 h-4 text-muted-foreground" />}
            label="Game Sounds"
            value={settings.gameSoundsVolume}
            onChange={(v) => update('gameSoundsVolume', v)}
            disabled={!settings.gameSounds}
            effectiveVolume={Math.round(settings.gameSoundsVolume * effectiveMaster)}
          />

          <Separator />

          {/* UI sounds volume */}
          <VolumeSlider
            icon={<MousePointerClick className="w-4 h-4 text-muted-foreground" />}
            label="UI Sounds"
            value={settings.uiSoundsVolume}
            onChange={(v) => update('uiSoundsVolume', v)}
            disabled={!settings.uiSounds}
            effectiveVolume={Math.round(settings.uiSoundsVolume * effectiveMaster)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────

/** A row with icon + label + description on the left, control on the right. */
function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <Label className="text-sm font-medium leading-none">{label}</Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Labeled slider with optional effective-volume indicator. */
function VolumeSlider({
  icon,
  label,
  value,
  onChange,
  disabled,
  effectiveVolume,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  effectiveVolume?: number;
}) {
  return (
    <div className={cn('space-y-2', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {effectiveVolume !== undefined && (
            <span className="text-[11px] text-muted-foreground/60">
              eff.&nbsp;{effectiveVolume}%
            </span>
          )}
          <span className="text-sm tabular-nums text-muted-foreground w-10 text-right">
            {value}%
          </span>
        </div>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
      />
    </div>
  );
}
