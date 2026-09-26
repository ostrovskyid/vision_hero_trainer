import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, tintStyle, sceneColor, pick, shuffle, useLater } from './common';

/**
 * Visual closure: recognising a whole from a part. Zoo animals hide behind
 * bushes, crates and rocks with only an ear, a back or a tail showing; the
 * child finds the one that was named. Less of each animal shows on harder
 * levels.
 */

const ANIMALS = [
  { emoji: '🦁', name: 'lion' },
  { emoji: '🦓', name: 'zebra' },
  { emoji: '🦛', name: 'hippo' },
  { emoji: '🦒', name: 'giraffe' },
  { emoji: '🐧', name: 'penguin' },
  { emoji: '🐒', name: 'monkey' },
  { emoji: '🐘', name: 'elephant' },
  { emoji: '🐊', name: 'crocodile' },
] as const;

type Animal = (typeof ANIMALS)[number];
type Cover = 'bush' | 'crate' | 'rock';
type Side = 'top' | 'left' | 'right';

interface Spot { animal: Animal; cover: Cover; side: Side; }

const LEVELS = {
  easy: { spots: 3, peek: 0.5 },
  medium: { spots: 4, peek: 0.38 },
  hard: { spots: 6, peek: 0.26 },
} as const;

const COVER_COLORS: Record<Cover, string> = { bush: '#15803d', crate: '#a16207', rock: '#64748b' };

/** The hiding place. Solid-filled so it really hides what is behind it, for both eyes. */
const CoverShape = ({ cover, color }: { cover: Cover; color: string }) => (
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
    {cover === 'bush' && (
      <path d="M0 100 L0 40 Q8 12 30 22 Q42 0 62 14 Q84 4 92 26 Q100 30 100 44 L100 100 Z" fill={color} />
    )}
    {cover === 'crate' && (
      <>
        <rect x="0" y="4" width="100" height="96" fill={color} />
        <path d="M0 4 L100 100 M100 4 L0 100" stroke="#000" strokeOpacity="0.35" strokeWidth="5" />
        <rect x="0" y="4" width="100" height="96" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="6" />
      </>
    )}
    {cover === 'rock' && (
      <path d="M0 100 L4 46 Q14 14 44 10 Q80 6 94 34 L100 100 Z" fill={color} />
    )}
  </svg>
);

export const ZooHideSeek = ({ config, onComplete }: GameProps) => {
  const later = useLater();
  const level = LEVELS[config.difficulty];
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [wanted, setWanted] = useState<Animal>(ANIMALS[0]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [found, setFound] = useState(false);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newRound = () => {
    const animals = shuffle(ANIMALS).slice(0, level.spots);
    const covers: Cover[] = ['bush', 'crate', 'rock'];
    const sides: Side[] = ['top', 'left', 'right'];
    const next = animals.map(animal => ({ animal, cover: pick(covers), side: pick(sides) }));
    const target = pick(animals);
    setSpots(next);
    setWanted(target);
    setFound(false);
    setRound(r => r + 1);
    speak(`Where is the ${target.name}?`, config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
  };

  const choose = (spot: Spot, i: number) => {
    if (!isPlaying || found) return;
    setRounds(r => r + 1);
    if (spot.animal === wanted) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setFound(true);
      speak(`You found the ${wanted.name}!`, config.voiceEnabled);
      later(newRound, 1400);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(i);
      later(() => setWrong(null), 400);
    }
  };

  const spotSize = Math.max(110, config.size * 3);
  const animalSize = spotSize * 0.75;
  const visible = animalSize * level.peek;

  const placeAnimal = (side: Side) => {
    // Everything outside the spot is clipped, so only `visible` pixels of the
    // animal stick out past the cover's edge.
    if (side === 'top') return { left: (spotSize - animalSize) / 2, top: spotSize * 0.3 - visible };
    if (side === 'left') return { left: spotSize * 0.28 - visible, top: (spotSize - animalSize) / 2 + spotSize * 0.1 };
    return { left: spotSize * 0.72 - animalSize + visible, top: (spotSize - animalSize) / 2 + spotSize * 0.1 };
  };
  const coverBox = (side: Side) => {
    if (side === 'top') return { left: 0, top: spotSize * 0.3, width: spotSize, height: spotSize * 0.7 };
    if (side === 'left') return { left: spotSize * 0.28, top: 0, width: spotSize * 0.72, height: spotSize };
    return { left: 0, top: 0, width: spotSize * 0.72, height: spotSize };
  };

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8">
      {!started && (
        <StartOverlay label="Open the Zoo" hint="The animals are hiding! Find the one I name." onStart={start}>
          <div className="text-6xl" style={tintStyle(config, 'target')}>🦁🦓🦛</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <>
          <div className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-5 py-2">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Find</span>
            <span className="text-5xl leading-none" style={tintStyle(config, 'target')}>{wanted.emoji}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-4 px-4" style={{ maxWidth: spotSize * 3 + 64 }}>
            {spots.map((spot, i) => {
              const cover = coverBox(spot.side);
              const isWanted = spot.animal === wanted;
              return (
                <motion.button
                  key={`${round}-${i}`}
                  onClick={() => choose(spot, i)}
                  aria-label={`Hiding place ${i + 1}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={wrong === i ? { opacity: 1, y: 0, rotate: [-4, 4, -4, 4, 0] } : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="relative overflow-hidden rounded-2xl bg-black"
                  style={{ width: spotSize, height: spotSize }}
                >
                  <motion.span
                    className="absolute flex items-center justify-center leading-none"
                    style={{ ...placeAnimal(spot.side), width: animalSize, height: animalSize, fontSize: animalSize * 0.85, ...tintStyle(config, 'target') }}
                    animate={found && isWanted ? { y: -spotSize * 0.25, scale: 1.15 } : { y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 12 }}
                  >
                    {spot.animal.emoji}
                  </motion.span>
                  <motion.div
                    className="absolute"
                    style={cover}
                    animate={found && isWanted ? { opacity: 0.25 } : { opacity: 1 }}
                  >
                    <CoverShape cover={spot.cover} color={sceneColor(config, COVER_COLORS[spot.cover])} />
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
