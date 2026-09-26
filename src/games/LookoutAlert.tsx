import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, targetColor, tintStyle } from './common';
import { RescuePup, pupName } from '../pups';

/**
 * Peripheral awareness with the eyes kept in the middle. The police pup sits
 * on the lookout in the centre; when a light flashes somewhere at the side,
 * the child taps the PUP (not the light). The answer is always in the middle,
 * and the lights are brief, so there is no reason to look away: the child
 * notices them out of the corner of the eye, which is the skill.
 *
 * This replaces the old Peripheral Patrol, where the child tapped the edge
 * targets themselves and so simply looked at them.
 */

const LEVELS = {
  easy: { flashMs: 1100, size: 46 },
  medium: { flashMs: 750, size: 34 },
  hard: { flashMs: 480, size: 24 },
} as const;

/** A tap this long after a light started still counts. */
const RESPONSE_MS = 1600;

export const LookoutAlert = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'police');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [flashes, setFlashes] = useState(0);
  const [light, setLight] = useState<{ x: number; y: number; id: number } | null>(null);
  const [cheer, setCheer] = useState(false);
  const flashAt = useRef<number | null>(null);
  const answered = useRef(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, flashes), onComplete);
  });

  // Lights at random places around the edge, at random intervals.
  useEffect(() => {
    if (!isPlaying || size.width === 0) return;
    let id = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        // Somewhere in the outer band of the screen, away from the pup.
        const angle = Math.random() * Math.PI * 2;
        const x = 0.5 + Math.cos(angle) * (0.36 + Math.random() * 0.08);
        const y = 0.5 + Math.sin(angle) * (0.32 + Math.random() * 0.08);
        setLight({ x, y, id: ++id });
        setFlashes(f => f + 1);
        flashAt.current = performance.now();
        answered.current = false;
        later(() => setLight(null), level.flashMs);
        schedule();
      }, 2000 + Math.random() * 2600);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [isPlaying, size.width]);

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    speak(`Look at ${name}! When a light flashes at the side, tap ${name}!`, config.voiceEnabled);
  };

  const tapPup = () => {
    if (!isPlaying) return;
    const since = flashAt.current === null ? Infinity : performance.now() - flashAt.current;
    if (since <= RESPONSE_MS && !answered.current) {
      answered.current = true;
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setCheer(true);
      later(() => setCheer(false), 500);
    } else {
      // Too early: a gentle reminder, no points lost.
      speak('Wait for the light!', config.voiceEnabled);
    }
  };

  const pupSize = Math.max(120, config.size * 3);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950">
      {!started && (
        <StartOverlay label="Start the Lookout" hint={`Keep your eyes on ${name}. When a light flashes at the side, tap ${name}!`} onStart={start}>
          <RescuePup role="police" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-0">
        {started && size.width > 0 && (
          <>
            {light && (
              <motion.div
                key={light.id}
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: light.x * size.width - level.size / 2, top: light.y * size.height - level.size / 2,
                  width: level.size, height: level.size,
                  backgroundColor: targetColor(config, '#facc15'),
                  boxShadow: `0 0 ${level.size}px ${targetColor(config, '#facc15')}`,
                }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.12 }}
              />
            )}
            {/* The pup on the lookout: the only thing to tap, always in the middle. */}
            <motion.button
              onClick={tapPup}
              aria-label={`Tap ${name}`}
              className="absolute flex items-center justify-center rounded-full"
              style={{ left: size.width / 2 - pupSize / 2, top: size.height / 2 - pupSize / 2, width: pupSize, height: pupSize }}
              animate={cheer ? { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] } : { y: [0, -4, 0] }}
              transition={cheer ? { duration: 0.4 } : { duration: 2.4, repeat: Infinity }}
            >
              <RescuePup role="police" size={pupSize} style={tintStyle(config, 'target')} />
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
};
