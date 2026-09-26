import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { ShapeIcon, ShapeKind, SHAPE_FAMILIES, SHAPE_NAMES, ALL_SHAPES } from '../shapes';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useLater } from './common';

interface Tire {
  kind: ShapeKind;
  isTarget: boolean;
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const LAYOUT = {
  easy: { count: 6, cols: 3, minSize: 22, gap: 0.45 },
  medium: { count: 9, cols: 3, minSize: 16, gap: 0.3 },
  hard: { count: 12, cols: 4, minSize: 12, gap: 0.18 },
} as const;

/**
 * Acuity under crowding for pre-readers. A car rolls in missing a wheel with a
 * shape on it; the child finds that wheel on a crowded tyre rack. Shapes
 * shrink after every find and grow back a little after a miss, so the game
 * settles near the smallest size the child can reliably resolve.
 */
export const ShapeGarage = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const layout = LAYOUT[config.difficulty];
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<ShapeKind>('circle');
  const [tires, setTires] = useState<Tire[]>([]);
  const [shapeSize, setShapeSize] = useState(Math.max(layout.minSize, config.size * 1.1));
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [fitted, setFitted] = useState(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newRound = () => {
    // Easy mixes families, so the odd shape is obvious; harder levels draw
    // every distractor from the target's look-alike family.
    const family = pick(SHAPE_FAMILIES);
    const next = pick(family);
    const pool = (config.difficulty === 'easy' ? ALL_SHAPES : family).filter(k => k !== next);
    const rack: Tire[] = Array.from({ length: layout.count }, () => ({ kind: pick(pool), isTarget: false }));
    rack[Math.floor(Math.random() * rack.length)] = { kind: next, isTarget: true };
    setTarget(next);
    setTires(rack);
    setFitted(false);
    setRound(r => r + 1);
    speak(`Find the ${SHAPE_NAMES[next]} wheel!`, config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
  };

  const choose = (tire: Tire, index: number) => {
    if (!isPlaying || fitted) return;
    setRounds(r => r + 1);
    if (tire.isTarget) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setShapeSize(s => Math.max(layout.minSize, s * 0.92));
      setFitted(true);
      later(newRound, 700);
    } else {
      // No points lost: a gentle wobble on the wrong tyre is the only signal.
      playSound('miss', config.soundEnabled);
      setWrongIndex(index);
      later(() => setWrongIndex(null), 400);
      setShapeSize(s => Math.min(config.size * 1.6, s * 1.1));
    }
  };

  const ag = config.anaglyphMode;
  const shapeColor = ag ? config.anaglyphTarget : '#f8fafc';
  // Tyres and the car are scenery: in anaglyph mode they belong to the other eye.
  const tireFill = ag ? '#000000' : '#1e293b';
  const tireRing = ag ? config.anaglyphScene : '#475569';
  const carColor = ag ? config.anaglyphScene : '#f97316';
  // Tap area never drops below 44px even when the shapes get tiny.
  const tireSize = Math.max(44, shapeSize * 1.7);
  const gap = Math.max(4, shapeSize * layout.gap);

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8">
      {!started && (
        <StartOverlay label="Open the Garage" hint="Find the wheel with the same shape!" onStart={start}>
          <div className="flex gap-3">
            {(['circle', 'house', 'heart'] as ShapeKind[]).map(k => (
              <span key={k}><ShapeIcon kind={k} size={40} color={ag ? config.anaglyphTarget : '#f8fafc'} /></span>
            ))}
          </div>
        </StartOverlay>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          {/* The car waiting for its wheel. */}
          <motion.div
            key={`car-${round}`}
            initial={{ x: -260, opacity: 0 }}
            animate={fitted ? { x: 320, opacity: 0 } : { x: 0, opacity: 1 }}
            transition={{ duration: fitted ? 0.6 : 0.5, ease: 'easeInOut' }}
            className="relative shrink-0"
            style={{ width: 220, height: 110 }}
          >
            <svg viewBox="0 0 220 110" width={220} height={110} aria-hidden="true">
              <path d="M20 70 L30 44 Q36 34 50 34 L90 34 Q104 12 130 12 L160 12 Q176 12 184 34 L200 40 Q210 44 210 58 L210 70 Z" fill={carColor} fillOpacity={ag ? 0.55 : 1} />
              <rect x="100" y="18" width="30" height="16" rx="4" fill="#000" fillOpacity={ag ? 1 : 0.35} />
              <rect x="136" y="18" width="30" height="16" rx="4" fill="#000" fillOpacity={ag ? 1 : 0.35} />
              <circle cx="170" cy="76" r="22" fill={tireFill} stroke={tireRing} strokeWidth="6" />
              <circle cx="60" cy="76" r="22" fill="#000" fillOpacity={0.4} stroke={tireRing} strokeWidth="3" strokeDasharray="6 5" />
            </svg>
            {/* The missing wheel shows the shape to find. */}
            <motion.div
              className="absolute"
              style={{ left: 60 - 16, top: 76 - 16 }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              <ShapeIcon kind={target} size={32} color={shapeColor} />
            </motion.div>
          </motion.div>

          {/* The crowded tyre rack. */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${layout.cols}, ${tireSize}px)`, gap }}
          >
            {tires.map((tire, i) => (
              <motion.button
                key={`${round}-${i}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={wrongIndex === i ? { x: [-8, 8, -8, 8, 0], scale: 1, opacity: 1 } : { scale: fitted && tire.isTarget ? 1.2 : 1, opacity: 1 }}
                transition={{ duration: 0.35 }}
                onClick={() => choose(tire, i)}
                aria-label={`${SHAPE_NAMES[tire.kind]} wheel`}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: tireSize,
                  height: tireSize,
                  backgroundColor: tireFill,
                  border: `${Math.max(3, shapeSize * 0.18)}px solid ${tireRing}`,
                }}
              >
                <ShapeIcon kind={tire.kind} size={shapeSize} color={shapeColor} />
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
