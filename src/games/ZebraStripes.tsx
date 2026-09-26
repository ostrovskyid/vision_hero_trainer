import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useLater, tintStyle } from './common';

/**
 * Perceptual learning with stripe patches (Gabor patches), the stimulus used
 * in most amblyopia perceptual-learning studies. Two windows; a zebra is
 * hiding in the one with faint stripes. The stripes fade after two finds in a
 * row and come back after a miss (a 2-down/1-up staircase), so the game
 * settles near the faintest stripes the child can see.
 *
 * Stripe size is set in cycles per degree for a tablet held at about 40 cm,
 * using the screen calibration from the picture check when there is one.
 * Orientations are horizontal and vertical, plus the diagonals on hard.
 */

const VIEW_CM = 40;
const LEVELS = {
  easy: { cpd: 2, orientations: [0, 90] },
  medium: { cpd: 4, orientations: [0, 90] },
  hard: { cpd: 6, orientations: [0, 90, 45, 135] },
} as const;
const START_CONTRAST = 0.6;
const MIN_CONTRAST = 0.02;
const STEP = 0.8;

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/**
 * Draws one window: a mid-level field, with a Gabor patch when `stripes`.
 * In anaglyph mode the field is half the target colour, so everything sits in
 * the target eye's channel and the other eye sees only black.
 */
const paintWindow = (
  canvas: HTMLCanvasElement, stripes: boolean, contrast: number, cyclesPerPx: number, angleDeg: number, tint: string | null,
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const [tr, tg, tb] = tint ? hexToRgb(tint) : [255, 255, 255];
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const sigma = Math.min(w, h) / 6;
  const phase = Math.random() * Math.PI * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2, dy = y - h / 2;
      let level = 0.5;
      if (stripes) {
        const envelope = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        const u = dx * cos + dy * sin;
        level += 0.5 * contrast * envelope * Math.sin(2 * Math.PI * cyclesPerPx * u + phase);
      }
      const i = (y * w + x) * 4;
      img.data[i] = level * tr;
      img.data[i + 1] = level * tg;
      img.data[i + 2] = level * tb;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
};

const StripeWindow = ({ stripes, contrast, cpd, angle, size, pxPerMm, tint }: {
  stripes: boolean; contrast: number; cpd: number; angle: number; size: number; pxPerMm: number; tint: string | null;
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const pxPerDegCss = VIEW_CM * 10 * Math.tan(Math.PI / 180) * pxPerMm;
    // Never finer than 4 device pixels a cycle, or the screen draws mush instead of stripes.
    const cyclesPerPx = Math.min(cpd / (pxPerDegCss * dpr), 1 / 4);
    paintWindow(canvas, stripes, contrast, cyclesPerPx, angle, tint);
  }, [stripes, contrast, cpd, angle, size, pxPerMm, tint]);
  return <canvas ref={ref} style={{ width: size, height: size, display: 'block', borderRadius: 24 }} />;
};

export const ZebraStripes = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [side, setSide] = useState<0 | 1>(0);
  const [angle, setAngle] = useState(0);
  const [contrast, setContrast] = useState(START_CONTRAST);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newRound = () => {
    setSide(Math.random() < 0.5 ? 0 : 1);
    setAngle(level.orientations[Math.floor(Math.random() * level.orientations.length)]);
    setReveal(null);
    setRound(r => r + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
    speak('A zebra is hiding in the stripes. Where is it?', config.voiceEnabled);
  };

  const choose = (i: number) => {
    if (!isPlaying || reveal !== null) return;
    setRounds(r => r + 1);
    if (i === side) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setReveal(i);
      // Two in a row: fainter stripes.
      if (streak + 1 >= 2) {
        setContrast(c => Math.max(MIN_CONTRAST, c * STEP));
        setStreak(0);
      } else {
        setStreak(s => s + 1);
      }
      later(newRound, 900);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(i);
      setStreak(0);
      // A miss: stronger stripes, and show where the zebra was.
      setContrast(c => Math.min(START_CONTRAST, c / STEP));
      setReveal(side);
      later(() => setWrong(null), 400);
      later(newRound, 1300);
    }
  };

  const pxPerMm = config.pxPerMm > 0 ? config.pxPerMm : 96 / 25.4;
  const size = Math.max(150, Math.min(260, config.size * 5));
  const tint = config.anaglyphMode ? config.anaglyphTarget : null;

  return (
    <div className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8">
      {!started && (
        <StartOverlay label="Find the Zebras" hint="Tap the window with the stripes!" onStart={start}>
          <div className="text-6xl">🦓</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <div className="flex flex-wrap items-center justify-center gap-6 px-4 md:gap-12">
          {[0, 1].map(i => (
            <motion.button
              key={`${round}-${i}`}
              onClick={() => choose(i)}
              aria-label={i === 0 ? 'First window' : 'Second window'}
              animate={wrong === i ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              className="relative rounded-3xl border-4 border-slate-700 p-1"
            >
              <StripeWindow
                stripes={i === side} contrast={contrast} cpd={level.cpd} angle={angle}
                size={size} pxPerMm={pxPerMm} tint={tint}
              />
              {reveal === i && (
                <motion.span
                  className="absolute inset-0 flex items-center justify-center text-7xl"
                  style={tintStyle(config, 'target')}
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  🦓
                </motion.span>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};
