import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useLater, tintStyle, sceneColor, shuffle } from './common';
import { RescuePup, pupName } from '../pups';

/**
 * The fire pup's rescue: small fires have broken out in a block of flats, and
 * some windows hold look-alikes (lamps, flowers, oranges, candles). Tap every
 * fire to spray it out. Discrimination of small, similar shapes packed close
 * together (crowding), with no clock pressure beyond the session: the task is
 * to look carefully, not fast. Windows shrink after each building is saved.
 */

const LEVELS = {
  easy: { cols: 3, rows: 3, fires: [1, 2], lookAlikes: ['🌷', '🐱', '🪴', '🧸'] },
  medium: { cols: 4, rows: 3, fires: [2, 3], lookAlikes: ['🌻', '🍊', '🏮', '🐱', '🌷'] },
  hard: { cols: 5, rows: 4, fires: [2, 4], lookAlikes: ['🕯️', '🏮', '🍊', '🌻', '🍁'] },
} as const;

interface Window { content: string | null; fire: boolean; out: boolean }

export const FireRescue = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'fire');
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [taps, setTaps] = useState(0);
  const [round, setRound] = useState(0);
  const [windows, setWindows] = useState<Window[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [windowSize, setWindowSize] = useState(Math.max(56, config.size * 1.8));

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, taps), onComplete);
  });

  const newBuilding = () => {
    const count = level.cols * level.rows;
    const [lo, hi] = level.fires;
    const fires = lo + Math.floor(Math.random() * (hi - lo + 1));
    const fillers = Math.floor((count - fires) * 0.6);
    const cells: Window[] = [
      ...Array.from({ length: fires }, () => ({ content: '🔥', fire: true, out: false })),
      ...Array.from({ length: fillers }, () => ({ content: level.lookAlikes[Math.floor(Math.random() * level.lookAlikes.length)], fire: false, out: false })),
    ];
    while (cells.length < count) cells.push({ content: null, fire: false, out: false });
    setWindows(shuffle(cells));
    setSaved(false);
    setRound(r => r + 1);
    speak(fires === 1 ? `${name} needs help! Find the fire!` : `${name} needs help! Find all ${fires} fires!`, config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newBuilding();
  };

  const tap = (i: number) => {
    if (!isPlaying || saved) return;
    const w = windows[i];
    if (w.out) return;
    setTaps(t => t + 1);
    if (w.fire) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      const next = windows.map((x, j) => (j === i ? { ...x, out: true } : x));
      setWindows(next);
      if (next.every(x => !x.fire || x.out)) {
        setSaved(true);
        setWindowSize(s => Math.max(34, s * 0.93));
        later(() => { playSound('honk', config.soundEnabled); speak('All the fires are out! Hooray!', config.voiceEnabled); }, 400);
        later(newBuilding, 2000);
      }
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(i);
      later(() => setWrong(null), 400);
    }
  };

  const wall = sceneColor(config, '#7c2d12');
  const frame = sceneColor(config, '#fbbf24');

  return (
    <div className="relative flex h-full min-h-[420px] w-full items-center justify-center gap-6 overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8 pt-12">
      {!started && (
        <StartOverlay label="Ready, Set, Rescue" hint={`Tap every fire to help ${name} spray it out!`} onStart={start}>
          <RescuePup role="fire" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          <motion.div
            className="hidden shrink-0 sm:block"
            animate={saved ? { y: [0, -18, 0] } : { y: 0 }}
            transition={{ duration: 0.6, repeat: saved ? 2 : 0 }}
          >
            <RescuePup role="fire" size={110} style={tintStyle(config, 'target')} />
          </motion.div>
          {/* The building (scenery); windows hold fires and look-alikes (target eye). */}
          <div className="rounded-t-2xl p-3" style={{ backgroundColor: wall }}>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${level.cols}, ${windowSize}px)` }}>
              {windows.map((w, i) => (
                <motion.button
                  key={`${round}-${i}`}
                  onClick={() => tap(i)}
                  aria-label={w.fire && !w.out ? 'Fire' : w.content ? 'Window' : 'Empty window'}
                  animate={wrong === i ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
                  transition={{ duration: 0.35 }}
                  className="relative flex items-center justify-center rounded-md bg-black"
                  style={{ width: windowSize, height: windowSize, border: `3px solid ${frame}` }}
                >
                  {w.content && !(w.fire && w.out) && (
                    <span className="leading-none" style={{ fontSize: windowSize * 0.6, ...tintStyle(config, 'target') }}>{w.content}</span>
                  )}
                  {w.fire && w.out && (
                    <motion.span
                      className="leading-none"
                      style={{ fontSize: windowSize * 0.5, ...tintStyle(config, 'target') }}
                      initial={{ scale: 1.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      💧
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
