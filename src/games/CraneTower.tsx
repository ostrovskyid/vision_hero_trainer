import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, targetColor, sceneColor, tintStyle } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The builder pup's crane: a block swings to and fro on the crane hook and
 * the child taps to drop it onto the tower. The eyes follow the swinging
 * block (smooth pursuit) and the tap has to come at the right moment (timing,
 * eye-hand). A missed block just tumbles away; a finished tower earns a cheer
 * and a new one starts.
 */

const LEVELS = {
  easy: { blocks: 5, width: 2.6, swing: 1.2, tolerance: 0.75 },
  medium: { blocks: 6, width: 2.1, swing: 1.7, tolerance: 0.6 },
  hard: { blocks: 7, width: 1.7, swing: 2.3, tolerance: 0.5 },
} as const;

const BLOCK_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ec4899', '#a855f7', '#14b8a6'];

type Drop = { x: number; landed: boolean } | null;

export const CraneTower = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'builder');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [drops, setDrops] = useState(0);
  // Horizontal centre of each block in the tower, bottom first, as a share of the width.
  const [tower, setTower] = useState<number[]>([]);
  const [swing, setSwing] = useState(0.56);
  const [drop, setDrop] = useState<Drop>(null);
  const [cheer, setCheer] = useState(false);
  const [build, setBuild] = useState(0);
  const swingRef = useRef(0.56);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, drops), onComplete);
  });

  // The hook swings while there is no block in the air.
  useEffect(() => {
    if (!isPlaying || drop || cheer) return;
    let frame = 0;
    const startedAt = performance.now();
    const speed = level.swing * (0.7 + config.speed * 0.06);
    const phase = Math.asin(Math.max(-1, Math.min(1, (swingRef.current - 0.56) / 0.32)));
    const tick = (now: number) => {
      const x = 0.56 + Math.sin(phase + ((now - startedAt) / 1000) * speed) * 0.32;
      swingRef.current = x;
      setSwing(x);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, drop, cheer]);

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    speak(t('{name} is building a tower! Tap to drop each block on top!', { name }), config.voiceEnabled);
  };

  // Sizes follow the play area: the finished tower fits under the crane.
  const ground = size.height - 44;
  const hookY = 70;
  const blockH = Math.max(26, (ground - hookY - 60) / (level.blocks + 1.6));
  const blockW = Math.min(size.width * 0.3, blockH * level.width);
  const topX = tower.length ? tower[tower.length - 1] : swing;
  const landingY = ground - blockH * (tower.length + 1);

  const release = () => {
    if (!isPlaying || drop || cheer) return;
    const x = swingRef.current;
    const offset = Math.abs(x - topX) * size.width;
    // The first block lands wherever it falls; the rest have to land on the tower.
    const landed = tower.length === 0 || offset < blockW * level.tolerance;
    setDrops(d => d + 1);
    setDrop({ x, landed });
    later(() => {
      if (landed) {
        playSound('hit', config.soundEnabled);
        setScore(s => s + 1);
        const next = [...tower, x];
        setTower(next);
        if (next.length >= level.blocks) {
          setCheer(true);
          playSound('honk', config.soundEnabled);
          speak(t('What a tall tower! Great building!'), config.voiceEnabled);
          later(() => { setTower([]); setCheer(false); setBuild(b => b + 1); }, 2200);
        }
      } else {
        playSound('miss', config.soundEnabled);
      }
    }, 420);
    later(() => setDrop(null), landed ? 440 : 1100);
  };

  const block = targetColor(config, BLOCK_COLORS[tower.length % BLOCK_COLORS.length]);
  const steel = sceneColor(config, '#facc15');
  const towerColor = (i: number) => sceneColor(config, BLOCK_COLORS[i % BLOCK_COLORS.length]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-gradient-to-b from-sky-950 to-slate-950">
      {!started && (
        <StartOverlay label={t('Start the Crane')} hint={t('Tap to drop the block onto the tower!')} onStart={start}>
          <RescuePup role="builder" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-0 touch-none" onPointerDown={started ? release : undefined}>
        {started && size.width > 0 && (
          <>
            {/* The crane: a beam along the top and a rope down to the hook. */}
            <div className="absolute left-[4%] right-[4%] rounded" style={{ top: 38, height: 10, backgroundColor: steel }} />
            <div className="absolute rounded" style={{ left: '4%', top: 38, width: 10, bottom: 44, backgroundColor: steel, opacity: 0.6 }} />
            {!drop && !cheer && (
              <>
                <div className="absolute" style={{ left: swing * size.width - 1.5, top: 48, width: 3, height: hookY - 48, backgroundColor: steel }} />
                <div
                  className="absolute rounded-md"
                  style={{ left: swing * size.width - blockW / 2, top: hookY, width: blockW, height: blockH, backgroundColor: block }}
                />
              </>
            )}

            {/* The ground and the tower (scenery), the falling block (target). */}
            <div className="absolute left-0 right-0" style={{ top: ground, height: 4, backgroundColor: sceneColor(config, '#475569') }} />
            {tower.map((x, i) => (
              <motion.div
                key={`${build}-${i}`}
                className="absolute rounded-md"
                style={{ left: x * size.width - blockW / 2, top: ground - blockH * (i + 1), width: blockW, height: blockH - 2, backgroundColor: towerColor(i) }}
                animate={cheer ? { y: [0, -10, 0] } : { y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05, repeat: cheer ? 2 : 0 }}
              />
            ))}
            {drop && (
              <motion.div
                className="absolute rounded-md"
                style={{ left: drop.x * size.width - blockW / 2, width: blockW, height: blockH, backgroundColor: block }}
                initial={{ top: hookY, rotate: 0 }}
                animate={drop.landed
                  ? { top: landingY }
                  : { top: [hookY, landingY, size.height + blockH], rotate: [0, 0, drop.x < topX ? -70 : 70] }}
                transition={drop.landed ? { duration: 0.42, ease: 'easeIn' } : { duration: 1.1, times: [0, 0.4, 1], ease: 'easeIn' }}
              />
            )}

            {/* The builder pup cheers from the side. */}
            <motion.div
              className="pointer-events-none absolute"
              style={{ left: 'calc(4% + 16px)', top: ground - 72 }}
              animate={cheer ? { y: [0, -24, 0, -24, 0] } : { y: 0 }}
              transition={{ duration: 1.2 }}
            >
              <RescuePup role="builder" size={72} style={tintStyle(config, 'target')} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};
