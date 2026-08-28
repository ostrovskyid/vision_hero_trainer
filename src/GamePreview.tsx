import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Rocket, Plane, Car, Bus, CloudFog, Radar, Crosshair, TrainFront, TramFront,
} from 'lucide-react';
import { GameMode } from './types';

/**
 * Miniature, animated illustrations of each exercise, shown on the home tiles.
 * A five-year-old picks a game by recognising the picture, not by reading the
 * title, so each preview mimics what the real exercise looks like in motion.
 */

const METRO_COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6'];

const loop = (duration: number, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  ease: 'easeInOut' as const,
});

// Fills whatever space the tile gives it, so the home grid can size itself to
// the viewport rather than the previews forcing a fixed height.
const Frame = ({ children = null, className = '' }: { children?: ReactNode; className?: string }) => (
  <div className={`relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 ${className}`}>
    {children}
  </div>
);

export const GamePreview = ({ mode }: { mode: GameMode }) => {
  const still = useReducedMotion();
  // With reduced motion the previews hold a representative pose instead of moving.
  const move = <T,>(animated: T, resting: T) => (still ? resting : animated);

  switch (mode) {
    case 'tracking':
      return (
        <Frame>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <ellipse cx="50" cy="50" rx="34" ry="26" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 4" />
          </svg>
          <motion.div
            className="absolute left-1/2 top-1/2 -ml-5 -mt-5"
            animate={move({ x: [34, 0, -34, 0, 34], y: [0, 22, 0, -22, 0] }, { x: 34, y: 0 })}
            transition={loop(7)}
          >
            <Rocket className="h-10 w-10 fill-blue-400/30 text-blue-400" />
          </motion.div>
        </Frame>
      );

    case 'contrast':
      return (
        <Frame className="bg-slate-400">
          <div className="absolute inset-0 bg-slate-300/60" />
          <motion.div
            className="absolute left-[30%] top-[28%]"
            animate={move({ opacity: [0.2, 0.55, 0.2] }, { opacity: 0.4 })}
            transition={loop(3.5)}
          >
            <Plane className="h-10 w-10 text-slate-800" />
          </motion.div>
          <motion.div
            className="absolute right-[24%] bottom-[22%]"
            animate={move({ opacity: [0.5, 0.15, 0.5] }, { opacity: 0.3 })}
            transition={loop(3.5, 0.8)}
          >
            <Plane className="h-7 w-7 rotate-45 text-slate-800" />
          </motion.div>
        </Frame>
      );

    case 'detail':
      return (
        <Frame className="flex items-center justify-center">
          <div className="grid grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800">
                {i === 5 ? (
                  <motion.span
                    animate={move({ scale: [1, 1.25, 1] }, { scale: 1.2 })}
                    transition={loop(2)}
                  >
                    <Bus className="h-5 w-5 text-orange-300" />
                  </motion.span>
                ) : (
                  <Car className="h-5 w-5 text-orange-400/70" />
                )}
              </div>
            ))}
          </div>
        </Frame>
      );

    case 'saccades':
      return (
        <Frame>
          <motion.div
            className="absolute top-1/2 -mt-5"
            animate={move({ left: ['12%', '72%', '12%'] }, { left: '12%' })}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', times: [0, 0.5, 1] }}
          >
            <Car className="h-10 w-10 text-red-400" />
          </motion.div>
        </Frame>
      );

    case 'peripheral':
      return (
        <Frame>
          <div className="absolute left-1/2 top-1/2 -ml-4 -mt-4">
            <Crosshair className="h-8 w-8 text-blue-500/70" />
          </div>
          {[
            { top: '12%', left: '12%' },
            { top: '12%', right: '12%' },
            { bottom: '12%', left: '18%' },
            { bottom: '14%', right: '14%' },
          ].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={pos}
              animate={move({ opacity: [0.15, 1, 0.15], scale: [0.85, 1.1, 0.85] }, { opacity: 0.8 })}
              transition={loop(3.2, i * 0.8)}
            >
              <Radar className="h-6 w-6 text-green-400" />
            </motion.div>
          ))}
        </Frame>
      );

    case 'spotter':
      return (
        <Frame className="flex items-center justify-center">
          <div className="grid grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800">
                {i === 2 ? (
                  <motion.span
                    animate={move({ opacity: [0.18, 0.45, 0.18] }, { opacity: 0.3 })}
                    transition={loop(3)}
                  >
                    <CloudFog className="h-5 w-5 text-yellow-400" />
                  </motion.span>
                ) : (
                  <CloudFog className="h-5 w-5 text-yellow-400" />
                )}
              </div>
            ))}
          </div>
        </Frame>
      );

    case 'checkpoint':
      return (
        <Frame className="flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Match</span>
            <TrainFront className="h-4 w-4 text-cyan-300" />
          </div>
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-800"
            animate={move({ scale: [1, 1.12, 1] }, { scale: 1 })}
            transition={loop(2.4)}
          >
            <TrainFront className="h-7 w-7 text-cyan-300" />
          </motion.div>
        </Frame>
      );

    case 'metro':
      return (
        <Frame>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 8 30 L 55 30 L 75 62 L 92 62" fill="none" stroke="#eab308" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Stations are HTML, not SVG: the stretched viewBox would squash circles into ellipses. */}
          {[[8, 30], [55, 30], [92, 62]].map(([left, top], i) => (
            <div
              key={i}
              className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-500 bg-slate-950"
              style={{ left: `${left}%`, top: `${top}%` }}
            />
          ))}
          <motion.div
            className="absolute -ml-4"
            style={{ top: '14%' }}
            animate={move({ left: ['10%', '46%', '10%'] }, { left: '30%' })}
            transition={loop(5)}
          >
            <TrainFront className="h-8 w-8 fill-rose-400/30 text-rose-400" />
          </motion.div>
        </Frame>
      );

    case 'station':
      return (
        <Frame className="flex items-center justify-center gap-2.5">
          {['E', 'F', 'E', 'H'].map((letter, i) => (
            <motion.div
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] bg-slate-50 text-base font-bold text-slate-900"
              style={{ borderColor: METRO_COLORS[i] }}
              animate={i === 1 ? move({ scale: [1, 1.18, 1] }, { scale: 1.12 }) : undefined}
              transition={loop(2.2)}
            >
              {letter}
            </motion.div>
          ))}
        </Frame>
      );

    case 'navigator':
      return (
        <Frame>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 6 22 C 40 22, 60 78, 94 78" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
            <path d="M 6 50 C 40 78, 60 22, 94 22" fill="none" stroke="#eab308" strokeWidth="4" strokeLinecap="round" />
            <path d="M 6 78 C 40 50, 60 50, 94 50" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          </svg>
          {[22, 50, 78].map((top, i) => (
            <div
              key={i}
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-400 bg-slate-50"
              style={{ left: '92%', top: `${top}%` }}
            />
          ))}
        </Frame>
      );

    case 'crossing':
      return (
        <Frame>
          {[28, 52, 76].map(top => (
            <div key={top} className="absolute left-0 right-0 border-t-2 border-dashed border-slate-800" style={{ top: `${top}%` }} />
          ))}
          <motion.div
            className="absolute -mt-4"
            style={{ top: '28%' }}
            animate={move({ left: ['-14%', '100%'] }, { left: '40%' })}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          >
            <TramFront className="h-8 w-8 text-sky-300" />
          </motion.div>
          <motion.div
            className="absolute -mt-3"
            style={{ top: '76%' }}
            animate={move({ left: ['100%', '-14%'] }, { left: '55%' })}
            transition={{ duration: 7.5, repeat: Infinity, ease: 'linear', delay: 1 }}
          >
            <Car className="h-7 w-7 text-slate-500" />
          </motion.div>
        </Frame>
      );

    case 'memory': {
      const dots = [
        { x: 22, y: 30 }, { x: 50, y: 18 }, { x: 78, y: 30 },
        { x: 78, y: 70 }, { x: 50, y: 82 }, { x: 22, y: 70 },
      ];
      return (
        <Frame>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points={dots.map(d => `${d.x},${d.y}`).join(' ')} fill="none" stroke="#334155" strokeWidth="2.5" />
          </svg>
          {dots.map((d, i) => (
            <motion.div
              key={i}
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fuchsia-400"
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
              animate={move(
                { backgroundColor: ['#020617', '#e879f9', '#020617'] },
                { backgroundColor: i === 0 ? '#e879f9' : '#020617' },
              )}
              transition={{ duration: 3.6, repeat: Infinity, delay: i * 0.6, times: [0, 0.15, 0.3] }}
            />
          ))}
        </Frame>
      );
    }

    default:
      return <Frame />;
  }
};
