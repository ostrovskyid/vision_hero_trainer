import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, targetColor, sceneColor, useLater } from './common';

/**
 * Brief-exposure counting. A metro train rushes past a window and the child
 * says how many carriages it had. Small numbers are "seen" at a glance rather
 * than counted (subitising), so this trains taking in a whole picture in one
 * fixation, and teaches numbers along the way.
 */

const LEVELS = {
  easy: { max: 3, passMs: 2600 },
  medium: { max: 5, passMs: 1800 },
  hard: { max: 6, passMs: 1200 },
} as const;

const DOT_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]],
};

const Carriage = ({ color, width }: { color: string; width: number }) => (
  <svg viewBox="0 0 100 60" width={width} height={width * 0.6} aria-hidden="true" style={{ display: 'block' }}>
    <rect x="3" y="4" width="94" height="44" rx="10" fill={color} />
    <rect x="12" y="12" width="20" height="16" rx="3" fill="#000" />
    <rect x="40" y="12" width="20" height="16" rx="3" fill="#000" />
    <rect x="68" y="12" width="20" height="16" rx="3" fill="#000" />
    <circle cx="24" cy="52" r="7" fill={color} />
    <circle cx="76" cy="52" r="7" fill={color} />
  </svg>
);

export const CountCarriages = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const level = LEVELS[config.difficulty];
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [count, setCount] = useState(1);
  const [pass, setPass] = useState(0);
  const [asking, setAsking] = useState(false);
  const [wrong, setWrong] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  // Set from a wrong answer until the replay starts, so extra taps in that
  // moment neither count as attempts nor queue more replays.
  const replaying = useRef(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const sendTrain = (n: number) => {
    setCount(n);
    setAsking(false);
    setRight(null);
    replaying.current = false;
    setPass(p => p + 1);
  };

  const newRound = () => sendTrain(1 + Math.floor(Math.random() * level.max));

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
  };

  const onPassed = () => {
    setAsking(true);
    speak('How many carriages?', config.voiceEnabled);
  };

  const answer = (n: number) => {
    if (!isPlaying || !asking || right !== null || replaying.current) return;
    setRounds(r => r + 1);
    if (n === count) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setRight(n);
      speak(`Yes! ${n}!`, config.voiceEnabled);
      later(newRound, 1100);
    } else {
      replaying.current = true;
      playSound('miss', config.soundEnabled);
      setWrong(n);
      later(() => setWrong(null), 400);
      speak("Let's look again!", config.voiceEnabled);
      // Same train again: a second look, never a penalty.
      later(() => sendTrain(count), 900);
    }
  };

  const carColor = targetColor(config, '#ef4444');
  const frame = sceneColor(config, '#475569');
  const carWidth = Math.max(70, config.size * 2);
  const trainWidth = count * (carWidth + 6);

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8">
      {!started && (
        <StartOverlay label="Watch the Trains" hint="Count the carriages as the train goes by!" onStart={start}>
          <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i}><Carriage color={carColor} width={56} /></span>)}</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          {/* The window the train rushes past. */}
          <div
            className="relative w-[90%] max-w-3xl overflow-hidden rounded-2xl bg-black"
            style={{ height: carWidth * 0.6 + 40, border: `6px solid ${frame}` }}
          >
            <div className="absolute left-0 right-0" style={{ bottom: 12, height: 4, backgroundColor: frame, opacity: 0.6 }} />
            {!asking && (
              <motion.div
                key={pass}
                className="absolute flex gap-1.5"
                style={{ bottom: 16 }}
                initial={{ left: '100%' }}
                animate={{ left: `-${trainWidth}px` }}
                transition={{ duration: level.passMs / 1000, ease: 'linear', delay: 0.4 }}
                onAnimationComplete={onPassed}
              >
                {Array.from({ length: count }, (_, i) => <span key={i}><Carriage color={carColor} width={carWidth} /></span>)}
              </motion.div>
            )}
            {asking && (
              <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold" style={{ color: frame }}>?</div>
            )}
          </div>

          {/* Answer cards: dots for counting, and the digit for learning it. */}
          <div className="flex flex-wrap justify-center gap-3 px-4">
            {Array.from({ length: level.max }, (_, i) => i + 1).map(n => (
              <motion.button
                key={n}
                onClick={() => answer(n)}
                disabled={!asking}
                aria-label={`${n}`}
                animate={wrong === n ? { x: [-8, 8, -8, 8, 0] } : { scale: right === n ? 1.15 : 1 }}
                transition={{ duration: 0.35 }}
                className={`flex h-24 w-20 flex-col items-center justify-between rounded-2xl bg-black p-2 transition-opacity ${asking ? 'opacity-100' : 'opacity-40'}`}
                style={{ border: `3px solid ${right === n ? carColor : frame}` }}
              >
                <svg viewBox="0 0 100 100" className="h-12 w-12" aria-hidden="true">
                  {DOT_LAYOUTS[n].map(([x, y], j) => <circle key={j} cx={x} cy={y} r="11" fill={carColor} />)}
                </svg>
                <span className="text-2xl font-bold leading-none" style={{ color: carColor }}>{n}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
