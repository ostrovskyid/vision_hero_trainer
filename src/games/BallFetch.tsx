import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, sceneColor, tintStyle, shuffle } from './common';
import { Boy, FacetBall, Spaniel, childName, dogName } from '../family';
import { t } from '../i18n';

/**
 * Fetch: the child throws the family dog's ball into the park; it flies in an
 * arc, shrinks as it goes further away, bounces and rolls behind a bush. The
 * child taps the bush it hid behind, and the dog runs to fetch it.
 *
 * What it trains: following a target that moves in depth, changing size and
 * height as it goes (harder than side-to-side pursuit), then holding its
 * place in mind once it is hidden. On harder levels the ball first rolls
 * behind one bush, comes out, and hides behind another, so the eyes have to
 * stay with it through a gap (tracking with occlusion).
 */

const LEVELS = {
  easy: { bushes: 3, passes: 0, flight: 2.2 },
  medium: { bushes: 4, passes: 1, flight: 2.6 },
  hard: { bushes: 5, passes: 2, flight: 2.8 },
} as const;

/** A bush in the park, by depth: 0 is near the child, 1 far away. */
interface Bush { x: number; depth: number }

type Phase = 'ready' | 'flying' | 'ask' | 'fetch';

const depthScale = (d: number) => 1 - 0.55 * d;

