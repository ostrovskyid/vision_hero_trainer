import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, targetColor, sceneColor, tintStyle, pick } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The city pup's scooter ride: at every corner a round road sign shows an
 * arrow, and the child taps the big button that points the same way. The
 * arrow is drawn on a five-by-five grid like the direction optotypes (tumbling
 * E, Landolt C) used to measure children's sharpness of sight, so its detail
 * is a fifth of its size. The sign shrinks after each right answer and grows
 * back after a wrong one (a staircase), so the game settles at the smallest
 * arrow the child can still read.
 */

type Dir = 'up' | 'right' | 'down' | 'left';
const DIRS: Dir[] = ['up', 'right', 'down', 'left'];
const ROTATION: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

const LEVELS = {
  easy: { min: 40 },
  medium: { min: 22 },
  hard: { min: 12 },
} as const;

/** The arrow optotype: 5 × 5 units, strokes one unit wide. */
const ArrowOptotype = ({ size, color }: { size: number; color: string }) => (
  <svg viewBox="0 0 5 5" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
    <path d="M2 5 V2 H0 L2.5 0 L5 2 H3 V5 Z" fill={color} />
  </svg>
);

export const ScooterSigns = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'city');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [dir, setDir] = useState<Dir>('up');
  const [sign, setSign] = useState(0);
  const [arrowSize, setArrowSize] = useState(90);
  const [ride, setRide] = useState<Dir | null>(null);
  const [wrong, setWrong] = useState<Dir | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, tries), onComplete);
  });

  const newSign = (previous?: Dir) => {
    setDir(pick(DIRS.filter(d => d !== previous)));
    setRide(null);
    setSign(n => n + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newSign();
    speak(t('{name} is riding the scooter! Which way does the arrow point?', { name }), config.voiceEnabled);
  };

  const choose = (d: Dir) => {
    if (!isPlaying || ride) return;
    setTries(n => n + 1);
    if (d === dir) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setRide(d);
      setArrowSize(s => Math.max(level.min, s * 0.85));
      later(() => newSign(d), 900);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(d);
      later(() => setWrong(null), 400);
      setArrowSize(s => Math.min(160, s * 1.2));
      speak(t('Look again at the arrow!'), config.voiceEnabled);
    }
  };

  // The sign plate is always big and easy to find; only the arrow on it shrinks.
  const plate = Math.max(140, Math.min(size.width * 0.3, size.height * 0.42));
  const arrow = Math.min(arrowSize, plate * 0.7);
  const button = Math.max(72, Math.min(120, size.height * 0.16));
  const ink = targetColor(config, '#0f172a');
  const face = config.anaglyphMode ? '#000000' : '#f8fafc';
  const ring = sceneColor(config, '#2563eb');
  const road = sceneColor(config, '#334155');

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-gradient-to-b from-violet-950 to-slate-950">
      {!started && (
        <StartOverlay label={t('Start the Scooter')} hint={t('Tap the button that points the same way as the arrow on the sign!')} onStart={start}>
          <RescuePup role="city" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-0 flex flex-col items-center justify-between pb-12 pt-12">
        {started && size.width > 0 && (
          <>
            {/* The sign on its pole, with the arrow optotype (target eye). */}
            <motion.div
              key={sign}
              className="flex flex-col items-center"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35 }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: plate, height: plate, backgroundColor: face, border: `${plate * 0.07}px solid ${ring}` }}
              >
                <span style={{ transform: `rotate(${ROTATION[dir]}deg)`, display: 'flex', ...tintStyle(config, 'target') }}>
                  <ArrowOptotype size={arrow} color={ink} />
                </span>
              </div>
              <div style={{ width: plate * 0.07, height: plate * 0.25, backgroundColor: ring }} />
            </motion.div>

            {/* The road and the city pup's scooter. */}
            <div className="relative w-full" style={{ height: 70 }}>
              <div className="absolute inset-x-[6%] bottom-2 h-3 rounded-full" style={{ backgroundColor: road }} />
              <motion.div
                className="absolute bottom-3 flex items-end"
                initial={false}
                animate={ride
                  ? { left: ride === 'left' ? '-20%' : ride === 'right' ? '110%' : '44%', y: ride === 'up' ? -60 : ride === 'down' ? 40 : 0, opacity: ride === 'up' || ride === 'down' ? 0 : 1 }
                  : { left: '44%', y: 0, opacity: 1 }}
                transition={{ duration: ride ? 0.8 : 0 }}
              >
                <RescuePup role="city" size={56} style={tintStyle(config, 'target')} />
                <span className="-ml-2 text-4xl leading-none">🛴</span>
              </motion.div>
            </div>

            {/* Four big direction buttons. */}
            <div className="flex items-center gap-3">
              {DIRS.map(d => (
                <motion.button
                  key={d}
                  onClick={() => choose(d)}
                  aria-label={t(`Arrow ${d}`)}
                  animate={wrong === d ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center justify-center rounded-2xl border-2 border-slate-600 bg-slate-800 active:scale-95"
                  style={{ width: button, height: button }}
                >
                  <ArrowUp className="text-slate-100" style={{ width: button * 0.6, height: button * 0.6, transform: `rotate(${ROTATION[d]}deg)` }} strokeWidth={3} />
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
