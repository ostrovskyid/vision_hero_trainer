import { useRef, useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, targetColor, sceneColor, pick, useLater } from './common';

/**
 * Systematic scanning for small details: rub every mud spot off a muddy car.
 * Spots get smaller and fainter on harder levels, so the child has to sweep
 * the whole car with their eyes instead of tapping at random. Rubbing is the
 * reward in itself.
 */

const BODY = 'M20 70 L30 44 Q36 34 50 34 L90 34 Q104 12 130 12 L160 12 Q176 12 184 34 L200 40 Q210 44 210 58 L210 70 Z';
const CAR_COLORS = ['#f97316', '#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7'];

const LEVELS = {
  easy: { spots: 6, radius: 10, mud: 1 },
  medium: { spots: 10, radius: 7, mud: 0.85 },
  hard: { spots: 14, radius: 5, mud: 0.6 },
} as const;

interface Spot { x: number; y: number; r: number; dirt: number; }

let bodyPath: Path2D | null = null;
let probe: CanvasRenderingContext2D | null = null;
const insideBody = (x: number, y: number) => {
  if (!bodyPath) bodyPath = new Path2D(BODY);
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  return probe ? probe.isPointInPath(bodyPath, x, y) : true;
};

const makeSpots = (count: number, radius: number): Spot[] => {
  const spots: Spot[] = [];
  let guard = 0;
  while (spots.length < count && guard++ < 2000) {
    const x = 26 + Math.random() * 180;
    // Stay above the wheels (their tops sit at y = 58).
    const y = 16 + Math.random() * 38;
    const r = radius * (0.8 + Math.random() * 0.5);
    // Keep spots on the paintwork, not the windows, and apart from each other.
    const onPaint = insideBody(x, y) && !(y < 36 && x > 96 && x < 170);
    if (onPaint && spots.every(s => Math.hypot(s.x - x, s.y - y) > s.r + r + 3)) spots.push({ x, y, r, dirt: 1 });
  }
  return spots;
};

export const CarWash = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const level = LEVELS[config.difficulty];
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [carColor, setCarColor] = useState(CAR_COLORS[0]);
  const [sponge, setSponge] = useState<{ x: number; y: number } | null>(null);
  const [shiny, setShiny] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scrubbing = useRef(false);
  // Pointer moves arrive faster than re-renders; the ref keeps each spot counted once.
  const spotsRef = useRef<Spot[]>([]);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, score, onComplete);
  });

  const newCar = () => {
    spotsRef.current = makeSpots(level.spots, level.radius);
    setSpots(spotsRef.current);
    setCarColor(c => pick(CAR_COLORS.filter(x => x !== c)));
    setShiny(false);
    setRound(r => r + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newCar();
    speak('Rub off all the mud!', config.voiceEnabled);
  };

  const toCar = (e: PointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const scrub = (e: PointerEvent) => {
    const p = toCar(e);
    if (!p) return;
    setSponge(p);
    if (!isPlaying || shiny) return;
    let cleaned = 0;
    const spots = spotsRef.current;
    if (spots.every(s => s.dirt <= 0)) return;
    const next = spots.map(s => {
      if (s.dirt <= 0 || Math.hypot(s.x - p.x, s.y - p.y) > s.r + 8) return s;
      const dirt = Math.max(0, s.dirt - 0.2);
      if (dirt === 0) cleaned++;
      return { ...s, dirt };
    });
    if (next.every((s, i) => s === spots[i])) return;
    spotsRef.current = next;
    setSpots(next);
    if (cleaned > 0) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + cleaned);
    }
    if (next.every(s => s.dirt <= 0)) {
      setShiny(true);
      scrubbing.current = false;
      playSound('honk', config.soundEnabled);
      speak('Sparkly clean!', config.voiceEnabled);
      later(newCar, 1600);
    }
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    scrubbing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scrub(e);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => { if (scrubbing.current) scrub(e); };
  const onUp = () => { scrubbing.current = false; setSponge(null); };

  const body = sceneColor(config, carColor);
  const mud = targetColor(config, '#78350f');
  const trim = sceneColor(config, '#1e293b');

  return (
    <div className="relative flex h-full min-h-[420px] w-full touch-none items-center justify-center overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8">
      {!started && (
        <StartOverlay label="Open the Car Wash" hint="Rub the mud off with your finger!" onStart={start}>
          <div className="text-6xl">🧽🚗</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <motion.svg
          key={round}
          ref={svgRef}
          viewBox="0 0 230 100"
          className="h-auto w-[92%] max-w-4xl cursor-pointer"
          initial={{ x: -400, opacity: 0 }}
          animate={shiny ? { x: [0, 0, 600], opacity: [1, 1, 0] } : { x: 0, opacity: 1 }}
          transition={shiny ? { duration: 1.6, times: [0, 0.55, 1] } : { duration: 0.6 }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Muddy car"
          role="img"
        >
          <path d={BODY} fill={body} fillOpacity={config.anaglyphMode ? 0.6 : 1} />
          <rect x="100" y="18" width="30" height="16" rx="4" fill="#000" fillOpacity={config.anaglyphMode ? 1 : 0.45} />
          <rect x="136" y="18" width="30" height="16" rx="4" fill="#000" fillOpacity={config.anaglyphMode ? 1 : 0.45} />
          {[60, 170].map(cx => (
            <g key={cx}>
              <circle cx={cx} cy="74" r="16" fill="#000" stroke={trim} strokeWidth="5" />
              <circle cx={cx} cy="74" r="5" fill={trim} />
            </g>
          ))}
          {spots.map((s, i) => s.dirt > 0 && (
            // In anaglyph mode the mud is added on top of the paint rather than
            // covering it, so the scenery eye sees unbroken paint and only the
            // target eye sees the spots.
            <g key={i} opacity={s.dirt * level.mud} style={config.anaglyphMode ? { mixBlendMode: 'screen' } : undefined}>
              <circle cx={s.x} cy={s.y} r={s.r} fill={mud} />
              <circle cx={s.x + s.r * 0.7} cy={s.y - s.r * 0.5} r={s.r * 0.45} fill={mud} />
              <circle cx={s.x - s.r * 0.6} cy={s.y + s.r * 0.6} r={s.r * 0.35} fill={mud} />
            </g>
          ))}
          {shiny && [[70, 30], [150, 8], [196, 44], [40, 56]].map(([x, y], i) => (
            <motion.text
              key={i} x={x} y={y} fontSize="16" textAnchor="middle"
              initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: [0, 1, 0], scale: [0.3, 1.2, 0.8] }}
              transition={{ duration: 0.9, delay: i * 0.12 }}
            >
              ✨
            </motion.text>
          ))}
          {sponge && !shiny && (
            <text x={sponge.x} y={sponge.y} fontSize="18" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">🧽</text>
          )}
        </motion.svg>
      )}
    </div>
  );
};
