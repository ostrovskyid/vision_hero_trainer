import { useRef, useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, sceneColor, pick, shuffle, useLater } from './common';
import { t } from '../i18n';

/**
 * Form discrimination: drag each aircraft into the hangar with its shadow.
 * On hard the shadows are turned at an angle, so the child has to recognise
 * the outline regardless of orientation (shape constancy).
 */

const AIRCRAFT = [
  { emoji: '✈️', name: 'plane' },
  { emoji: '🛩️', name: 'little plane' },
  { emoji: '🚁', name: 'helicopter' },
  { emoji: '🚀', name: 'rocket' },
  { emoji: '🛸', name: 'flying saucer' },
  { emoji: '🎈', name: 'balloon' },
  { emoji: '🪂', name: 'parachute' },
  { emoji: '🛰️', name: 'satellite' },
] as const;

type Aircraft = (typeof AIRCRAFT)[number];

const HANGARS = { easy: 3, medium: 4, hard: 4 } as const;

export const HangarMatch = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [plane, setPlane] = useState<Aircraft>(AIRCRAFT[0]);
  const [hangars, setHangars] = useState<{ aircraft: Aircraft; angle: number }[]>([]);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [parked, setParked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const hangarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const origin = useRef({ x: 0, y: 0 });

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newRound = () => {
    const set = shuffle(AIRCRAFT).slice(0, HANGARS[config.difficulty]);
    const next = pick(set);
    setHangars(set.map(aircraft => ({
      aircraft,
      angle: config.difficulty === 'hard' ? (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 120) : 0,
    })));
    setPlane(next);
    setParked(null);
    setDrag(null);
    setRound(r => r + 1);
    speak(t(`Park the ${next.name} in its hangar!`), config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
  };

  const choose = (index: number) => {
    if (!isPlaying || parked !== null) return;
    setRounds(r => r + 1);
    if (hangars[index].aircraft === plane) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setParked(index);
      later(newRound, 1100);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(index);
      later(() => setWrong(null), 400);
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (parked !== null) return;
    origin.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ x: 0, y: 0 });
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y });
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const index = hangarRefs.current.findIndex(el => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    setDrag(null);
    if (index >= 0) choose(index);
  };

  const planeSize = Math.max(64, config.size * 1.8);
  const hangarSize = Math.max(96, config.size * 2.4);
  const frame = sceneColor(config, '#64748b');
  // The plane and the shadows are what the child compares, so both go to the target eye.
  const planeStyle = config.anaglyphMode ? { filter: 'url(#ag-tint-target)' } : {};
  const shadowStyle = config.anaglyphMode
    ? { filter: 'brightness(0) invert(1) url(#ag-tint-target) brightness(0.65)' }
    : { filter: 'brightness(0) invert(0.55)' };

  return (
    <div className="relative flex h-full min-h-[420px] w-full touch-none flex-col items-center justify-around overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8 pt-12">
      {!started && (
        <StartOverlay label={t('Open the Airport')} hint={t('Drag each aircraft into the hangar with its shadow!')} onStart={start}>
          <div className="text-6xl" style={planeStyle}>✈️🚁</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          {parked === null ? (
            <div
              className="relative z-10 flex cursor-grab items-center justify-center"
              style={{
                width: planeSize * 1.3,
                height: planeSize * 1.3,
                transform: drag ? `translate(${drag.x}px, ${drag.y}px) scale(1.1)` : undefined,
              }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
              aria-label={t(plane.name)}
              role="img"
            >
              <motion.span
                key={round}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="leading-none"
                style={{ fontSize: planeSize, ...planeStyle }}
              >
                {plane.emoji}
              </motion.span>
            </div>
          ) : (
            <div style={{ height: planeSize * 1.3 }} />
          )}

          <div className="flex flex-wrap justify-center gap-4 px-4">
            {hangars.map((h, i) => (
              <motion.div
                key={`${round}-${i}`}
                ref={el => { hangarRefs.current[i] = el; }}
                onClick={() => choose(i)}
                role="button"
                aria-label={t('Hangar {n}', { n: i + 1 })}
                animate={wrong === i ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
                transition={{ duration: 0.35 }}
                className="relative flex cursor-pointer items-center justify-center rounded-t-[48px] bg-black"
                style={{ width: hangarSize, height: hangarSize, border: `5px solid ${frame}`, borderBottomWidth: 0 }}
              >
                <span
                  className="leading-none"
                  style={{
                    fontSize: hangarSize * 0.55,
                    transform: `rotate(${h.angle}deg)`,
                    ...(parked === i ? planeStyle : shadowStyle),
                  }}
                >
                  {h.aircraft.emoji}
                </span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
