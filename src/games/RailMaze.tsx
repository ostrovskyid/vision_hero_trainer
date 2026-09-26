import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import {
  GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, targetColor, sceneColor, tintStyle,
} from './common';

/**
 * Tracing: drive a little train through a track maze with a finger, from the
 * depot to the station, without crossing the fences. The pleoptic "maze"
 * exercise, with eye-hand coordination on top. Mazes get more cells and
 * narrower tracks on harder levels.
 */

const LEVELS = {
  easy: { cols: 4, rows: 3 },
  medium: { cols: 6, rows: 4 },
  hard: { cols: 8, rows: 5 },
} as const;

/** Walls per cell: [top, right, bottom, left]. */
type Cell = [boolean, boolean, boolean, boolean];

/** A random perfect maze (every cell reachable, exactly one route between any two). */
const buildMaze = (cols: number, rows: number): Cell[] => {
  const cells: Cell[] = Array.from({ length: cols * rows }, () => [true, true, true, true]);
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols, cy = Math.floor(cur / cols);
    const options: [number, number, number][] = [];
    if (cy > 0) options.push([cur - cols, 0, 2]);
    if (cx < cols - 1) options.push([cur + 1, 1, 3]);
    if (cy < rows - 1) options.push([cur + cols, 2, 0]);
    if (cx > 0) options.push([cur - 1, 3, 1]);
    const open = options.filter(([n]) => !seen.has(n));
    if (!open.length) { stack.pop(); continue; }
    const [next, wall, back] = open[Math.floor(Math.random() * open.length)];
    cells[cur][wall] = false;
    cells[next][back] = false;
    seen.add(next);
    stack.push(next);
  }
  return cells;
};

