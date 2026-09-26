import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, targetColor, tintStyle, shuffle, pick } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The snow pup's snowflake hunt: the pup holds up one snowflake and the child
 * finds its twin among flakes drifting in the sky. The flakes differ only in
 * small details (how many side branches, the shape of the tips, the centre),
 * so this is fine-detail looking, the core of acuity training, on gently
 * moving targets. Easy flakes differ in two details, harder ones in one.
 */

interface Flake { branches: 1 | 2 | 3; tip: 'plain' | 'dot' | 'fork'; center: 'dot' | 'ring' | 'hex' }

const BRANCHES: Flake['branches'][] = [1, 2, 3];
const TIPS: Flake['tip'][] = ['plain', 'dot', 'fork'];
const CENTERS: Flake['center'][] = ['dot', 'ring', 'hex'];

const LEVELS = {
  easy: { count: 4, changes: 2, scale: 1 },
  medium: { count: 5, changes: 1, scale: 0.85 },
  hard: { count: 6, changes: 1, scale: 0.65 },
} as const;

const same = (a: Flake, b: Flake) => a.branches === b.branches && a.tip === b.tip && a.center === b.center;

/** A different flake that changes `changes` of the three details. */
const variant = (base: Flake, changes: number): Flake => {
  const keys = shuffle(['branches', 'tip', 'center'] as const).slice(0, changes);
  const next = { ...base };
  for (const k of keys) {
    if (k === 'branches') next.branches = pick(BRANCHES.filter(v => v !== base.branches));
    if (k === 'tip') next.tip = pick(TIPS.filter(v => v !== base.tip));
    if (k === 'center') next.center = pick(CENTERS.filter(v => v !== base.center));
  }
  return next;
};

export const SnowflakeShape = ({ flake, size, color }: { flake: Flake; size: number; color: string }) => {
  const arms = [0, 60, 120, 180, 240, 300];
  const along = flake.branches === 1 ? [22] : flake.branches === 2 ? [16, 28] : [12, 22, 31];
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true">
      <g stroke={color} strokeWidth={4.5} strokeLinecap="round" fill="none">
        {arms.map(a => (
          <g key={a} transform={`rotate(${a})`}>
            <line x1={0} y1={0} x2={0} y2={-40} />
            {along.map(d => (
              <g key={d}>
                <line x1={0} y1={-d} x2={-8} y2={-d - 8} />
                <line x1={0} y1={-d} x2={8} y2={-d - 8} />
              </g>
            ))}
            {flake.tip === 'dot' && <circle cx={0} cy={-42} r={4.5} fill={color} stroke="none" />}
            {flake.tip === 'fork' && (
              <>
                <line x1={0} y1={-40} x2={-6} y2={-47} />
                <line x1={0} y1={-40} x2={6} y2={-47} />
              </>
            )}
          </g>
        ))}
        {flake.center === 'dot' && <circle r={7} fill={color} stroke="none" />}
        {flake.center === 'ring' && <circle r={9} />}
        {flake.center === 'hex' && <polygon points="0,-10 8.7,-5 8.7,5 0,10 -8.7,5 -8.7,-5" fill={color} stroke="none" />}
      </g>
    </svg>
  );
};

export const SnowflakeMatch = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'snow');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [round, setRound] = useState(0);
  const [sample, setSample] = useState<Flake>({ branches: 2, tip: 'dot', center: 'hex' });
  const [flakes, setFlakes] = useState<Flake[]>([]);
  const [found, setFound] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, tries), onComplete);
  });

  const newRound = () => {
    const target: Flake = { branches: pick(BRANCHES), tip: pick(TIPS), center: pick(CENTERS) };
    const others: Flake[] = [];
    let guard = 0;
    while (others.length < level.count - 1 && guard++ < 200) {
      const v = variant(target, level.changes);
      if (!others.some(o => same(o, v))) others.push(v);
    }
    setSample(target);
    setFlakes(shuffle([target, ...others]));
    setFound(null);
    setRound(r => r + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
    speak(t('{name} found a snowflake. Find its twin in the sky!', { name }), config.voiceEnabled);
  };

  const choose = (i: number) => {
    if (!isPlaying || found !== null) return;
    setTries(n => n + 1);
    if (same(flakes[i], sample)) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setFound(i);
      later(newRound, 1100);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(i);
      later(() => setWrong(null), 400);
      speak(t('Look closely at the little branches!'), config.voiceEnabled);
    }
  };

  const ink = targetColor(config, '#e0f2fe');
  // Flakes share the sky's width; the sample sits with the pup at the bottom.
  const slot = size.width / Math.max(1, level.count);
  const flakeSize = Math.max(56, Math.min(slot * 0.8, size.height * 0.42) * level.scale);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-gradient-to-b from-indigo-950 to-slate-900">
      {!started && (
        <StartOverlay label={t('Let It Snow')} hint={t('Find the snowflake that looks exactly the same!')} onStart={start}>
          <RescuePup role="snow" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-x-0 top-12 bottom-40">
        {started && size.width > 0 && flakes.map((flake, i) => (
          <motion.button
            key={`${round}-${i}`}
            onClick={() => choose(i)}
            aria-label={t('Snowflake {n}', { n: i + 1 })}
            className="absolute flex items-center justify-center rounded-full"
            style={{ left: slot * (i + 0.5) - flakeSize / 2, top: (size.height - flakeSize) * (i % 2 ? 0.62 : 0.2), width: flakeSize, height: flakeSize }}
            initial={{ opacity: 0, y: -40 }}
            animate={found === i
              ? { opacity: 1, scale: 1.25, rotate: 0, y: 0 }
              : wrong === i
                ? { opacity: 1, x: [-8, 8, -8, 8, 0] }
                : { opacity: found !== null ? 0.25 : 1, y: [0, 18, 0], rotate: [0, i % 2 ? 20 : -20, 0] }}
            transition={found === i || wrong === i
              ? { duration: 0.4 }
              : { default: { duration: 4 + (i % 3), repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.4 } }}
          >
            <SnowflakeShape flake={flake} size={flakeSize} color={ink} />
          </motion.button>
        ))}
      </div>

      {started && (
        <div className="absolute inset-x-0 bottom-9 flex items-end justify-center gap-4">
          <RescuePup role="snow" size={96} style={tintStyle(config, 'target')} />
          <div className="mb-2 flex items-center justify-center rounded-2xl border-4 border-sky-300/50 bg-slate-950/70 p-2">
            <SnowflakeShape flake={sample} size={Math.min(110, Math.max(64, flakeSize * 0.9))} color={ink} />
          </div>
        </div>
      )}
    </div>
  );
};
