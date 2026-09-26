import { useEffect, useRef, useState } from 'react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, sceneColor, tintStyle, pick } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The water pup's bubble rescue: bubbles rise and sway from the sea floor,
 * each carrying a little sea creature. Baby turtles are lost; the child pops
 * only the bubbles that carry one and lets the others float away. Several
 * targets moving at once to follow (pursuit and attention), and a look at
 * each one to tell the turtle from the other creatures (discrimination).
 * Popping a wrong bubble costs nothing, it just floats on.
 */

const OTHERS = ['🐟', '🐠', '🦀', '🐙', '🐡', '🦐', '🐚'];
const TARGET = '🐢';

const LEVELS = {
  easy: { every: 1.6, max: 4, share: 0.5, sway: 18, size: 1.25 },
  medium: { every: 1.2, max: 6, share: 0.4, sway: 28, size: 1.05 },
  hard: { every: 0.9, max: 8, share: 0.33, sway: 40, size: 0.85 },
} as const;

interface Bubble { id: number; x: number; y: number; phase: number; emoji: string; popped: number | null }

export const BubbleRescue = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const name = pupName(config, 'water');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [taps, setTaps] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const listRef = useRef<Bubble[]>([]);
  const scoreRef = useRef(0);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, scoreRef.current, Math.max(1, taps), onComplete);
  });

  // Bubble size follows the sea's size; they stay big enough to tap.
  const bubbleSize = Math.max(64, Math.min(size.width / 7, size.height / 4.5) * level.size);

  // Spawn, rise and pop on each animation frame.
  useEffect(() => {
    if (!isPlaying || size.width === 0) return;
    let frame = 0, last = performance.now(), spawnIn = 0.3, nextId = listRef.current.length + 1;
    const riseSpeed = 30 + config.speed * 8;
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      spawnIn -= dt;
      let list = listRef.current;
      if (spawnIn <= 0 && list.filter(b => b.popped === null).length < level.max) {
        list = [...list, {
          id: nextId++,
          x: 0.12 + Math.random() * 0.76,
          y: size.height + bubbleSize,
          phase: Math.random() * Math.PI * 2,
          emoji: Math.random() < level.share ? TARGET : pick(OTHERS),
          popped: null,
        }];
        spawnIn = level.every * (0.7 + Math.random() * 0.6);
      }
      list = list
        .map(b => (b.popped === null ? { ...b, y: b.y - riseSpeed * dt } : b))
        .filter(b => b.y > -bubbleSize * 1.5 && (b.popped === null || now - b.popped < 500));
      listRef.current = list;
      setBubbles(list);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, size.width, size.height, bubbleSize]);

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    speak(t('Baby turtles are lost in the bubbles! Help {name} and pop only the turtle bubbles!', { name }), config.voiceEnabled);
  };

  const pop = (id: number) => {
    if (!isPlaying) return;
    const bubble = listRef.current.find(b => b.id === id);
    if (!bubble || bubble.popped !== null) return;
    setTaps(n => n + 1);
    if (bubble.emoji === TARGET) {
      playSound('hit', config.soundEnabled);
      scoreRef.current += 1;
      setScore(scoreRef.current);
      listRef.current = listRef.current.map(b => (b.id === id ? { ...b, popped: performance.now() } : b));
      setBubbles(listRef.current);
    } else {
      // Not a turtle: a soft boop, and the bubble floats on.
      playSound('miss', config.soundEnabled);
    }
  };

  const ring = sceneColor(config, '#7dd3fc');

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-gradient-to-b from-cyan-950 via-sky-950 to-blue-950">
      {!started && (
        <StartOverlay label={t('Dive In')} hint={t('Pop only the bubbles with a baby turtle!')} onStart={start}>
          <div className="flex items-center gap-3">
            <RescuePup role="water" size={110} style={tintStyle(config, 'target')} />
            <span className="text-6xl" style={tintStyle(config, 'target')}>{TARGET}</span>
          </div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <div className="pointer-events-none absolute right-4 top-3 z-20 flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 py-1 pl-1 pr-4">
          <RescuePup role="water" size={44} style={tintStyle(config, 'target')} />
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('Find')}</span>
          <span className="text-3xl leading-none" style={tintStyle(config, 'target')}>{TARGET}</span>
        </div>
      )}

      <div ref={areaRef} className="absolute inset-0">
        {started && bubbles.map(b => {
          const x = b.x * size.width + Math.sin(b.y / 70 + b.phase) * level.sway;
          const popped = b.popped !== null;
          return (
            <button
              key={b.id}
              onPointerDown={() => pop(b.id)}
              aria-label={b.emoji === TARGET ? t('Turtle bubble') : t('Bubble')}
              className="absolute flex items-center justify-center rounded-full transition-[transform,opacity] duration-500"
              style={{
                left: x - bubbleSize / 2, top: b.y - bubbleSize / 2, width: bubbleSize, height: bubbleSize,
                border: `3px solid ${ring}`,
                background: config.anaglyphMode ? 'transparent' : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(125,211,252,0.08) 60%)',
                transform: popped ? 'scale(1.6)' : undefined,
                opacity: popped ? 0 : 1,
              }}
            >
              <span className="leading-none" style={{ fontSize: bubbleSize * 0.55, ...tintStyle(config, 'target') }}>{b.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
