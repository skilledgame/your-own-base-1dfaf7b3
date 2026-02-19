/**
 * Chess Sound Effects Hook
 * Plays sounds for moves, captures, checks, and game events.
 *
 * Reads "Game Sounds" toggle + Master / Game volume sliders from App Settings.
 * Listens to the `app-settings-change` custom event so changes apply in real-time
 * without reloading the page.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { getAppSettings, type AppSettings } from '@/components/settings/AppSettingsTab';

// Fallback: Generate sounds using Web Audio API
const createAudioContext = () => {
  if (typeof window !== 'undefined' && window.AudioContext) {
    return new AudioContext();
  }
  return null;
};

type SoundType = 'move' | 'capture' | 'check' | 'gameEnd';

export const useChessSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef<number>(0);
  const minIntervalMs = 50; // Prevent double-plays

  // Live settings — re-render when they change
  const [settings, setSettings] = useState<AppSettings>(getAppSettings);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener('app-settings-change', handler);
    return () => window.removeEventListener('app-settings-change', handler);
  }, []);

  // Initialize audio context on first interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = createAudioContext();
      }
    };
    
    // Initialize on user interaction
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
    
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, []);

  // Compute the effective gain: master × game volume (both 0–100 → 0–1)
  const effectiveGain = (settings.masterVolume / 100) * (settings.gameSoundsVolume / 100);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    // Bail out if game sounds are disabled or effective volume is zero
    if (!settings.gameSounds || effectiveGain === 0) return;

    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      // Resume context if suspended
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      // Peak gain scales with effective volume (default was 0.3)
      const peakGain = 0.3 * effectiveGain;

      // Envelope for nice sound
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      // ignore
    }
  }, [settings.gameSounds, effectiveGain]);

  const playSound = useCallback((type: SoundType) => {
    // Bail out early if sounds are off
    if (!settings.gameSounds || effectiveGain === 0) return;

    // Prevent double-plays
    const now = Date.now();
    if (now - lastPlayedRef.current < minIntervalMs) {
      return;
    }
    lastPlayedRef.current = now;

    // Play subtle sound effects using Web Audio API
    switch (type) {
      case 'move':
        // Subtle soft click - gentle wooden tap
        playTone(300, 0.04, 'sine');
        break;
      
      case 'capture':
        // Slightly stronger but still subtle
        playTone(250, 0.06, 'sine');
        setTimeout(() => playTone(180, 0.04, 'sine'), 25);
        break;
      
      case 'check':
        // Soft alert tone
        playTone(400, 0.08, 'sine');
        setTimeout(() => playTone(350, 0.06, 'sine'), 60);
        break;
      
      case 'gameEnd':
        // Gentle chord
        playTone(330, 0.2, 'sine');
        playTone(415, 0.2, 'sine');
        playTone(495, 0.2, 'sine');
        break;
    }
  }, [playTone, settings.gameSounds, effectiveGain]);

  return {
    playMove: useCallback(() => playSound('move'), [playSound]),
    playCapture: useCallback(() => playSound('capture'), [playSound]),
    playCheck: useCallback(() => playSound('check'), [playSound]),
    playGameEnd: useCallback(() => playSound('gameEnd'), [playSound]),
  };
};