export const RailMaze = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [mazeId, setMazeId] = useState(0);
  const [trainCell, setTrainCell] = useState(0);
  const [trail, setTrail] = useState<number[]>([0]);
  const [bump, setBump] = useState(false);
  const [arrived, setArrived] = useState(false);
  const dragging = useRef(false);
  const cellRef = useRef(0);

  const maze = useMemo(() => buildMaze(level.cols, level.rows), [mazeId, level.cols, level.rows]);
  const goal = level.cols * level.rows - 1;

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, score, onComplete);
  });

  const newMaze = () => {
    setMazeId(m => m + 1);
    cellRef.current = 0;
    setTrainCell(0);
    setTrail([0]);
    setArrived(false);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newMaze();
    speak('Drive the train to the station. Stay on the tracks!', config.voiceEnabled);
  };

  // Board geometry: the maze keeps square cells and is centred.
  const pad = 16;
  // Room at the top for the score badge and at the bottom for the progress road.
  const top = 56, bottom = 40;
  const cell = size.width > 0 ? Math.min((size.width - pad * 2) / level.cols, (size.height - top - bottom) / level.rows) : 0;
  const ox = (size.width - cell * level.cols) / 2;
  const oy = top + (size.height - top - bottom - cell * level.rows) / 2;
  const centre = (i: number) => ({ x: ox + ((i % level.cols) + 0.5) * cell, y: oy + (Math.floor(i / level.cols) + 0.5) * cell });

  const cellAt = (x: number, y: number) => {
    const cx = Math.floor((x - ox) / cell), cy = Math.floor((y - oy) / cell);
    if (cx < 0 || cy < 0 || cx >= level.cols || cy >= level.rows) return -1;
    return cy * level.cols + cx;
  };

  /** Whether two neighbouring cells have no fence between them. */
  const connected = (a: number, b: number) => {
    if (b === a - level.cols) return !maze[a][0];
    if (b === a + 1 && a % level.cols !== level.cols - 1) return !maze[a][1];
    if (b === a + level.cols) return !maze[a][2];
    if (b === a - 1 && a % level.cols !== 0) return !maze[a][3];
    return false;
  };

  /** Moves the train one cell, or bumps it against a fence. Returns whether it moved. */
  const step = (target: number) => {
    const cur = cellRef.current;
    if (!connected(cur, target)) return false;
    cellRef.current = target;
    setTrainCell(target);
    // Backing up shortens the trail; moving on extends it.
    setTrail(t => (t.length > 1 && t[t.length - 2] === target ? t.slice(0, -1) : [...t, target]));
    if (target === goal) {
      dragging.current = false;
      setArrived(true);
      setScore(s => s + 1);
      playSound('honk', config.soundEnabled);
      speak('Next stop! Great driving!', config.voiceEnabled);
      later(newMaze, 1500);
    }
    return true;
  };

  const drive = (x: number, y: number) => {
    const target = cellAt(x, y);
    if (target < 0) return;
    // A fast finger can skip a cell between two events, so walk towards it
    // one cell at a time along the open track, preferring the longer axis.
    for (let guard = 0; guard < 4 && dragging.current && cellRef.current !== target; guard++) {
      const cur = cellRef.current;
      const dx = (target % level.cols) - (cur % level.cols);
      const dy = Math.floor(target / level.cols) - Math.floor(cur / level.cols);
      const horizontal = dx !== 0 ? cur + Math.sign(dx) : -1;
      const vertical = dy !== 0 ? cur + Math.sign(dy) * level.cols : -1;
      const order = Math.abs(dx) >= Math.abs(dy) ? [horizontal, vertical] : [vertical, horizontal];
      if (order.some(n => n >= 0 && step(n))) continue;
      // Every way towards the finger is fenced off: the train stops until the
      // finger comes back to it.
      dragging.current = false;
      playSound('miss', config.soundEnabled);
      setBump(true);
      later(() => setBump(false), 400);
    }
  };

  const local = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!isPlaying || arrived) return;
    const p = local(e);
    // Driving starts only with a finger on the train.
    if (cellAt(p.x, p.y) !== cellRef.current) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const p = local(e);
    drive(p.x, p.y);
  };
  const onUp = () => { dragging.current = false; };

  const fence = sceneColor(config, '#94a3b8');
  const track = targetColor(config, '#f59e0b');
  const wallWidth = Math.max(3, cell * (config.difficulty === 'hard' ? 0.06 : 0.09));
  const train = centre(trainCell);
  const station = centre(goal);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950">
      {!started && (
        <StartOverlay label="Start the Train" hint="Put your finger on the train and drive it to the station!" onStart={start}>
          <div className="text-6xl" style={tintStyle(config, 'target')}>🚂🏁</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div
        ref={areaRef}
        className="absolute inset-0 touch-none"
        onPointerDown={started ? onDown : undefined}
        onPointerMove={started ? onMove : undefined}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {started && cell > 0 && (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {/* The route driven so far. */}
              <polyline
                points={trail.map(i => { const c = centre(i); return `${c.x},${c.y}`; }).join(' ')}
                fill="none" stroke={track} strokeOpacity={0.55} strokeWidth={Math.max(4, cell * 0.14)} strokeLinecap="round" strokeLinejoin="round"
              />
              {/* Fences. */}
              {maze.map((walls, i) => {
                const x = ox + (i % level.cols) * cell, y = oy + Math.floor(i / level.cols) * cell;
                return (
                  <g key={`${mazeId}-${i}`} stroke={fence} strokeWidth={wallWidth} strokeLinecap="round">
                    {walls[0] && <line x1={x} y1={y} x2={x + cell} y2={y} />}
                    {walls[1] && <line x1={x + cell} y1={y} x2={x + cell} y2={y + cell} />}
                    {walls[2] && <line x1={x} y1={y + cell} x2={x + cell} y2={y + cell} />}
                    {walls[3] && <line x1={x} y1={y} x2={x} y2={y + cell} />}
                  </g>
                );
              })}
            </svg>
            <span
              className="pointer-events-none absolute leading-none"
              style={{ left: station.x - cell * 0.3, top: station.y - cell * 0.3, fontSize: cell * 0.55, ...tintStyle(config, 'target') }}
            >
              🏁
            </span>
            <span
              className="pointer-events-none absolute leading-none transition-all duration-150"
              style={{
                left: train.x - cell * 0.32, top: train.y - cell * 0.32, fontSize: cell * 0.6,
                transform: bump ? 'translateX(-4px) rotate(-8deg)' : undefined,
                ...tintStyle(config, 'target'),
              }}
            >
              🚂
            </span>
          </>
        )}
      </div>
    </div>
  );
};
