import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, targetColor, sceneColor, tintStyle, pick } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The jungle pup's trail: paw prints lead through the jungle from the pup to
 * a hiding animal, and the child taps them one by one, in order. Each tap is
 * a small, accurate eye jump to the next print (saccades along a path), and
 * on harder levels bird tracks lie in between, so every print has to be
 * looked at before it is tapped. Only the next print counts; a wrong tap just
 * wobbles.
 */

const LEVELS = {
  easy: { prints: 6, decoys: 0, size: 1.15 },
  medium: { prints: 8, decoys: 4, size: 0.95 },
  hard: { prints: 10, decoys: 8, size: 0.8 },
} as const;

const ANIMALS = ['🐒', '🦜', '🐆', '🦥', '🐘', '🦒'];

interface Point { x: number; y: number; angle: number }

/** A winding trail from the left edge to the right, as shares of the area. */
const makeTrail = (count: number): Point[] => {
  const points: Point[] = [];
  let y = 0.3 + Math.random() * 0.4;
  for (let i = 0; i < count; i++) {
    const x = 0.14 + (i / (count - 1)) * 0.7;
    y = Math.min(0.85, Math.max(0.15, y + (Math.random() - 0.5) * 0.3));
    points.push({ x, y, angle: 0 });
  }
  for (let i = 0; i < count; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(count - 1, i + 1)];
    points[i].angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
  }
  return points;
};

/** Decoy bird tracks, kept a little away from the trail. */
const makeDecoys = (trail: Point[], count: number): Point[] => {
  const decoys: Point[] = [];
  let guard = 0;
  while (decoys.length < count && guard++ < 500) {
    const p = { x: 0.1 + Math.random() * 0.78, y: 0.1 + Math.random() * 0.8, angle: Math.random() * 360 };
    const clear = [...trail, ...decoys].every(q => Math.hypot(q.x - p.x, (q.y - p.y) * 0.7) > 0.08);
    if (clear) decoys.push(p);
  }
  return decoys;
};

const Paw = ({ color }: { color: string }) => (
  <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
    <ellipse cx="20" cy="26" rx="9" ry="8" fill={color} />
    <ellipse cx="9" cy="15" rx="4" ry="5" fill={color} />
    <ellipse cx="16" cy="9" rx="4" ry="5" fill={color} />
    <ellipse cx="24" cy="9" rx="4" ry="5" fill={color} />
    <ellipse cx="31" cy="15" rx="4" ry="5" fill={color} />
  </svg>
);

const BirdTrack = ({ color }: { color: string }) => (
  <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
    <g stroke={color} strokeWidth="4" strokeLinecap="round">
      <line x1="20" y1="34" x2="20" y2="8" />
      <line x1="20" y1="22" x2="8" y2="10" />
      <line x1="20" y1="22" x2="32" y2="10" />
    </g>
  </svg>
);

