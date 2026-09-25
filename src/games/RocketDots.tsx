import { useRef, useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import {
  GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, targetColor, sceneColor, pick,
} from './common';

/**
 * Dot-to-dot with a finger: 1 → 2 → 3 … draws a vehicle, which then takes off.
 * Each jump to the next number is a saccade to a target the child has to find
 * first, and dragging the line there adds eye-hand coordination. The number
 * is read aloud as each dot is reached, so it doubles as counting practice.
 */

interface Picture {
  name: string;
  cheer: string;
  color: string;
  points: [number, number][];
}

const PICTURES: Picture[] = [
  { name: 'kite', cheer: 'Whoosh!', color: '#f472b6', points: [[50, 8], [80, 45], [50, 92], [20, 45]] },
  { name: 'house', cheer: 'Hooray!', color: '#fb923c', points: [[50, 10], [85, 42], [85, 88], [15, 88], [15, 42]] },
  { name: 'bus', cheer: 'Beep beep!', color: '#facc15', points: [[8, 28], [82, 28], [92, 48], [92, 76], [8, 76]] },
  { name: 'rocket', cheer: 'Blast off!', color: '#e5e7eb', points: [[50, 6], [64, 30], [64, 70], [76, 88], [24, 88], [36, 70], [36, 30]] },
  { name: 'car', cheer: 'Vroom!', color: '#ef4444', points: [[6, 62], [18, 42], [34, 40], [44, 22], [70, 22], [82, 40], [94, 48], [94, 68]] },
  { name: 'big rocket', cheer: 'Blast off!', color: '#e5e7eb', points: [[50, 6], [62, 24], [63, 56], [78, 76], [62, 72], [56, 84], [44, 84], [38, 72], [22, 76], [37, 56], [38, 24]] },
  { name: 'star', cheer: 'Twinkle!', color: '#facc15', points: [[50, 6], [61, 38], [94, 38], [67, 58], [78, 92], [50, 72], [22, 92], [33, 58], [6, 38], [39, 38]] },
  { name: 'plane', cheer: 'Take off!', color: '#60a5fa', points: [[94, 50], [70, 42], [52, 14], [42, 14], [50, 42], [22, 42], [12, 28], [6, 28], [10, 50], [6, 72], [12, 72], [22, 58], [50, 58], [42, 86], [52, 86], [70, 58]] },
];

const MAX_POINTS = { easy: 5, medium: 8, hard: 16 } as const;

export const RocketDots = ({ config, onComplete }: GameProps) => {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [picture, setPicture] = useState<Picture>(PICTURES[0]);
  const [decoys, setDecoys] = useState<[number, number][]>([]);
  const [next, setNext] = useState(0);
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);
  const [launched, setLaunched] = useState(false);
  const [round, setRound] = useState(0);
  const drawing = useRef(false);
  // Pointer moves arrive faster than re-renders; the ref stops one dot counting twice.
  const nextRef = useRef(0);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, score, onComplete);
  });

  const newPicture = () => {
    const options = PICTURES.filter(p => p.points.length <= MAX_POINTS[config.difficulty]);
    let chosen = pick(options);
    if (options.length > 1) while (chosen === picture) chosen = pick(options);
    setPicture(chosen);
    // Hard adds unnumbered decoy dots, so the next number has to be found, not guessed.
    const extra: [number, number][] = [];
    if (config.difficulty === 'hard') {
      while (extra.length < 3) {
        const d: [number, number] = [8 + Math.random() * 84, 8 + Math.random() * 84];
        const clear = [...chosen.points, ...extra].every(([x, y]) => Math.hypot(x - d[0], y - d[1]) > 16);
        if (clear) extra.push(d);
      }
    }
    setDecoys(extra);
    setNext(0);
    nextRef.current = 0;
    setLaunched(false);
    setRound(r => r + 1);
    speak(`Start at number one!`, config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newPicture();
  };

  // The drawing area is a centred square, so pictures keep their shape.
  const side = Math.min(size.width, size.height - 40) * 0.86;
  const ox = (size.width - side) / 2;
  const oy = (size.height - 40 - side) / 2 + 8;
  const toPx = ([x, y]: [number, number]) => ({ x: ox + (x / 100) * side, y: oy + (y / 100) * side });

  const dotR = Math.max(14, config.size * 0.45);
  const hitR = Math.max(30, dotR * 1.6);

  const reach = (x: number, y: number) => {
    const next = nextRef.current;
    if (!isPlaying || launched || next >= picture.points.length) return;
    const p = toPx(picture.points[next]);
    if (Math.hypot(x - p.x, y - p.y) > hitR) return;
    playSound('hit', config.soundEnabled);
    setScore(s => s + 1);
    speak(String(next + 1), config.voiceEnabled);
    const reached = next + 1;
    nextRef.current = reached;
    setNext(reached);
    if (reached === picture.points.length) {
      drawing.current = false;
      setFinger(null);
      setTimeout(() => {
        setLaunched(true);
        playSound('honk', config.soundEnabled);
        speak(picture.cheer, config.voiceEnabled);
      }, 400);
      setTimeout(newPicture, 2200);
    }
  };

  const local = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: PointerEvent) => {
    const p = local(e);
    drawing.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setFinger(p);
    reach(p.x, p.y);
  };
  const onMove = (e: PointerEvent) => {
    if (!drawing.current) return;
    const p = local(e);
    setFinger(p);
    reach(p.x, p.y);
  };
  const onUp = () => {
    drawing.current = false;
    setFinger(null);
  };

  const ink = targetColor(config, '#38bdf8');
  const dotColor = targetColor(config, '#f8fafc');
  const numberColor = targetColor(config, '#facc15');
  const fill = config.anaglyphMode ? config.anaglyphScene : picture.color;
  const done = next >= picture.points.length;
  const pts = picture.points.map(toPx);
  const drawn = pts.slice(0, next);
  const last = drawn[drawn.length - 1];

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[420px] w-full touch-none overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950"
      onPointerDown={started ? onDown : undefined}
      onPointerMove={started ? onMove : undefined}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {!started && <StartOverlay label="Draw a Picture" hint="Slide your finger from 1 to 2 to 3…" onStart={start} />}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && size.width > 0 && (
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <motion.g
            key={round}
            animate={launched ? { y: -size.height, opacity: 0 } : { y: 0, opacity: 1 }}
            transition={{ duration: launched ? 1.4 : 0.2, ease: 'easeIn' }}
          >
            {done && (
              <motion.polygon
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill={fill}
                initial={{ opacity: 0 }}
                animate={{ opacity: config.anaglyphMode ? 0.45 : 0.9 }}
              />
            )}
            {drawn.length > 1 && (
              <polyline
                points={(done ? [...drawn, drawn[0]] : drawn).map(p => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke={ink} strokeWidth={Math.max(4, dotR * 0.35)} strokeLinecap="round" strokeLinejoin="round"
              />
            )}
            {/* The line follows the finger from the last dot reached. */}
            {finger && last && !done && (
              <line x1={last.x} y1={last.y} x2={finger.x} y2={finger.y} stroke={ink} strokeOpacity={0.5} strokeWidth={Math.max(3, dotR * 0.25)} strokeLinecap="round" strokeDasharray="6 8" />
            )}
            {decoys.map((d, i) => {
              const p = toPx(d);
              return <circle key={`d${i}`} cx={p.x} cy={p.y} r={dotR * 0.55} fill={dotColor} />;
            })}
            {pts.map((p, i) => (
              <g key={i}>
                {i === next && !done && (
                  <motion.circle
                    cx={p.x} cy={p.y} r={dotR}
                    fill="none" stroke={numberColor} strokeWidth={3}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    animate={{ scale: [1, 1.7, 1], opacity: [0.9, 0.2, 0.9] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={dotR * 0.55} fill={i < next ? ink : dotColor} />
                {!done && (
                  <text
                    x={p.x + dotR * 0.9} y={p.y - dotR * 0.7}
                    fill={numberColor} fontSize={Math.max(18, dotR * 1.2)} fontWeight={700}
                    textAnchor="middle" dominantBaseline="middle"
                  >
                    {i + 1}
                  </text>
                )}
              </g>
            ))}
          </motion.g>
        </svg>
      )}
    </div>
  );
};
