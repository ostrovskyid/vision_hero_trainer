import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Play } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { GameConfig, GameStats } from '../types';
import { playSound } from '../feedback';

export interface GameProps {
  config: GameConfig;
  onComplete: (stats: GameStats) => void;
}

/**
 * Counts a session down from `config.duration` while `isPlaying`, and calls
 * `onFinish` once when it reaches zero. Wall-clock based, so a slow frame or a
 * busy tablet does not stretch the session.
 */
export const useSessionTimer = (duration: number, isPlaying: boolean, onFinish: () => void) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    if (!isPlaying) return;
    const startedAt = performance.now();
    const id = setInterval(() => {
      const left = Math.max(0, duration - (performance.now() - startedAt) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(id);
        finishRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [isPlaying, duration]);

  return timeLeft;
};

/** The shared end-of-session fanfare: sound, confetti and the stats hand-off. */
export const finishSession = (config: GameConfig, score: number, rounds: number, onComplete: (stats: GameStats) => void) => {
  playSound('complete', config.soundEnabled);
  confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
  onComplete({
    score,
    timeSpent: config.duration,
    accuracy: rounds > 0 ? score / rounds : 0,
    date: new Date().toISOString(),
  });
};

/** Start screen with a picture-first prompt and one big button. */
export const StartOverlay = ({ label, hint, onStart, children = null }: {
  label: string;
  hint: string;
  onStart: () => void;
  children?: ReactNode;
}) => (
  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70" onPointerDown={(e) => e.stopPropagation()}>
    <div className="flex flex-col items-center gap-5 px-6 text-center">
      {children}
      <p className="text-lg font-medium text-slate-300">{hint}</p>
      <Button size="lg" onClick={onStart} className="px-8 py-6 text-xl">
        <Play className="mr-2 h-6 w-6" /> {label}
      </Button>
    </div>
  </div>
);
