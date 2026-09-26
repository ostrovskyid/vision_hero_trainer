import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { scaleColor } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useLater, pick } from './common';

/**
 * Colouring within the lines, the calm pleoptic exercise that suits long
 * patching sessions. Pick a paint pot, tap each part of a vehicle picture to
 * fill it; when every part has colour, the vehicle drives off. Harder
 * pictures have more and smaller parts (lights, hubcaps, windows) and
 * thinner outlines, so each tap has to land precisely.
 */

interface Part { d: string; small?: boolean }
interface Picture { name: string; viewBox: string; width: number; height: number; parts: Part[] }

const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

// Parts are listed back to front: later parts sit on top and take the tap.
const ROCKET: Picture = {
  name: 'rocket', viewBox: '0 0 120 170', width: 120, height: 170,
  parts: [
    { d: 'M30 140 L10 160 L10 120 L30 100 Z' },
    { d: 'M90 140 L110 160 L110 120 L90 100 Z' },
    { d: 'M60 5 Q95 45 90 140 L30 140 Q25 45 60 5 Z' },
    { d: 'M60 5 Q80 25 85 45 L35 45 Q40 25 60 5 Z' },
    { d: circle(60, 80, 16) },
    { d: rect(34, 112, 52, 10) },
    { d: 'M40 140 L60 168 L80 140 Z' },
  ],
};

const FIRE_TRUCK: Picture = {
  name: 'fire truck', viewBox: '0 0 220 120', width: 220, height: 120,
  parts: [
    { d: rect(60, 40, 145, 50) },
    { d: 'M18 90 L18 56 L34 34 L60 34 L60 90 Z' },
    { d: rect(70, 22, 128, 10) },
    { d: 'M26 56 L38 42 L54 42 L54 58 Z' },
    { d: rect(60, 72, 145, 7) },
    { d: circle(132, 58, 11) },
    { d: rect(38, 26, 12, 7), small: true },
    { d: circle(48, 92, 15) },
    { d: circle(170, 92, 15) },
    { d: circle(48, 92, 5), small: true },
    { d: circle(170, 92, 5), small: true },
  ],
};

const BUS: Picture = {
  name: 'bus', viewBox: '0 0 220 120', width: 220, height: 120,
  parts: [
    { d: 'M14 90 L14 36 Q14 26 24 26 L198 26 Q208 26 208 36 L208 90 Z' },
    { d: rect(24, 36, 30, 22), small: true },
    { d: rect(60, 36, 30, 22), small: true },
    { d: rect(96, 36, 30, 22), small: true },
    { d: rect(132, 36, 30, 22), small: true },
    { d: rect(172, 36, 26, 48) },
    { d: rect(14, 66, 150, 6), small: true },
    { d: circle(200, 80, 4), small: true },
    { d: circle(50, 92, 14) },
    { d: circle(160, 92, 14) },
    { d: circle(50, 92, 5), small: true },
    { d: circle(160, 92, 5), small: true },
  ],
};

const PICTURES = { easy: [ROCKET], medium: [ROCKET, FIRE_TRUCK], hard: [FIRE_TRUCK, BUS] } as const;
const OUTLINE = { easy: 3, medium: 2, hard: 1.2 } as const;
const PAINTS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];

export const PaintVehicle = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [taps, setTaps] = useState(0);
  const [round, setRound] = useState(0);
  const [picture, setPicture] = useState<Picture>(ROCKET);
  const [fills, setFills] = useState<(string | null)[]>([]);
  const [paint, setPaint] = useState(0);
  const [done, setDone] = useState(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, taps), onComplete);
  });

  // In anaglyph mode everything, paint included, is drawn in shades of the
  // target colour, so the picture belongs to the target eye alone.
  const paints = config.anaglyphMode
    ? [1, 0.75, 0.5].map(k => scaleColor(config.anaglyphTarget, k))
    : PAINTS;
  const ink = config.anaglyphMode ? config.anaglyphTarget : '#f8fafc';

  const newPicture = () => {
    const next = pick(PICTURES[config.difficulty]);
    setPicture(next);
    setFills(next.parts.map(() => null));
    setDone(false);
    setRound(r => r + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newPicture();
    speak('Pick a colour, then tap a part to paint it!', config.voiceEnabled);
  };

  const fill = (i: number) => {
    if (!isPlaying || done) return;
    setTaps(t => t + 1);
    const colour = paints[paint % paints.length];
    const next = fills.map((f, j) => (j === i ? colour : f));
    if (fills[i] === null) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
    }
    setFills(next);
    if (next.every(f => f !== null)) {
      setDone(true);
      later(() => { playSound('honk', config.soundEnabled); speak(`What a beautiful ${picture.name}!`, config.voiceEnabled); }, 300);
      later(newPicture, 2000);
    }
  };

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8 pt-12">
      {!started && (
        <StartOverlay label="Open the Paint Shop" hint="Pick a colour, then tap each part to paint it!" onStart={start}>
          <div className="text-6xl">🎨🚒</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          <motion.svg
            key={round}
            viewBox={picture.viewBox}
            className="h-auto max-h-[60%] w-[88%] max-w-3xl"
            initial={{ x: -300, opacity: 0 }}
            animate={done ? { x: [0, 0, 600], opacity: [1, 1, 0] } : { x: 0, opacity: 1 }}
            transition={done ? { duration: 2, times: [0, 0.6, 1] } : { duration: 0.5 }}
            role="img"
            aria-label={`${picture.name} to paint`}
          >
            {picture.parts.map((part, i) => (
              <path
                key={i}
                d={part.d}
                fill={fills[i] ?? '#000000'}
                stroke={ink}
                strokeWidth={OUTLINE[config.difficulty]}
                strokeLinejoin="round"
                onClick={() => fill(i)}
                className="cursor-pointer"
              />
            ))}
          </motion.svg>

          {/* Paint pots. */}
          <div className="flex flex-wrap justify-center gap-3">
            {paints.map((c, i) => (
              <button
                key={c}
                onClick={() => setPaint(i)}
                aria-label={`Paint ${i + 1}`}
                aria-pressed={paint === i}
                className="h-14 w-14 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  transform: paint === i ? 'scale(1.18)' : undefined,
                  boxShadow: paint === i ? `0 0 0 4px #020617, 0 0 0 7px ${ink}` : undefined,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
