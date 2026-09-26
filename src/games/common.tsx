import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

/**
 * `setTimeout` that is cancelled when the game closes. Games schedule the next
 * round (and its spoken instruction) a moment after a find; without this, a
 * session that ends or a tap on Back to Base in that moment would still speak
 * the next round's instruction over the results or home screen.
 */
export const useLater = () => {
  const ids = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = ids.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);
  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      ids.current.delete(id);
      fn();
    }, ms);
    ids.current.add(id);
    return id;
  }, []);
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

/** Tracks an element's rendered size in CSS pixels. */
export const useElementSize = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
};

const hexToUnit = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

/** One colour-matrix row set that turns any picture into shades of `hex`. */
const tintMatrix = (hex: string) => {
  const [r, g, b] = hexToUnit(hex);
  // Keep shading (so an emoji animal stays recognisable), lifted a little so
  // dark outlines do not vanish into the black background.
  const k = 0.85, lift = 0.15;
  const row = (c: number) => `${c * 0.3 * k} ${c * 0.59 * k} ${c * 0.11 * k} 0 ${c * lift}`;
  return `${row(r)} ${row(g)} ${row(b)} 0 0 0 1 0`;
};

/**
 * SVG filters that recolour anything - including full-colour emoji - into the
 * calibrated target or scenery colour, so picture-based games can take part
 * in anaglyph mode. Rendered once at the app root; applied with
 * `tintStyle(config, 'target' | 'scene')`.
 */
export const AnaglyphFilters = ({ target, scene }: { target: string; scene: string }) => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <filter id="ag-tint-target" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={tintMatrix(target)} />
    </filter>
    <filter id="ag-tint-scene" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={tintMatrix(scene)} />
    </filter>
  </svg>
);

/** Style for an element that one eye should see: tinted in anaglyph mode, untouched otherwise. */
export const tintStyle = (config: GameConfig, role: 'target' | 'scene') =>
  config.anaglyphMode ? { filter: `url(#ag-tint-${role})` } : {};

/** Target colour in anaglyph mode, otherwise the given normal colour. */
export const targetColor = (config: GameConfig, normal: string) => (config.anaglyphMode ? config.anaglyphTarget : normal);
/** Scenery colour in anaglyph mode, otherwise the given normal colour. */
export const sceneColor = (config: GameConfig, normal: string) => (config.anaglyphMode ? config.anaglyphScene : normal);

export const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

export const shuffle = <T,>(items: readonly T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