export const BallFetch = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const dog = dogName(config);
  const child = childName(config);
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [bushes, setBushes] = useState<Bush[]>([]);
  const [target, setTarget] = useState(0);
  const [path, setPath] = useState<{ left: number[]; top: number[]; scale: number[]; rotate: number[]; times: number[] } | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, tries), onComplete);
  });

  // Park geometry: the horizon is a third of the way down; things further away sit higher and smaller.
  const groundY = (d: number) => size.height * (0.86 - 0.5 * d);
  const bushW = Math.max(90, Math.min(size.width / 5.5, size.height / 3.2));
  const ballBase = bushW * 0.34;
  const home = { x: size.width * 0.16, y: size.height * 0.8 };

  const newPark = () => {
    const count = level.bushes;
    const slots = shuffle(Array.from({ length: count }, (_, i) => i));
    const next: Bush[] = slots.map((slot, i) => ({
      x: 0.32 + (slot / Math.max(1, count - 1)) * 0.6 + (Math.random() - 0.5) * 0.04,
      depth: [0.15, 0.75, 0.45, 0.9, 0.3][i % 5],
    }));
    setBushes(next);
    setRound(r => r + 1);
    setPhase('ready');
    setPath(null);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newPark();
    speak(child ? t('{child}, throw the ball for {dog}! Watch where it goes!', { child, dog }) : t('Throw the ball for {dog}! Watch where it goes!', { dog }), config.voiceEnabled);
  };

  /** Samples the flight: an arc to the first landing, bounces, then rolls behind bushes. */
  const buildPath = (stops: number[]) => {
    const pts: { x: number; y: number; s: number }[] = [];
    const add = (x: number, y: number, s: number) => pts.push({ x, y, s });
    const first = bushes[stops[0]];
    const landX = first.x * size.width - bushW * depthScale(first.depth) * 0.9;
    const landD = Math.max(0, first.depth - 0.05);
    const land = { x: landX, y: groundY(landD), s: depthScale(landD) };
    // The throw: a high arc from the child's hand.
    for (let i = 0; i <= 24; i++) {
      const k = i / 24;
      add(home.x + (land.x - home.x) * k, home.y + (land.y - home.y) * k - Math.sin(Math.PI * k) * size.height * 0.45, 1 + (land.s - 1) * k);
    }
    // Two small bounces.
    let at = land;
    for (const hop of [0.12, 0.05]) {
      const to = { x: at.x + bushW * 0.35 * at.s, y: at.y, s: at.s };
      for (let i = 1; i <= 8; i++) {
        const k = i / 8;
        add(at.x + (to.x - at.x) * k, at.y - Math.sin(Math.PI * k) * size.height * hop * at.s, at.s);
      }
      at = to;
    }
    // Roll behind each bush in turn: the ones passed through, then the last one.
    for (const b of stops) {
      const bush = bushes[b];
      const to = { x: bush.x * size.width, y: groundY(bush.depth) - bushW * depthScale(bush.depth) * 0.22, s: depthScale(bush.depth) };
      for (let i = 1; i <= 14; i++) {
        const k = i / 14;
        add(at.x + (to.x - at.x) * k, at.y + (to.y - at.y) * k, at.s + (to.s - at.s) * k);
      }
      at = to;
    }
    const n = pts.length;
    return {
      left: pts.map(p => p.x - (ballBase * p.s) / 2),
      top: pts.map(p => p.y - ballBase * p.s),
      scale: pts.map(p => p.s),
      rotate: pts.map((_, i) => i * 40),
      times: pts.map((_, i) => i / (n - 1)),
    };
  };

  const throwBall = () => {
    if (!isPlaying || phase !== 'ready' || bushes.length === 0) return;
    const order = shuffle<number>(Array.from({ length: bushes.length }, (_, i) => i));
    const stops = order.slice(0, level.passes + 1);
    setTarget(stops[stops.length - 1]);
    setPath(buildPath(stops));
    setPhase('flying');
    playSound('honk', config.soundEnabled);
  };

  const landed = () => {
    setPhase('ask');
    speak(t('Where is the ball? Tap the bush!'), config.voiceEnabled);
  };

  const chooseBush = (i: number) => {
    if (!isPlaying || phase !== 'ask') return;
    setTries(n => n + 1);
    if (i === target) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setPhase('fetch');
      speak(t('Yes! Fetch, {dog}!', { dog }), config.voiceEnabled);
      later(newPark, 2600);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(i);
      later(() => setWrong(null), 450);
      speak(t('Not there! Where did it roll?'), config.voiceEnabled);
    }
  };

  const bush = (b: Bush) => ({ x: b.x * size.width, y: groundY(b.depth), w: bushW * depthScale(b.depth) });
  const fetchTo = bushes[target] ? bush(bushes[target]) : { x: 0, y: 0, w: 0 };
  const dogSize = Math.max(64, bushW * 0.75);
  const leaf = sceneColor(config, '#15803d');
  const leafDark = sceneColor(config, '#166534');

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800" style={{ background: config.anaglyphMode ? '#000' : 'linear-gradient(#7dd3fc 0%, #bae6fd 30%, #86efac 31%, #16a34a 100%)' }}>
      {!started && (
        <StartOverlay label={t('Play Fetch')} hint={t('Throw the ball, watch where it rolls, then tap that bush!')} onStart={start}>
          <div className="flex items-end gap-2">
            <Boy size={96} style={tintStyle(config, 'target')} />
            <Spaniel size={96} style={tintStyle(config, 'target')} />
            <FacetBall size={44} style={tintStyle(config, 'target')} />
          </div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-0">
        {started && size.width > 0 && (
          <>
            {/* The ball (target eye), drawn under the bushes so they hide it. */}
            {path && phase !== 'fetch' && (
              <motion.div
                key={`ball-${round}`}
                className="pointer-events-none absolute"
                style={{ width: ballBase, height: ballBase, left: path.left[0], top: path.top[0], transformOrigin: 'center' }}
                initial={false}
                animate={{ left: path.left, top: path.top, scale: path.scale, rotate: path.rotate }}
                transition={{ duration: level.flight * (config.difficulty === 'easy' ? 1 : 1.1 - config.speed * 0.02), times: path.times, ease: 'linear' }}
                onAnimationComplete={() => { if (phase === 'flying') landed(); }}
              >
                <FacetBall size={ballBase} style={tintStyle(config, 'target')} />
              </motion.div>
            )}

            {/* Bushes, far ones first so near ones overlap them. */}
            {bushes.map((b, i) => ({ b, i })).sort((p, q) => q.b.depth - p.b.depth).map(({ b, i }) => {
              const box = bush(b);
              return (
                <motion.button
                  key={`${round}-${i}`}
                  onClick={() => chooseBush(i)}
                  aria-label={t('Bush {n}', { n: i + 1 })}
                  className="absolute"
                  style={{ left: box.x - box.w / 2, top: box.y - box.w * 0.72, width: box.w, height: box.w * 0.72, cursor: phase === 'ask' ? 'pointer' : 'default' }}
                  animate={wrong === i ? { rotate: [-6, 6, -6, 6, 0] } : phase === 'ask' ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                  transition={wrong === i ? { duration: 0.4 } : { duration: 1.6, repeat: phase === 'ask' ? Infinity : 0 }}
                >
                  <svg viewBox="0 0 100 72" width="100%" height="100%" aria-hidden="true">
                    <ellipse cx="50" cy="68" rx="46" ry="5" fill="#000" fillOpacity="0.15" />
                    <circle cx="28" cy="44" r="24" fill={leafDark} />
                    <circle cx="72" cy="44" r="24" fill={leafDark} />
                    <circle cx="50" cy="30" r="28" fill={leaf} />
                    <circle cx="30" cy="50" r="18" fill={leaf} />
                    <circle cx="70" cy="50" r="18" fill={leaf} />
                    <rect x="8" y="50" width="84" height="20" rx="10" fill={leaf} />
                  </svg>
                </motion.button>
              );
            })}

            {/* The child, and the dog who runs to fetch. */}
            <div className="pointer-events-none absolute" style={{ left: home.x - dogSize * 0.55, top: home.y - dogSize * 0.55 }}>
              <Boy size={dogSize * 1.1} style={tintStyle(config, 'target')} />
            </div>
            <motion.div
              className="pointer-events-none absolute flex flex-col items-center"
              style={{ left: home.x + dogSize * 0.5, top: home.y - dogSize * 0.3 }}
              animate={phase === 'fetch'
                ? {
                    x: [0, fetchTo.x - home.x - dogSize * 0.5 - dogSize * 0.3, fetchTo.x - home.x - dogSize * 0.5 - dogSize * 0.3, 0],
                    y: [0, fetchTo.y - home.y - fetchTo.w * 0.3, fetchTo.y - home.y - fetchTo.w * 0.3, 0],
                    scale: [1, depthScale(bushes[target]?.depth ?? 0), depthScale(bushes[target]?.depth ?? 0), 1],
                  }
                : phase === 'ask' ? { x: 0, y: [0, -8, 0], scale: 1 } : { x: 0, y: 0, scale: 1 }}
              transition={phase === 'fetch' ? { duration: 2.2, times: [0, 0.4, 0.55, 1], ease: 'easeInOut' } : { duration: 0.8, repeat: phase === 'ask' ? Infinity : 0 }}
            >
              <Spaniel size={dogSize} style={tintStyle(config, 'target')} />
              {phase === 'fetch' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 1] }} transition={{ duration: 2.2, times: [0, 0.45, 0.5, 1] }} className="-mt-3">
                  <FacetBall size={ballBase * 0.8} style={tintStyle(config, 'target')} />
                </motion.div>
              )}
            </motion.div>

            {/* The big throw button while the ball is in the child's hand. */}
            {phase === 'ready' && (
              <motion.button
                onClick={throwBall}
                className="absolute flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-4 text-xl font-bold text-slate-950 shadow-lg"
                style={{ left: home.x - 40, top: home.y + dogSize * 0.1 - 120 }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [1, 1.08, 1], opacity: 1 }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <FacetBall size={34} /> {t('Throw!')}
              </motion.button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
