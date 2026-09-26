import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, tintStyle } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The pilot pup's sky catch: treats drift down the sky and the child steers
 * the helicopter under them with a finger. The eyes have to follow each
 * falling, swaying treat (pursuit) and guide the hand to meet it. A kitten on
 * a balloon now and then is a bonus rescue. Missed treats just fall away.
 */

const LEVELS = {
  easy: { every: 1.7, max: 3, sway: 20 },
  medium: { every: 1.3, max: 4, sway: 35 },
  hard: { every: 1.0, max: 5, sway: 55 },
} as const;

interface Treat { id: number; x: number; y: number; phase: number; kind: 'bone' | 'star' | 'kitten' }
const EMOJI = { bone: '🦴', star: '⭐', kitten: '🐱' } as const;

export const SkyCatch = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const name = pupName(config, 'pilot');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [treats, setTreats] = useState<Treat[]>([]);
  const [copterX, setCopterX] = useState(0.5);
  const [pop, setPop] = useState<{ x: number; y: number; id: number } | null>(null);
  const copterRef = useRef(0.5);
  const scoreRef = useRef(0);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, scoreRef.current, Math.max(1, caught + dropped), onComplete);
  });

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    speak(t('Fly with {name}! Catch the treats!', { name }), config.voiceEnabled);
  };

  const treatSize = Math.max(40, config.size * 1.1);
  const copterW = Math.max(110, config.size * 2.6);

  // The sky: spawn, fall and catch on each animation frame.
  useEffect(() => {
    if (!isPlaying || size.width === 0) return;
    let frame = 0, last = performance.now(), spawnIn = 0.4, nextId = 0;
    let list: Treat[] = [];
    const fallSpeed = 45 + config.speed * 12;
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      spawnIn -= dt;
      if (spawnIn <= 0 && list.length < level.max) {
        const roll = Math.random();
        list = [...list, {
          id: nextId++, x: 0.1 + Math.random() * 0.8, y: -treatSize, phase: Math.random() * Math.PI * 2,
          kind: roll < 0.1 ? 'kitten' : roll < 0.3 ? 'star' : 'bone',
        }];
        spawnIn = level.every * (0.7 + Math.random() * 0.6);
      }
      const catchY = size.height - 110;
      const next: Treat[] = [];
      for (const tr of list) {
        const y = tr.y + fallSpeed * dt;
        const x = tr.x * size.width + Math.sin(y / 60 + tr.phase) * level.sway;
        const cx = copterRef.current * size.width;
        if (y >= catchY && y <= catchY + 40 && Math.abs(x - cx) < copterW / 2) {
          const points = tr.kind === 'kitten' ? 3 : 1;
          scoreRef.current += points;
          setScore(scoreRef.current);
          setCaught(c => c + 1);
          setPop({ x, y, id: tr.id });
          playSound(tr.kind === 'kitten' ? 'honk' : 'hit', config.soundEnabled);
          if (tr.kind === 'kitten') speak(t('You rescued the kitten!'), config.voiceEnabled);
          continue;
        }
        if (y > size.height + treatSize) { setDropped(d => d + 1); continue; }
        next.push({ ...tr, y });
      }
      list = next;
      setTreats(list);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, size.width, size.height]);

  const steer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    copterRef.current = x;
    setCopterX(x);
  };

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-gradient-to-b from-slate-950 to-indigo-950">
      {!started && (
        <StartOverlay label={t('Take Off')} hint={t('Slide your finger to fly {name} under the treats!', { name })} onStart={start}>
          <RescuePup role="pilot" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div
        ref={areaRef}
        className="absolute inset-0 touch-none"
        onPointerDown={started ? steer : undefined}
        onPointerMove={started ? steer : undefined}
      >
        {started && size.width > 0 && (
          <>
            {treats.map(t => (
              <span
                key={t.id}
                className="pointer-events-none absolute leading-none"
                style={{
                  left: t.x * size.width + Math.sin(t.y / 60 + t.phase) * level.sway - treatSize / 2,
                  top: t.y - treatSize / 2,
                  fontSize: treatSize,
                  ...tintStyle(config, 'target'),
                }}
              >
                {t.kind === 'kitten' ? <span className="flex flex-col items-center"><span style={{ fontSize: treatSize * 0.8 }}>🎈</span>{EMOJI.kitten}</span> : EMOJI[t.kind]}
              </span>
            ))}
            {pop && (
              <span
                key={`pop-${pop.id}`}
                className="pointer-events-none absolute animate-ping text-3xl"
                style={{ left: pop.x - 16, top: pop.y - 16, ...tintStyle(config, 'target') }}
              >
                ✨
              </span>
            )}
            {/* The pup's helicopter (scenery eye in red/cyan mode). */}
            <div
              className="pointer-events-none absolute flex flex-col items-center"
              style={{ left: copterX * size.width - copterW / 2, top: size.height - 150, width: copterW, ...tintStyle(config, 'scene') }}
            >
              <RescuePup role="pilot" size={copterW * 0.45} />
              <span className="-mt-3 leading-none" style={{ fontSize: copterW * 0.55, transform: 'scaleX(-1)' }}>🚁</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
