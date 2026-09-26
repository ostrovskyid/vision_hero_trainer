import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, tintStyle, targetColor, sceneColor, shuffle, useLater } from './common';
import { t } from '../i18n';

/**
 * Two small zoo pictures side by side; find what is different. Comparing them
 * means jumping the eyes back and forth between matching spots, a relaxed
 * saccade and attention exercise. No timer pressure: after a while without a
 * find, a sparkle hints at one of the differences.
 */

const ITEMS = ['🐧', '🐟', '🎩', '🌴', '🦁', '🐘', '🍌', '⭐', '🎈', '🦓', '🐒', '🍦', '🌸', '🐢', '🦜', '🐠'];

type Change = 'missing' | 'swap' | 'size';

interface Cell { emoji: string; x: number; y: number; scale: number; }
interface Difference { cell: number; change: Change; emoji: string; scale: number; }

const LEVELS = {
  easy: { cols: 3, rows: 2, diffs: 2, changes: ['missing', 'swap'] as Change[] },
  medium: { cols: 3, rows: 3, diffs: 3, changes: ['missing', 'swap'] as Change[] },
  hard: { cols: 4, rows: 3, diffs: 3, changes: ['missing', 'swap', 'size'] as Change[] },
} as const;

const HINT_AFTER_MS = 15000;

export const SpotDifference = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const level = LEVELS[config.difficulty];
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [diffs, setDiffs] = useState<Difference[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [hint, setHint] = useState<number | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newScene = () => {
    const count = level.cols * level.rows;
    const emojis = shuffle(ITEMS).slice(0, count);
    const next = emojis.map((emoji, i) => ({
      emoji,
      x: ((i % level.cols) + 0.5 + (Math.random() - 0.5) * 0.4) / level.cols * 100,
      y: ((Math.floor(i / level.cols)) + 0.5 + (Math.random() - 0.5) * 0.3) / level.rows * 100,
      scale: 1,
    }));
    const spare = ITEMS.filter(e => !emojis.includes(e));
    const changed = shuffle(next.map((_, i) => i)).slice(0, level.diffs);
    setCells(next);
    setDiffs(changed.map((cell, k) => {
      const change = level.changes[k % level.changes.length];
      return {
        cell,
        change,
        emoji: change === 'swap' ? spare[k % spare.length] : next[cell].emoji,
        scale: change === 'size' ? 0.6 : 1,
      };
    }));
    setFound([]);
    setHint(null);
    setRound(r => r + 1);
    speak(t('Find {n} things that are different!', { n: level.diffs }), config.voiceEnabled);
  };

  // A sparkle after a long search, so nobody gets stuck.
  useEffect(() => {
    if (!isPlaying || diffs.length === 0) return;
    setHint(null);
    const id = setTimeout(() => {
      const left = diffs.filter(d => !found.includes(d.cell));
      if (left.length) setHint(left[0].cell);
    }, HINT_AFTER_MS);
    return () => clearTimeout(id);
  }, [found, diffs, isPlaying]);

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newScene();
  };

  const tap = (cell: number, panel: string) => {
    // Tapping a difference that is already circled is neither a find nor a miss.
    if (!isPlaying || found.length === diffs.length || found.includes(cell)) return;
    setRounds(r => r + 1);
    if (diffs.some(d => d.cell === cell)) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      const now = [...found, cell];
      setFound(now);
      if (now.length === diffs.length) {
        speak(t('You found them all!'), config.voiceEnabled);
        later(newScene, 1500);
      }
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(`${panel}-${cell}`);
      later(() => setWrong(null), 400);
    }
  };

  const itemSize = Math.max(36, config.size * 1.1);
  const ring = targetColor(config, '#facc15');
  const frame = sceneColor(config, '#334155');

  const Panel = ({ side }: { side: 'left' | 'right' }) => (
    <div
      className="relative aspect-[4/3] w-full max-w-md rounded-2xl bg-black"
      style={{ border: `4px solid ${frame}` }}
    >
      {cells.map((cell, i) => {
        const diff = side === 'right' ? diffs.find(d => d.cell === i) : undefined;
        const missing = diff?.change === 'missing';
        const emoji = diff ? diff.emoji : cell.emoji;
        const scale = diff ? diff.scale : cell.scale;
        const isFound = found.includes(i);
        return (
          <motion.button
            key={`${round}-${side}-${i}`}
            onClick={() => tap(i, side)}
            aria-label={missing ? t('Empty spot') : emoji}
            animate={wrong === `${side}-${i}` ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            style={{
              left: `${cell.x}%`,
              top: `${cell.y}%`,
              width: Math.max(44, itemSize * 1.25),
              height: Math.max(44, itemSize * 1.25),
              boxShadow: isFound ? `0 0 0 4px ${ring}` : undefined,
            }}
          >
            {!missing && (
              <span className="leading-none" style={{ fontSize: itemSize * scale, ...tintStyle(config, 'target') }}>{emoji}</span>
            )}
            {hint === i && side === 'right' && !isFound && (
              <motion.span
                className="absolute text-xl"
                style={{ right: -6, top: -6 }}
                animate={{ scale: [0.6, 1.3, 0.6], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                ✨
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8 pt-12">
      {!started && (
        <StartOverlay label={t('Open the Pictures')} hint={t("The two pictures are nearly the same. Find what's different!")} onStart={start}>
          <div className="text-6xl" style={tintStyle(config, 'target')}>🐧🔍</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          <div className="mb-3 flex gap-2" aria-label={t('{found} of {total} found', { found: found.length, total: diffs.length })}>
            {diffs.map((_, i) => (
              <div
                key={i}
                className="h-5 w-5 rounded-full"
                style={{ border: `3px solid ${ring}`, backgroundColor: i < found.length ? ring : 'transparent' }}
              />
            ))}
          </div>
          <div className="flex w-full flex-col items-center justify-center gap-3 px-3 sm:flex-row sm:gap-5">
            {Panel({ side: 'left' })}
            {Panel({ side: 'right' })}
          </div>
        </>
      )}
    </div>
  );
};
