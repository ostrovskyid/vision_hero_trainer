import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, tintStyle, shuffle, pick, bestFit } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The dino pup's misty valley: dinosaurs stand in the mist, and the pup asks
 * for one of them. The dinosaurs are grey shapes against grey mist, so this
 * trains contrast sensitivity, which amblyopia lowers along with sharpness.
 * The mist thickens after each find and clears a little after a wrong tap (a
 * staircase), so the game settles at the faintest shapes the child can find.
 */

const DINOS = [
  { emoji: '🦕', name: 'long-neck' },
  { emoji: '🦖', name: 'T. rex' },
  { emoji: '🐊', name: 'crocodile' },
  { emoji: '🦎', name: 'lizard' },
  { emoji: '🐢', name: 'turtle' },
  { emoji: '🐉', name: 'dragon' },
] as const;

type Dino = (typeof DINOS)[number];

const LEVELS = {
  easy: { count: 3, start: 0.7, min: 0.18 },
  medium: { count: 4, start: 0.55, min: 0.1 },
  hard: { count: 6, start: 0.45, min: 0.05 },
} as const;

export const MistyDinos = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'dino');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [round, setRound] = useState(0);
  const [field, setField] = useState<Dino[]>([]);
  const [wanted, setWanted] = useState<Dino>(DINOS[0]);
  // How much the dinosaurs stand out from the mist, 0-1.
  const [contrast, setContrast] = useState<number>(level.start);
  const [found, setFound] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, tries), onComplete);
  });

  const newRound = (previous?: Dino) => {
    const pickFrom = shuffle(DINOS).slice(0, level.count);
    const target = pick(pickFrom.filter(d => d !== previous).length ? pickFrom.filter(d => d !== previous) : pickFrom);
    setField(pickFrom);
    setWanted(target);
    setFound(null);
    setRound(r => r + 1);
    speak(t(`Where is the ${target.name}?`), config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    speak(t('{name} is looking for dinosaurs in the mist!', { name }), config.voiceEnabled);
    later(() => newRound(), 2200);
  };

  const choose = (i: number) => {
    if (!isPlaying || found !== null || field.length === 0) return;
    setTries(n => n + 1);
    if (field[i] === wanted) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setFound(i);
      setContrast(c => Math.max(level.min, c * 0.82));
      later(() => newRound(wanted), 1300);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(i);
      later(() => setWrong(null), 400);
      setContrast(c => Math.min(0.9, c * 1.25));
    }
  };

  const grid = bestFit(size.width - 32, size.height - 16, level.count);
  const cell = Math.max(90, grid.cell);
  // Grey dinosaurs, faded towards the grey mist by the current contrast.
  const dinoStyle = (i: number) => ({
    fontSize: cell * 0.62,
    filter: `grayscale(1) brightness(${found === i ? 1 : 0.9})`,
    opacity: found === i ? 1 : contrast,
    ...tintStyle(config, 'target'),
  });

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800" style={{ backgroundColor: config.anaglyphMode ? '#000000' : '#6b7280' }}>
      {!started && (
        <StartOverlay label={t('Into the Valley')} hint={t('Find the dinosaur the pup asks for. The mist gets thicker as you go!')} onStart={start}>
          <RescuePup role="dino" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <div className="absolute inset-x-0 top-3 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-slate-700 bg-slate-900/90 py-1 pl-1 pr-5">
          <RescuePup role="dino" size={48} style={tintStyle(config, 'target')} />
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('Find')}</span>
          <span className="text-4xl leading-none" style={tintStyle(config, 'target')}>{wanted.emoji}</span>
        </div>
      )}

      <div ref={areaRef} className="absolute inset-x-0 top-16 bottom-10 flex items-center justify-center">
        {started && size.width > 0 && (
          <div className="grid" style={{ gridTemplateColumns: `repeat(${grid.cols}, ${cell}px)`, gap: cell * 0.12 }}>
            {field.map((dino, i) => (
              <motion.button
                key={`${round}-${i}`}
                onClick={() => choose(i)}
                aria-label={t(dino.name)}
                className="flex items-center justify-center rounded-3xl"
                style={{ width: cell, height: cell }}
                initial={{ opacity: 0 }}
                animate={wrong === i ? { opacity: 1, x: [-8, 8, -8, 8, 0] } : found === i ? { opacity: 1, scale: 1.2, y: -10 } : { opacity: 1, y: [0, -6, 0] }}
                transition={wrong === i || found === i ? { duration: 0.4 } : { default: { duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.6 } }}
              >
                <span className="leading-none" style={dinoStyle(i)}>{dino.emoji}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Drifting mist (scenery), over everything but the taps. */}
      {!config.anaglyphMode && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(209,213,219,0.35), transparent 60%), radial-gradient(ellipse at 75% 70%, rgba(209,213,219,0.3), transparent 55%)' }}
          animate={{ x: [-30, 30, -30] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
};