export const JungleTrail = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'jungle');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [taps, setTaps] = useState(0);
  const [round, setRound] = useState(0);
  const [trail, setTrail] = useState<Point[]>([]);
  const [decoys, setDecoys] = useState<Point[]>([]);
  const [next, setNext] = useState(0);
  const [animal, setAnimal] = useState(ANIMALS[0]);
  const [wrong, setWrong] = useState<string | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, taps), onComplete);
  });

  const newTrail = () => {
    const path = makeTrail(level.prints);
    setTrail(path);
    setDecoys(makeDecoys(path, level.decoys));
    setNext(0);
    setAnimal(pick(ANIMALS));
    setRound(r => r + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newTrail();
    speak(t('{name} found some paw prints! Tap them one by one to follow the trail!', { name }), config.voiceEnabled);
  };

  const tapPrint = (i: number) => {
    if (!isPlaying || next >= trail.length) return;
    setTaps(n => n + 1);
    if (i === next) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setNext(i + 1);
      if (i + 1 === trail.length) {
        later(() => { playSound('honk', config.soundEnabled); speak(t('You found who made the tracks!'), config.voiceEnabled); }, 300);
        later(newTrail, 2200);
      }
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(`p${i}`);
      later(() => setWrong(null), 400);
    }
  };

  const tapDecoy = (i: number) => {
    if (!isPlaying) return;
    setTaps(n => n + 1);
    playSound('miss', config.soundEnabled);
    setWrong(`d${i}`);
    later(() => setWrong(null), 400);
    speak(t('Those are bird tracks. Look for the paw prints!'), config.voiceEnabled);
  };

  // Prints scale with the jungle; a tap area never drops below 44 px.
  const printSize = Math.max(28, Math.min(size.width, size.height * 1.6) / 20 * level.size);
  const hit = Math.max(44, printSize * 1.4);
  const paw = targetColor(config, '#fbbf24');
  const bird = targetColor(config, '#fbbf24');
  const done = next >= trail.length && trail.length > 0;
  const pupAt = next === 0 ? { x: 0.05, y: trail[0]?.y ?? 0.5 } : trail[next - 1];

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-gradient-to-br from-emerald-950 via-green-950 to-slate-950">
      {!started && (
        <StartOverlay label={t('Follow the Trail')} hint={t('Tap the paw prints one by one, from the pup to the end of the trail!')} onStart={start}>
          <RescuePup role="jungle" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-x-0 top-10 bottom-10">
        {started && size.width > 0 && (
          <>
            {/* Jungle leaves (scenery). */}
            {[0.08, 0.3, 0.52, 0.74, 0.94].map((x, i) => (
              <span
                key={i}
                className="pointer-events-none absolute leading-none"
                style={{ left: `${x * 100}%`, top: i % 2 ? '4%' : '78%', fontSize: 56, opacity: 0.5, transform: 'translateX(-50%)', ...tintStyle(config, 'scene') }}
              >
                {i % 2 ? '🌿' : '🌴'}
              </span>
            ))}

            {decoys.map((d, i) => (
              <motion.button
                key={`${round}-d${i}`}
                onClick={() => tapDecoy(i)}
                aria-label={t('Bird track')}
                className="absolute flex items-center justify-center"
                style={{ left: d.x * size.width - hit / 2, top: d.y * size.height - hit / 2, width: hit, height: hit }}
                animate={wrong === `d${i}` ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
                transition={{ duration: 0.35 }}
              >
                <span style={{ width: printSize, height: printSize, transform: `rotate(${d.angle}deg)`, opacity: 0.85 }}><BirdTrack color={bird} /></span>
              </motion.button>
            ))}

            {trail.map((p, i) => (
              <motion.button
                key={`${round}-p${i}`}
                onClick={() => tapPrint(i)}
                aria-label={t('Paw print {n}', { n: i + 1 })}
                className="absolute flex items-center justify-center rounded-full"
                style={{
                  left: p.x * size.width - hit / 2, top: p.y * size.height - hit / 2, width: hit, height: hit,
                  boxShadow: i < next ? `0 0 0 3px ${sceneColor(config, '#86efac')}` : undefined,
                }}
                animate={wrong === `p${i}` ? { x: [-6, 6, -6, 6, 0] } : { x: 0, scale: i < next ? 0.85 : 1 }}
                transition={{ duration: 0.35 }}
              >
                <span style={{ width: printSize, height: printSize, transform: `rotate(${p.angle}deg)`, opacity: i < next ? 0.45 : 0.95 }}><Paw color={paw} /></span>
              </motion.button>
            ))}

            {/* The animal waits in the bushes at the end of the trail. */}
            {trail.length > 0 && (
              <motion.div
                className="pointer-events-none absolute leading-none"
                style={{ left: Math.min(0.93, trail[trail.length - 1].x + 0.07) * size.width - 32, top: trail[trail.length - 1].y * size.height - 32, fontSize: 56 }}
                animate={done ? { scale: [0.6, 1.4, 1.2], y: -20 } : { scale: 0.6 }}
                transition={{ duration: 0.5 }}
              >
                <span style={{ ...(done ? tintStyle(config, 'target') : { filter: 'brightness(0)', opacity: 0.5 }) }}>{done ? animal : '🌳'}</span>
              </motion.div>
            )}

            {/* The jungle pup follows along the trail. */}
            <motion.div
              className="pointer-events-none absolute"
              animate={{ left: pupAt.x * size.width - 36, top: pupAt.y * size.height - 80 }}
              transition={{ type: 'spring', stiffness: 120, damping: 16 }}
            >
              <RescuePup role="jungle" size={72} style={tintStyle(config, 'target')} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};
