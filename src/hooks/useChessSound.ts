/**
 * Chess Sound Effects Hook
 * Plays sounds for moves, captures, checks, and game events
 */

import { useCallback, useRef, useEffect } from 'react';

// Sound URLs - using base64 encoded short sounds for reliability
// These are simple tones that work across browsers
const SOUNDS = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  gameEnd: '/sounds/game-end.mp3',
} as const;

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

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
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

      // Envelope for nice sound
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
    }
  }, []);

  const playSound = useCallback((type: SoundType) => {
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
  }, [playTone]);

  return {
    playMove: useCallback(() => playSound('move'), [playSound]),
    playCapture: useCallback(() => playSound('capture'), [playSound]),
    playCheck: useCallback(() => playSound('check'), [playSound]),
    playGameEnd: useCallback(() => playSound('gameEnd'), [playSound]),
  };
};
