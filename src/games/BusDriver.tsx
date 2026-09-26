import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, tintStyle, sceneColor, targetColor, useLater } from './common';
import { t } from '../i18n';

/**
 * Eye-hand coordination while following a path: drive the bus along a winding
 * road with a finger, stopping to pick up passengers. The bus only moves while
 * the finger stays on the road near it, so the eyes have to lead the hand.
 *
 * In anaglyph mode the road belongs to one eye and the bus to the other, so
 * steering needs both eyes' pictures combined, a gentle binocular exercise.
 */

const SAMPLES = 400;
const STOPS = { easy: 2, medium: 3, hard: 4 } as const;
const PASSENGERS = ['🧒', '👵', '👨', '👧', '🧑', '👴'];

interface Road {
  d: string;
  points: { x: number; y: number }[];
  stops: number[]; // sample indices
}

/** A random wiggly road across the play area, sampled for hit-testing. */
const buildRoad = (w: number, h: number, stops: number, difficulty: 'easy' | 'medium' | 'hard'): Road => {
  const margin = 60;
  const bends = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
  const anchors = Array.from({ length: bends + 2 }, (_, i) => ({
    x: margin + ((w - margin * 2) * i) / (bends + 1),
    y: i === 0 || i === bends + 1 ? h * 0.5 : margin + Math.random() * (h - margin * 2 - 40),
  }));
  let d = `M ${anchors[0].x} ${anchors[0].y}`;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i];
    const mx = (a.x + b.x) / 2;
    d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const total = path.getTotalLength();
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const p = path.getPointAtLength((total * i) / SAMPLES);
    return { x: p.x, y: p.y };
  });
  const stopIdx = Array.from({ length: stops }, (_, i) => Math.round((SAMPLES * (i + 1)) / (stops + 1)));
  return { d, points, stops: stopIdx };
};

export const BusDriver = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [trip, setTrip] = useState(0);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [arrived, setArrived] = useState(false);
  const posRef = useRef(0);
  const dragging = useRef(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, score, onComplete);
  });

  const road = useMemo(
    () => (size.width > 0 && trip > 0 ? buildRoad(size.width, size.height, STOPS[config.difficulty], config.difficulty) : null),
    // A new road per trip, and when the screen rotates.
    [trip, size.width, size.height, config.difficulty],
  );
  const passengers = useMemo(() => road?.stops.map((_, i) => PASSENGERS[(trip + i) % PASSENGERS.length]) ?? [], [road, trip]);

  useEffect(() => {
    posRef.current = 0;
    setPos(0);
    setPicked([]);
    setArrived(false);
  }, [road]);

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    setTrip(1);
    speak(t('Drive the bus along the road. Pick everybody up!'), config.voiceEnabled);
  };

  const roadWidth = Math.max(36, config.size * 1.3) * (config.difficulty === 'hard' ? 0.8 : 1);
  const busSize = Math.max(44, config.size * 1.2);

  const steer = (x: number, y: number) => {
    if (!road || arrived || !isPlaying) return;
    const cur = posRef.current;
    const here = road.points[cur];
    // The finger has to be on the bus, or just ahead of it along the road.
    if (Math.hypot(x - here.x, y - here.y) > busSize * 1.6 && !dragging.current) return;
    let best = cur, bestDist = Infinity;
    for (let i = cur; i <= Math.min(SAMPLES, cur + 25); i++) {
      const p = road.points[i];
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    // Off the road: the bus waits until the finger comes back.
    if (bestDist > roadWidth * 0.9) return;
    if (best <= cur) return;
    posRef.current = best;
    setPos(best);
    road.stops.forEach((stop, i) => {
      if (best >= stop && cur < stop) {
        playSound('hit', config.soundEnabled);
        setScore(s => s + 1);
        setPicked(p => [...p, i]);
      }
    });
    if (best >= SAMPLES) {
      setArrived(true);
      dragging.current = false;
      playSound('honk', config.soundEnabled);
      setScore(s => s + 1);
      speak(t('All aboard! Great driving!'), config.voiceEnabled);
      later(() => setTrip(t => t + 1), 1800);
    }
  };

  const local = (e: PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    if (!road) return;
    const p = local(e);
    const here = road.points[posRef.current];
    if (Math.hypot(p.x - here.x, p.y - here.y) > busSize * 1.6) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    steer(p.x, p.y);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const p = local(e);
    steer(p.x, p.y);
  };
  const onUp = () => { dragging.current = false; };

  const bus = road?.points[pos];
  const ahead = road?.points[Math.min(SAMPLES, pos + 3)];
  const angle = bus && ahead ? (Math.atan2(ahead.y - bus.y, ahead.x - bus.x) * 180) / Math.PI : 0;
  const roadColor = sceneColor(config, '#334155');
  const lineColor = sceneColor(config, '#e2e8f0');
  const stopColor = targetColor(config, '#22c55e');

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[420px] w-full touch-none overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950"
      onPointerDown={started ? onDown : undefined}
      onPointerMove={started ? onMove : undefined}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {!started && (
        <StartOverlay label={t('Start the Bus')} hint={t('Put your finger on the bus and drive it along the road!')} onStart={start}>
          <div className="text-6xl" style={tintStyle(config, 'target')}>🚌</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {road && bus && (
        <>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <path d={road.d} fill="none" stroke={roadColor} strokeWidth={roadWidth} strokeLinecap="round" strokeOpacity={config.anaglyphMode ? 0.55 : 1} />
            <path d={road.d} fill="none" stroke={lineColor} strokeWidth={3} strokeDasharray="14 14" strokeOpacity={0.7} />
            {/* Finish flag at the end of the road. */}
            <circle cx={road.points[SAMPLES].x} cy={road.points[SAMPLES].y} r={roadWidth * 0.6} fill="none" stroke={stopColor} strokeWidth={4} />
          </svg>

          {road.stops.map((stop, i) => {
            const p = road.points[stop];
            const aboard = picked.includes(i);
            return (
              <div key={`${trip}-${i}`} className="pointer-events-none absolute -translate-x-1/2" style={{ left: p.x, top: p.y - roadWidth / 2 - busSize * 1.1 }}>
                <div className="mx-auto mb-0.5 h-3 w-3 rounded-full" style={{ backgroundColor: stopColor }} />
                <motion.div
                  className="leading-none"
                  style={{ fontSize: busSize * 0.7, ...tintStyle(config, 'target') }}
                  animate={aboard ? { opacity: 0, y: 20, scale: 0.4 } : { opacity: 1, y: [0, -6, 0] }}
                  transition={aboard ? { duration: 0.4 } : { duration: 1, repeat: Infinity }}
                >
                  {passengers[i]}
                </motion.div>
              </div>
            );
          })}

          <div
            className="pointer-events-none absolute flex items-center justify-center leading-none"
            style={{
              left: bus.x - busSize / 2,
              top: bus.y - busSize / 2,
              width: busSize,
              height: busSize,
              fontSize: busSize * 0.9,
              // The bus emoji faces left; mirror it so it drives forwards.
              transform: `rotate(${angle}deg) scaleX(-1)`,
              ...tintStyle(config, 'target'),
              // Added on top of the road rather than covering it, so the
              // road eye never sees a bus-shaped hole in the road.
              ...(config.anaglyphMode ? { mixBlendMode: 'screen' as const } : {}),
            }}
          >
            🚌
          </div>
        </>
      )}
    </div>
  );
};
