import { useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import {
  GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, targetColor, sceneColor, tintStyle,
} from './common';
import { t } from '../i18n';

/**
 * Localisation: the tablet version of the "poke the dot" pleoptic exercise.
 * A docking port appears somewhere on the space station; tap exactly inside
 * it and the rocket flies in to dock. The port shrinks after each docking and
 * grows after a miss, so the game settles at the smallest target the child
 * can place a finger on precisely. Amblyopic eyes are unsure where things
 * are, not only what they are, so this trains the "where".
 */

const LEVELS = {
  easy: { start: 40, min: 14 },
  medium: { start: 30, min: 9 },
  hard: { start: 22, min: 6 },
} as const;

export const RocketDocking = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [radius, setRadius] = useState<number>(level.start);
  const [port, setPort] = useState({ x: 0.5, y: 0.5 });
  const [miss, setMiss] = useState<{ x: number; y: number } | null>(null);
  const [docking, setDocking] = useState(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newPort = () => {
    setPort({ x: 0.12 + Math.random() * 0.76, y: 0.15 + Math.random() * 0.6 });
    setMiss(null);
    setDocking(false);
    setRound(r => r + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newPort();
    speak(t('Tap right in the middle of the docking ring!'), config.voiceEnabled);
  };

  const tap = (e: PointerEvent<HTMLDivElement>) => {
    if (!isPlaying || docking || size.width === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const px = port.x * size.width, py = port.y * size.height;
    setRounds(r => r + 1);
    if (Math.hypot(x - px, y - py) <= radius) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setDocking(true);
      setRadius(r => Math.max(level.min, r * 0.9));
      later(() => playSound('honk', config.soundEnabled), 700);
      later(newPort, 1300);
    } else {
      playSound('miss', config.soundEnabled);
      setMiss({ x, y });
      setRadius(r => Math.min(level.start, r * 1.12));
      later(() => setMiss(null), 700);
    }
  };

  const ring = targetColor(config, '#22d3ee');
  const station = sceneColor(config, '#334155');
  const px = port.x * size.width, py = port.y * size.height;

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950">
      {!started && (
        <StartOverlay label={t('Launch')} hint={t('Tap right in the middle of the docking ring!')} onStart={start}>
          <div className="text-6xl" style={tintStyle(config, 'target')}>🚀</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-0 touch-none" onPointerDown={started ? tap : undefined}>
        {started && size.width > 0 && (
          <>
            {/* The space station: a fixed truss grid (scenery, other eye). It never
                lines up with the port, so it can't point the way to the target. */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {[0.2, 0.4, 0.6, 0.8].map(f => (
                <g key={f} stroke={station} strokeWidth={3} strokeOpacity={0.6}>
                  <line x1={0} y1={f * size.height} x2={size.width} y2={f * size.height} />
                  <line x1={f * size.width} y1={0} x2={f * size.width} y2={size.height} />
                </g>
              ))}
              <rect x={px - radius * 2.4} y={py - radius * 2.4} width={radius * 4.8} height={radius * 4.8} rx={radius} fill="none" stroke={station} strokeWidth={4} />
            </svg>
            <motion.div
              key={round}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: px - radius, top: py - radius, width: radius * 2, height: radius * 2,
                border: `${Math.max(2, radius * 0.18)}px solid ${ring}`,
              }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={docking ? { scale: 1.4, opacity: 0 } : { scale: 1, opacity: 1 }}
              transition={{ duration: docking ? 0.6 : 0.3 }}
            />
            {/* The rocket flies up from the bottom into the port. */}
            {docking && (
              <motion.span
                className="pointer-events-none absolute text-4xl leading-none"
                style={{ left: px - 18, ...tintStyle(config, 'target') }}
                initial={{ top: size.height }}
                animate={{ top: py - 18 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                🚀
              </motion.span>
            )}
            {miss && (
              <motion.div
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: miss.x, top: miss.y, backgroundColor: ring }}
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 2.5 }}
                transition={{ duration: 0.7 }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
