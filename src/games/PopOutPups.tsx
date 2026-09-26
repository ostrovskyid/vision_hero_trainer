import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useLater } from './common';

/**
 * Stereopsis with red/cyan glasses. Every pup is drawn twice, once in each
 * eye's colour, offset sideways. The odd pup's copies are offset the other
 * way round, so with both eyes working together it floats out of the screen
 * while the rest sink behind it. All pups carry the same size of offset, so
 * without binocular vision there is nothing to tell them apart.
 *
 * Assumes the target-colour filter sits over the LEFT eye (standard red-left
 * glasses). If the lenses are the other way round the odd pup sinks instead of
 * floating; it is still the only one that looks different, so the game works.
 *
 * On hard, every other round is a random-dot stereogram: a floating circle
 * hidden in noise that neither eye can see alone.
 */

const DISPARITY = {
  easy: { start: 16, min: 6 },
  medium: { start: 12, min: 4 },
  hard: { start: 8, min: 2 },
} as const;

const SLOTS = { easy: 3, medium: 4, hard: 4 } as const;

// Random-dot stereograms are drawn on a coarse grid and scaled up crisply.
const RDS_CELLS = 56;
const RDS_RADIUS = 16;

const Pup = ({ color, size }: { color: string; size: number }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ mixBlendMode: 'screen', display: 'block' }}>
    {/* Filled shapes: outlines would let the two copies overlap and cancel out. */}
    <ellipse cx="20" cy="42" rx="14" ry="26" fill={color} />
    <ellipse cx="80" cy="42" rx="14" ry="26" fill={color} />
    <circle cx="50" cy="54" r="34" fill={color} />
    <circle cx="38" cy="48" r="5" fill="#000" />
    <circle cx="62" cy="48" r="5" fill="#000" />
    <ellipse cx="50" cy="64" rx="8" ry="6" fill="#000" />
  </svg>
);

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/**
 * Paints one random-dot stereogram tile. The whole background sits `shift`
 * cells behind the screen, so every tile shows the same red/cyan speckle and
 * nothing gives the answer away to one eye alone. With `disc`, a central disc
 * floats the same distance in front of the screen instead.
 */
const paintStereogram = (canvas: HTMLCanvasElement, shift: number, disc: boolean, left: string, right: string) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const n = RDS_CELLS;
  const leftEye = new Uint8Array(n * n);
  for (let i = 0; i < leftEye.length; i++) leftEye[i] = Math.random() < 0.5 ? 1 : 0;
  const rightEye = new Uint8Array(n * n);
  const c = n / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const inDisc = disc && (x - c) ** 2 + (y - c) ** 2 <= RDS_RADIUS ** 2;
      // Crossed disparity (right eye sees it further left) floats in front;
      // uncrossed sinks behind. Wrap at the edges so no strip is left empty.
      const src = (x + (inDisc ? shift : -shift) + n) % n;
      rightEye[y * n + x] = leftEye[y * n + src];
    }
  }
  const [lr, lg, lb] = hexToRgb(left);
  const [rr, rg, rb] = hexToRgb(right);
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const l = leftEye[i], r = rightEye[i];
    img.data[i * 4] = Math.min(255, l * lr + r * rr);
    img.data[i * 4 + 1] = Math.min(255, l * lg + r * rg);
    img.data[i * 4 + 2] = Math.min(255, l * lb + r * rb);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

const StereoTile = ({ shift, disc, left, right, size }: { shift: number; disc: boolean; left: string; right: string; size: number }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) paintStereogram(ref.current, shift, disc, left, right);
  }, [shift, disc, left, right]);
  return (
    <canvas
      ref={ref}
      width={RDS_CELLS}
      height={RDS_CELLS}
      style={{ width: size, height: size, imageRendering: 'pixelated', display: 'block' }}
    />
  );
};

export const PopOutPups = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const range = DISPARITY[config.difficulty];
  const slots = SLOTS[config.difficulty];
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [magic, setMagic] = useState(false);
  const [disparity, setDisparity] = useState<number>(range.start);
  const [jitter, setJitter] = useState<number[]>([]);
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [found, setFound] = useState(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newRound = (nextRound: number) => {
    const isMagic = config.difficulty === 'hard' && nextRound % 2 === 0;
    setTargetIndex(Math.floor(Math.random() * slots));
    // Small vertical jitter so the answer is never given away by position.
    setJitter(Array.from({ length: slots }, () => (Math.random() - 0.5) * 24));
    setMagic(isMagic);
    setFound(false);
    setRound(nextRound);
    speak(isMagic ? 'Find the magic floating circle!' : 'Which pup jumps out of the screen?', config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound(1);
  };

  const choose = (index: number) => {
    if (!isPlaying || found) return;
    setRounds(r => r + 1);
    if (index === targetIndex) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      // Staircase: a little less depth after each find...
      setDisparity(d => Math.max(range.min, d - 1));
      setFound(true);
      later(() => newRound(round + 1), 800);
    } else {
      playSound('miss', config.soundEnabled);
      setWrongIndex(index);
      later(() => setWrongIndex(null), 400);
      // ...and a little more after a miss, so it settles at the child's threshold.
      setDisparity(d => Math.min(range.start + 4, d + 2));
    }
  };

  const left = config.anaglyphTarget;
  const right = config.anaglyphScene;
  const pupSize = Math.max(64, config.size * 2);
  // RDS disparity in grid cells; each cell is a few screen pixels.
  const tileSize = Math.max(120, config.size * 3.2);
  const cellPx = tileSize / RDS_CELLS;
  const rdsShift = Math.max(1, Math.round(disparity / cellPx));

  return (
    <div className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-xl border-4 border-slate-800 bg-black pb-8">
      {!started && (
        <StartOverlay label="Meet the Pups" hint="Put on your 3D glasses. Tap the pup that floats out!" onStart={start}>
          <div className="relative" style={{ width: 80, height: 80 }}>
            <div className="absolute" style={{ left: 5 }}><Pup color={left} size={70} /></div>
            <div className="absolute" style={{ left: -5 }}><Pup color={right} size={70} /></div>
          </div>
        </StartOverlay>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <div className="flex flex-wrap items-center justify-center gap-6 px-4 md:gap-10" style={{ isolation: 'isolate' }}>
          {Array.from({ length: slots }, (_, i) => {
            const near = i === targetIndex;
            // Crossed (near) for the odd one, uncrossed (far) for the rest.
            const half = (near ? disparity : -disparity) / 2;
            return (
              <motion.button
                key={`${round}-${i}`}
                onClick={() => choose(i)}
                aria-label={`Pup ${i + 1}`}
                initial={{ opacity: 0 }}
                animate={wrongIndex === i
                  ? { opacity: 1, x: [-8, 8, -8, 8, 0] }
                  : { opacity: 1, y: jitter[i] ?? 0, scale: found && near ? 1.15 : 1 }}
                transition={{ duration: 0.35 }}
                className="relative flex items-center justify-center rounded-2xl border-2 border-slate-800 bg-black p-3"
              >
                {magic ? (
                  <StereoTile shift={rdsShift} disc={near} left={left} right={right} size={tileSize} />
                ) : (
                  <div className="relative" style={{ width: pupSize + disparity, height: pupSize, isolation: 'isolate' }}>
                    <div className="absolute top-0" style={{ left: disparity / 2 + half }}><Pup color={left} size={pupSize} /></div>
                    <div className="absolute top-0" style={{ left: disparity / 2 - half }}><Pup color={right} size={pupSize} /></div>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};
