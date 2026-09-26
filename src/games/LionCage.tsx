import { useRef, useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { Button } from '@/components/ui/button';
import {
  GameProps, StartOverlay, useSessionTimer, useElementSize, useLater, compensationPx, pxPerPrismDioptre,
} from './common';
import confetti from 'canvas-confetti';
import { t } from '../i18n';

/**
 * Simultaneous perception, the first step of the orthoptist's synoptophore
 * sequence. With red/cyan glasses the target-colour eye sees only the lion
 * and the other eye sees only the cage. The child drags the cage until the
 * lion is inside it and taps "Got it!". Seeing both at once, and putting one
 * inside the other, needs the two eyes' pictures at the same time.
 *
 * Where the child lines them up is a rough home measure of the eye angle at
 * that moment, in prism dioptres (the median of the session is saved with
 * the result). It is a game, not a measurement: the orthoptist's figures are
 * the ones that count.
 */

interface Pair { animal: string; name: string; home: 'cage' | 'bowl' | 'nest' | 'garage' | 'tower'; homeName: string }

const PAIRS: Pair[] = [
  { animal: '🦁', name: 'lion', home: 'cage', homeName: 'cage' },
  { animal: '🐟', name: 'fish', home: 'bowl', homeName: 'bowl' },
  { animal: '🐦', name: 'bird', home: 'nest', homeName: 'nest' },
  { animal: '🚗', name: 'car', home: 'garage', homeName: 'garage' },
  { animal: '🚀', name: 'rocket', home: 'tower', homeName: 'launch tower' },
];

/** The "home" outlines, drawn only in the scenery colour. */
const Home = ({ kind, color, size }: { kind: Pair['home']; color: string; size: number }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', mixBlendMode: 'screen' }}>
    <g fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'cage' && (
        <>
          <rect x="8" y="12" width="84" height="80" rx="6" />
          {[24, 40, 56, 72].map(x => <line key={x} x1={x} y1="12" x2={x} y2="92" />)}
          <path d="M30 12 Q50 -2 70 12" />
        </>
      )}
      {kind === 'bowl' && <path d="M22 18 H78 M18 30 Q2 88 50 92 Q98 88 82 30" />}
      {kind === 'nest' && <path d="M8 58 Q50 104 92 58 M14 62 Q50 80 86 62 M20 72 Q50 88 80 72" />}
      {kind === 'garage' && <path d="M6 44 L50 8 L94 44 M16 36 V92 H84 V36 M28 92 V56 H72 V92" />}
      {kind === 'tower' && <path d="M22 96 L34 4 M78 96 L66 4 M26 70 H74 M29 46 H71 M32 22 H68" />}
    </g>
  </svg>
);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const LionCage = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [pair, setPair] = useState<Pair>(PAIRS[0]);
  const [homeX, setHomeX] = useState(0);
  const [homeY, setHomeY] = useState(0);
  const [locked, setLocked] = useState(false);
  const placements = useRef<number[]>([]);
  const drag = useRef<{ x: number; y: number; hx: number; hy: number } | null>(null);

  const finish = () => {
    setIsPlaying(false);
    playSound('complete', config.soundEnabled);
    confetti({ particleCount: 200, spread: 150, origin: { y: 0.5 } });
    // Whole prism dioptres: finger placement and emoji outlines are not finer than that.
    const aligned = placements.current.length ? Math.round(median(placements.current)) + 0 : undefined;
    onComplete({ score, timeSpent: config.duration, accuracy: 1, date: new Date().toISOString(), ...(aligned !== undefined ? { alignedPD: aligned } : {}) });
  };
  const timeLeft = useSessionTimer(config.duration, isPlaying, finish);

  const newRound = () => {
    const next = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    setPair(next);
    // The home starts well to one side, so it has to be moved every time.
    const side = Math.random() < 0.5 ? -1 : 1;
    setHomeX(side * (90 + Math.random() * 110));
    setHomeY((Math.random() - 0.5) * 80);
    setLocked(false);
    setRound(r => r + 1);
    speak(t(`Put the ${next.name} in the ${next.homeName}!`), config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!isPlaying || locked) return;
    drag.current = { x: e.clientX, y: e.clientY, hx: homeX, hy: homeY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setHomeX(drag.current.hx + e.clientX - drag.current.x);
    setHomeY(drag.current.hy + e.clientY - drag.current.y);
  };
  const onUp = () => { drag.current = null; };

  const comp = compensationPx(config);
  // Screen positions: the animal (target eye) and the home (scenery eye).
  const cx = size.width / 2, cy = size.height / 2 - 20;
  const animalX = cx + comp / 2;
  const homeScreenX = cx - comp / 2 + homeX;

  const gotIt = () => {
    if (!isPlaying || locked) return;
    // Left-eye picture minus right-eye picture, in prism dioptres: + means the
    // child needed the pictures crossed, as an eye turned in does.
    placements.current.push((animalX - homeScreenX) / pxPerPrismDioptre(config));
    setScore(s => s + 1);
    setLocked(true);
    playSound('hit', config.soundEnabled);
    speak(t(`The ${pair.name} is home!`), config.voiceEnabled);
    later(newRound, 1400);
  };

  const homeSize = Math.max(180, config.size * 4.5);
  const animalSize = homeSize * 0.42;

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-black">
      {!started && (
        <StartOverlay label={t('Open the Zoo Gate')} hint={t('Glasses on! Drag the cage so the lion is inside it.')} onStart={start}>
          <div className="text-6xl">🦁</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div
        ref={areaRef}
        className="absolute inset-0 touch-none"
        style={{ isolation: 'isolate' }}
        onPointerDown={started ? onDown : undefined}
        onPointerMove={started ? onMove : undefined}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {started && size.width > 0 && (
          <>
            {/* A fixed square box keeps the emoji centred on the point its position is measured from. */}
            <div
              className="pointer-events-none absolute flex items-center justify-center leading-none"
              style={{
                left: animalX - animalSize / 2, top: cy - animalSize / 2, width: animalSize, height: animalSize,
                fontSize: animalSize * 0.85, filter: 'url(#ag-tint-target)', mixBlendMode: 'screen',
              }}
            >
              {pair.animal}
            </div>
            <motion.div
              key={round}
              className="pointer-events-none absolute"
              style={{ left: homeScreenX - homeSize / 2, top: cy + homeY - homeSize / 2 }}
              animate={locked ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Home kind={pair.home} color={config.anaglyphScene} size={homeSize} />
            </motion.div>
          </>
        )}
      </div>

      {started && (
        <div className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2">
          <Button size="lg" onClick={gotIt} disabled={locked} className="px-10 py-6 text-xl">{t('Got it!')}</Button>
        </div>
      )}
    </div>
  );
};
