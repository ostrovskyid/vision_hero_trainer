import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useLater, compensationPx } from './common';

/**
 * Fusion with a built-in check. A night sky is drawn for both eyes (the
 * frame and the moon hold the two pictures together), and the stars are
 * split: some only the target-colour eye sees, some only the other eye, some
 * both. With the two eyes working together the child sees every star and
 * counts them all. A count that matches one eye's stars only means the other
 * eye's picture was switched off (suppressed), and the game says "look with
 * both eyes" instead of marking it wrong.
 */

const LEVELS = {
  easy: { perEye: 1, shared: 1, max: 5 },
  medium: { perEye: 2, shared: 1, max: 7 },
  hard: { perEye: 3, shared: 1, max: 8 },
} as const;

interface Star { x: number; y: number; eye: 'left' | 'right' | 'both' }

const Star = ({ color, size }: { color: string; size: number }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', mixBlendMode: 'screen' }}>
    <path d="M50 4 L62 38 L98 38 L69 60 L80 95 L50 74 L20 95 L31 60 L2 38 L38 38 Z" fill={color} />
  </svg>
);

const DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[25, 25], [50, 50], [75, 75]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]],
  7: [[30, 22], [70, 22], [30, 50], [50, 50], [70, 50], [30, 78], [70, 78]],
  8: [[30, 20], [70, 20], [30, 40], [70, 40], [30, 60], [70, 60], [30, 80], [70, 80]],
};

export const FusionStars = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState<Star[]>([]);
  const [right, setRight] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newRound = () => {
    // A little variety in how many each eye gets, within the level's range.
    const leftCount = 1 + Math.floor(Math.random() * level.perEye);
    const rightCount = 1 + Math.floor(Math.random() * level.perEye);
    const eyes: Star['eye'][] = [
      ...Array(leftCount).fill('left'), ...Array(rightCount).fill('right'), ...Array(level.shared).fill('both'),
    ];
    const placed: Star[] = [];
    for (const eye of eyes) {
      let guard = 0, x = 0, y = 0;
      do {
        x = 0.12 + Math.random() * 0.76;
        y = 0.18 + Math.random() * 0.64;
      } while (guard++ < 200 && placed.some(s => Math.hypot(s.x - x, s.y - y) < 0.2));
      placed.push({ x, y, eye });
    }
    setStars(placed);
    setRight(null);
    setRound(r => r + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
    speak('Glasses on! How many stars can you see?', config.voiceEnabled);
  };

  const total = stars.length;
  const leftOnly = stars.filter(s => s.eye !== 'right').length;
  const rightOnly = stars.filter(s => s.eye !== 'left').length;

  const answer = (n: number) => {
    if (!isPlaying || right !== null) return;
    setRounds(r => r + 1);
    if (n === total) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setRight(n);
      speak(`Yes, ${n} stars!`, config.voiceEnabled);
      later(newRound, 1100);
      return;
    }
    playSound('miss', config.soundEnabled);
    setWrong(n);
    later(() => setWrong(null), 400);
    // Counting one eye's stars only is a sign that eye's partner switched off.
    if (n === leftOnly || n === rightOnly) {
      speak('Look with both eyes! Some stars are hiding.', config.voiceEnabled);
    }
  };

  const comp = compensationPx(config);
  const left = config.anaglyphTarget, rightColour = config.anaglyphScene;
  const starSize = Math.max(40, config.size * 1.2);
  const boardW = 'min(90%, 640px)';

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-xl border-4 border-slate-800 bg-black pb-8 pt-12">
      {!started && (
        <StartOverlay label="Look at the Sky" hint="Glasses on! Count all the stars you can see." onStart={start}>
          <div className="text-6xl">⭐</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          {/* Two copies of the sky, one per eye, shifted apart by the angle compensation. */}
          <div className="relative aspect-[16/10]" style={{ width: boardW, isolation: 'isolate' }}>
            {(['left', 'right'] as const).map(eye => {
              const colour = eye === 'left' ? left : rightColour;
              const shift = eye === 'left' ? comp / 2 : -comp / 2;
              return (
                <div key={eye} className="pointer-events-none absolute inset-0" style={{ transform: `translateX(${shift}px)`, mixBlendMode: 'screen' }}>
                  {/* Fusion lock: frame and moon, seen by both eyes. */}
                  <div className="absolute inset-0 rounded-2xl" style={{ border: `4px solid ${colour}` }} />
                  <svg viewBox="0 0 100 100" className="absolute right-[6%] top-[8%] h-[18%]" aria-hidden="true">
                    <path d="M60 10 A40 40 0 1 0 90 70 A32 32 0 1 1 60 10 Z" fill={colour} />
                  </svg>
                  {stars.filter(s => s.eye === eye || s.eye === 'both').map((s, i) => (
                    <motion.div
                      key={`${round}-${eye}-${i}`}
                      className="absolute"
                      style={{ left: `calc(${s.x * 100}% - ${starSize / 2}px)`, top: `calc(${s.y * 100}% - ${starSize / 2}px)` }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <Star color={colour} size={starSize} />
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-center gap-2 px-4">
            {Array.from({ length: level.max }, (_, i) => i + 1).map(n => (
              <motion.button
                key={n}
                onClick={() => answer(n)}
                aria-label={`${n}`}
                animate={wrong === n ? { x: [-8, 8, -8, 8, 0] } : { scale: right === n ? 1.15 : 1 }}
                transition={{ duration: 0.35 }}
                className="flex h-20 w-16 flex-col items-center justify-between rounded-xl bg-black p-1.5"
                style={{ border: `3px solid ${right === n ? '#facc15' : '#475569'}` }}
              >
                <svg viewBox="0 0 100 100" className="h-10 w-10" aria-hidden="true">
                  {DOTS[n].map(([x, y], j) => <circle key={j} cx={x} cy={y} r="10" fill="#e2e8f0" />)}
                </svg>
                <span className="text-xl font-bold leading-none text-slate-100">{n}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
