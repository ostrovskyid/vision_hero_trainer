import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Rocket, Plane, Car, Bus, CloudFog, TrainFront, TramFront, Star,
} from 'lucide-react';
import { GameMode } from './types';
import { ShapeIcon, ShapeKind } from './shapes';
import { RescuePup } from './pups';

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

    case 'shapes':
      return (
        <Frame className="flex items-center justify-center gap-2.5">
          {(['circle', 'house', 'apple', 'square'] as ShapeKind[]).map((kind, i) => (
            <motion.div
              key={kind}
              className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-slate-600 bg-slate-800"
              animate={i === 2 ? move({ scale: [1, 1.18, 1] }, { scale: 1.12 }) : undefined}
              transition={loop(2.2)}
            >
              <ShapeIcon kind={kind} size={20} color="#f8fafc" />
            </motion.div>
          ))}
        </Frame>
      );

    case 'popout': {
      // Red and cyan copies of each pup; the middle one's copies swap sides,
      // which is what makes it float out through the glasses.
      const pup = (color: string) => (
        <svg viewBox="0 0 100 100" className="h-9 w-9" style={{ mixBlendMode: 'screen' }} aria-hidden="true">
          <ellipse cx="20" cy="42" rx="14" ry="26" fill={color} />
          <ellipse cx="80" cy="42" rx="14" ry="26" fill={color} />
          <circle cx="50" cy="54" r="34" fill={color} />
        </svg>
      );
      return (
        <Frame className="flex items-center justify-center gap-4 bg-black">
          {[-1, 1, -1].map((dir, i) => (
            <motion.div
              key={i}
              className="relative h-9 w-11"
              style={{ isolation: 'isolate' }}
              animate={i === 1 ? move({ scale: [1, 1.15, 1] }, { scale: 1.1 }) : undefined}
              transition={loop(2.4)}
            >
              <div className="absolute top-0" style={{ left: 4 + dir * 3 }}>{pup('#ff0000')}</div>
              <div className="absolute top-0" style={{ left: 4 - dir * 3 }}>{pup('#00ffff')}</div>
            </motion.div>
          ))}
        </Frame>
      );
    }

    case 'cinema':
      return (
        <Frame className="bg-[#0b1030]">
          <div className="absolute bottom-0 left-0 right-0 h-[18%] bg-slate-800" />
          <motion.div
            className="absolute left-[18%] top-1/2 -mt-5"
            animate={move({ y: [18, -22, 18], x: [0, 70, 0], rotate: [0, 50, 0] }, { y: 0 })}
            transition={loop(6)}
          >
            <Rocket className="h-10 w-10 -rotate-45 fill-slate-200/40 text-slate-200" />
          </motion.div>
          <motion.div
            className="absolute right-[18%] top-[18%]"
            animate={move({ opacity: [0, 1, 1, 0], scale: [0.4, 1.1, 1, 0.4] }, { opacity: 1 })}
            transition={{ duration: 3, repeat: Infinity, delay: 1, times: [0, 0.2, 0.8, 1] }}
          >
            <Star className="h-7 w-7 fill-yellow-400 text-yellow-400" />
          </motion.div>
        </Frame>
      );

    case 'carriages':
      return (
        <Frame className="flex flex-col items-center justify-center gap-2">
          <div className="relative h-9 w-[80%] overflow-hidden rounded-md border-2 border-slate-600">
            <motion.div
              className="absolute top-1 flex gap-1"
              animate={move({ left: ['100%', '-60%'] }, { left: '20%' })}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 0.6 }}
            >
              {[0, 1, 2].map(i => <div key={i} className="h-5 w-8 rounded bg-red-500" />)}
            </motion.div>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map(n => (
              <div key={n} className={`flex h-6 w-6 items-center justify-center rounded border text-xs font-bold ${n === 3 ? 'border-red-400 text-red-300' : 'border-slate-600 text-slate-400'}`}>{n}</div>
            ))}
          </div>
        </Frame>
      );

    case 'dots': {
      const pts = [[50, 12], [64, 36], [64, 70], [76, 88], [24, 88], [36, 70], [36, 36]];
      return (
        <Frame>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <motion.polyline
              points={pts.map(p => p.join(',')).join(' ')}
              fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round"
              animate={move({ pathLength: [0, 1, 1] }, { pathLength: 0.6 })}
              transition={{ duration: 4, repeat: Infinity, times: [0, 0.8, 1] }}
            />
            {pts.map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="3" fill="#f8fafc" />
                <text x={x + 6} y={y - 3} fontSize="8" fill="#facc15" fontWeight="700">{i + 1}</text>
              </g>
            ))}
          </svg>
        </Frame>
      );
    }

    case 'zoo':
      return (
        <Frame className="flex items-end justify-center gap-3 pb-2">
          {['🦒', '🦁', '🐘'].map((a, i) => (
            <div key={a} className="relative h-12 w-12 overflow-hidden">
              <motion.span
                className="absolute left-1.5 text-3xl leading-none"
                animate={move({ top: ['40%', '4%', '40%'] }, { top: '10%' })}
                transition={loop(2.6, i * 0.7)}
              >
                {a}
              </motion.span>
              <div className="absolute bottom-0 left-0 right-0 h-7 rounded-t-full bg-green-700" />
            </div>
          ))}
        </Frame>
      );

    case 'bus':
      return (
        <Frame>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 4 70 C 30 70, 30 30, 55 30 S 80 70, 96 50" fill="none" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
            <path d="M 4 70 C 30 70, 30 30, 55 30 S 80 70, 96 50" fill="none" stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="4 4" />
          </svg>
          <motion.span
            className="absolute -ml-3 -mt-3 text-2xl leading-none"
            style={{ transform: 'scaleX(-1)' }}
            animate={move({ left: ['6%', '30%', '55%', '78%', '94%'], top: ['70%', '52%', '30%', '58%', '50%'] }, { left: '55%', top: '30%' })}
            transition={loop(5)}
          >
            🚌
          </motion.span>
        </Frame>
      );

    case 'hangar':
      return (
        <Frame className="flex flex-col items-center justify-center gap-1.5">
          <motion.span
            className="text-3xl leading-none"
            animate={move({ y: [0, 22, 0], x: [0, -26, 0] }, { y: 0 })}
            transition={loop(3)}
          >
            ✈️
          </motion.span>
          <div className="flex gap-2">
            {['✈️', '🚁', '🚀'].map(e => (
              <div key={e} className="flex h-10 w-10 items-center justify-center rounded-t-2xl border-2 border-b-0 border-slate-500">
                <span className="text-xl leading-none" style={{ filter: 'brightness(0) invert(0.55)' }}>{e}</span>
              </div>
            ))}
          </div>
        </Frame>
      );

    case 'carwash':
      return (
        <Frame className="flex items-center justify-center">
          <svg viewBox="0 0 230 100" className="w-[80%]" aria-hidden="true">
            <path d="M20 70 L30 44 Q36 34 50 34 L90 34 Q104 12 130 12 L160 12 Q176 12 184 34 L200 40 Q210 44 210 58 L210 70 Z" fill="#3b82f6" />
            <circle cx="60" cy="74" r="15" fill="#0f172a" />
            <circle cx="170" cy="74" r="15" fill="#0f172a" />
            {[[70, 52, 0], [120, 46, 0.6], [180, 56, 1.2]].map(([x, y, d]) => (
              <motion.circle
                key={x} cx={x} cy={y} r="9" fill="#78350f"
                animate={move({ opacity: [1, 1, 0, 0] }, { opacity: 1 })}
                transition={{ duration: 3.6, repeat: Infinity, delay: d, times: [0, 0.4, 0.55, 1] }}
              />
            ))}
          </svg>
        </Frame>
      );

    case 'differences':
      return (
        <Frame className="flex items-center justify-center gap-2">
          {[0, 1].map(side => (
            <div key={side} className="grid h-14 w-16 grid-cols-2 place-items-center rounded-md border-2 border-slate-600 text-lg leading-none">
              <span>🐧</span>
              <span>{side === 1 ? '🎈' : '⭐'}</span>
              <span>🌴</span>
              {side === 1 ? (
                <motion.span
                  className="h-5 w-5 rounded-full border-2 border-yellow-400"
                  animate={move({ scale: [0.8, 1.2, 0.8] }, { scale: 1 })}
                  transition={loop(1.8)}
                />
              ) : <span>🐟</span>}
            </div>
          ))}
        </Frame>
      );

    case 'stripes':
      return (
        <Frame className="flex items-center justify-center gap-4 bg-slate-950">
          {[0, 1].map(i => (
            <div
              key={i}
              className="h-14 w-14 rounded-xl bg-[#808080]"
              style={i === 1 ? {
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.25) 0 4px, rgba(255,255,255,0.25) 4px 8px)',
                maskImage: 'radial-gradient(circle, #000 45%, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(circle, #000 45%, transparent 75%)',
              } : undefined}
            />
          ))}
        </Frame>
      );

    case 'docking':
      return (
        <Frame>
          <div className="absolute left-0 right-0 top-[38%] h-1 bg-slate-700" />
          <motion.div
            className="absolute left-[62%] top-[38%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-cyan-300"
            animate={move({ scale: [1, 0.7, 1] }, { scale: 0.85 })}
            transition={loop(2.6)}
          />
          <motion.span
            className="absolute left-[62%] -ml-3 text-2xl leading-none"
            animate={move({ top: ['90%', '26%', '90%'] }, { top: '60%' })}
            transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.6, 1] }}
          >
            🚀
          </motion.span>
        </Frame>
      );

    case 'maze':
      return (
        <Frame className="flex items-center justify-center">
          <svg viewBox="0 0 100 60" className="h-[80%]" aria-hidden="true">
            <path d="M5 5 H95 V55 H5 Z M35 5 V35 M65 25 V55 M35 35 H55" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
            <motion.path
              d="M18 15 V48 H50 V45 M50 45 H80 V15"
              fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
              animate={move({ pathLength: [0, 1, 1] }, { pathLength: 0.6 })}
              transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.8, 1] }}
            />
          </svg>
        </Frame>
      );

    case 'paint':
      return (
        <Frame className="flex items-center justify-center">
          <svg viewBox="0 0 220 120" className="w-[75%]" aria-hidden="true">
            <motion.path d="M60 40 H205 V90 H60 Z" stroke="#f8fafc" strokeWidth="3"
              animate={move({ fill: ['#000000', '#ef4444', '#ef4444'] }, { fill: '#ef4444' })}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 1] }} />
            <path d="M18 90 L18 56 L34 34 L60 34 L60 90 Z" fill="#000" stroke="#f8fafc" strokeWidth="3" />
            <path d="M70 22 H198 V32 H70 Z" fill="#facc15" stroke="#f8fafc" strokeWidth="3" />
            <circle cx="48" cy="92" r="15" fill="#000" stroke="#f8fafc" strokeWidth="3" />
            <circle cx="170" cy="92" r="15" fill="#000" stroke="#f8fafc" strokeWidth="3" />
          </svg>
        </Frame>
      );

    case 'pexeso':
      return (
        <Frame className="flex items-center justify-center gap-2">
          {['🚌', null, '🚌', null].map((e, i) => (
            <motion.div
              key={i}
              className={`flex h-12 w-10 items-center justify-center rounded-md border-2 border-slate-600 ${e ? 'bg-black' : 'bg-blue-900'}`}
              animate={e ? move({ rotateY: [180, 0, 0, 180] }, { rotateY: 0 }) : undefined}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.3, times: [0, 0.2, 0.8, 1] }}
            >
              {e && <span className="text-xl leading-none">{e}</span>}
            </motion.div>
          ))}
        </Frame>
      );

    case 'cage':
      return (
        <Frame className="flex items-center justify-center bg-black">
          <div className="relative h-16 w-16" style={{ isolation: 'isolate' }}>
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" style={{ mixBlendMode: 'screen' }} aria-hidden="true">
              <g fill="none" stroke="#00ffff" strokeWidth="5">
                <rect x="8" y="12" width="84" height="80" rx="6" />
                {[24, 40, 56, 72].map(x => <line key={x} x1={x} y1="12" x2={x} y2="92" />)}
              </g>
            </svg>
            <motion.span
              className="absolute top-1/2 -mt-4 text-3xl leading-none"
              style={{ filter: 'grayscale(1) sepia(1) saturate(8) hue-rotate(-50deg)', mixBlendMode: 'screen' }}
              animate={move({ left: ['-70%', '22%', '22%', '-70%'] }, { left: '22%' })}
              transition={{ duration: 4, repeat: Infinity, times: [0, 0.4, 0.8, 1] }}
            >
              🦁
            </motion.span>
          </div>
        </Frame>
      );

    case 'fusion':
      return (
        <Frame className="flex items-center justify-center bg-black">
          <div className="relative h-16 w-28 rounded-lg border-2 border-slate-300">
            {[[18, 30, '#ff3b3b'], [55, 60, '#00ffff'], [80, 25, '#f8fafc']].map(([x, y, c], i) => (
              <motion.span
                key={i}
                className="absolute -ml-2 -mt-2 text-base leading-none"
                style={{ left: `${x}%`, top: `${y}%`, color: c as string }}
                animate={move({ opacity: [0.4, 1, 0.4] }, { opacity: 1 })}
                transition={loop(2, i * 0.5)}
              >
                ★
              </motion.span>
            ))}
          </div>
        </Frame>
      );

    case 'nightsearch':
      return (
        <Frame className="bg-black">
          <motion.div
            className="absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(253,230,138,0.35), transparent 70%)', top: '55%' }}
            animate={move({ left: ['25%', '70%', '45%', '25%'] }, { left: '45%' })}
            transition={loop(5)}
          />
          <span className="absolute left-[45%] top-[55%] -translate-x-1/2 -translate-y-1/2 text-2xl leading-none">🧸</span>
          <div className="absolute left-2 top-2"><RescuePup role="police" size={34} /></div>
        </Frame>
      );

    case 'skycatch':
      return (
        <Frame className="bg-gradient-to-b from-slate-950 to-indigo-950">
          <motion.span
            className="absolute text-xl leading-none"
            animate={move({ top: ['0%', '62%'], left: ['40%', '46%'] }, { top: '35%', left: '44%' })}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
          >
            🦴
          </motion.span>
          <motion.div
            className="absolute bottom-1 flex flex-col items-center"
            animate={move({ left: ['20%', '38%', '20%'] }, { left: '38%' })}
            transition={loop(2.2)}
          >
            <RescuePup role="pilot" size={30} />
            <span className="-mt-1 text-2xl leading-none" style={{ transform: 'scaleX(-1)' }}>🚁</span>
          </motion.div>
        </Frame>
      );

    case 'firerescue':
      return (
        <Frame className="flex items-center justify-center gap-3">
          <RescuePup role="fire" size={44} />
          <div className="grid grid-cols-3 gap-1 rounded-md bg-orange-900 p-1.5">
            {['🌷', '🔥', null, null, '🐱', '🔥'].map((c, i) => (
              <motion.div
                key={i}
                className="flex h-7 w-7 items-center justify-center rounded-sm border border-amber-400 bg-black text-sm leading-none"
                animate={c === '🔥' ? move({ scale: [1, 1.15, 1] }, { scale: 1 }) : undefined}
                transition={loop(1.2, i * 0.2)}
              >
                {c}
              </motion.div>
            ))}
          </div>
        </Frame>
      );

    case 'lookout':
      return (
        <Frame className="flex items-center justify-center">
          <RescuePup role="police" size={52} />
          {[{ top: '14%', left: '12%' }, { bottom: '16%', right: '12%' }, { top: '18%', right: '16%' }].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute h-4 w-4 rounded-full bg-yellow-300 shadow-[0_0_12px_#fde047]"
              style={pos}
              animate={move({ opacity: [0, 1, 0, 0] }, { opacity: i === 0 ? 1 : 0 })}
              transition={{ duration: 3, repeat: Infinity, delay: i, times: [0, 0.1, 0.3, 1] }}
            />
          ))}
        </Frame>
      );

    default:
      return <Frame />;
  }
};
