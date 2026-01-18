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
      console.warn('[Sound] Failed to play tone:', e);
    }
  }, []);

  const playSound = useCallback((type: SoundType) => {
    // Prevent double-plays
    const now = Date.now();
    if (now - lastPlayedRef.current < minIntervalMs) {
      return;
    }
    lastPlayedRef.current = now;

    // Play appropriate sound using Web Audio API
    switch (type) {
      case 'move':
        // Short click sound - wooden piece on board
        playTone(800, 0.08, 'triangle');
        setTimeout(() => playTone(400, 0.05, 'sine'), 20);
        break;
      
      case 'capture':
        // More aggressive sound for captures
        playTone(600, 0.1, 'sawtooth');
        setTimeout(() => playTone(300, 0.15, 'triangle'), 30);
        break;
      
      case 'check':
        // Warning tone for check
        playTone(880, 0.15, 'square');
        setTimeout(() => playTone(660, 0.1, 'square'), 100);
        break;
      
      case 'gameEnd':
        // Final chord
        playTone(440, 0.3, 'sine');
        playTone(554, 0.3, 'sine');
        playTone(659, 0.3, 'sine');
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
