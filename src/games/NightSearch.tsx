import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, tintStyle, shuffle, pick } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The police pup's night search: the park is dark, a toy is lost, and the
 * child slides a torch around to find it. Only what the torch lights up can
 * be tapped, so the whole park has to be searched on purpose: systematic
 * visual scanning, plus spotting a small shape among look-alikes. Toys shrink
 * after each find, and the torch is smaller on harder levels.
 */

const TOYS = [
  { emoji: '🧸', name: 'teddy bear' },
  { emoji: '⚽', name: 'ball' },
  { emoji: '🦴', name: 'bone' },
  { emoji: '🐱', name: 'kitten' },
  { emoji: '🔑', name: 'key' },
  { emoji: '🧢', name: 'cap' },
  { emoji: '🎾', name: 'tennis ball' },
  { emoji: '🥏', name: 'frisbee' },
  { emoji: '🐤', name: 'chick' },
  { emoji: '🍎', name: 'apple' },
] as const;

const LEVELS = {
  easy: { toys: 5, torch: 120, minSize: 30 },
  medium: { toys: 8, torch: 95, minSize: 22 },
  hard: { toys: 11, torch: 72, minSize: 16 },
} as const;

type Toy = (typeof TOYS)[number];
interface Placed { toy: Toy; x: number; y: number }

export const NightSearch = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'police');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [round, setRound] = useState(0);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [wanted, setWanted] = useState<Toy>(TOYS[0]);
  const [toySize, setToySize] = useState(Math.max(level.minSize, config.size * 1.2));
  const [torch, setTorch] = useState({ x: -999, y: -999 });
  const [found, setFound] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const torchRef = useRef(torch);

  // The torch starts in the middle of the park, so the child can see what it does.
  useEffect(() => {
    if (size.width > 0 && torchRef.current.x < 0) {
      torchRef.current = { x: size.width / 2, y: size.height * 0.55 };
      setTorch(torchRef.current);
    }
  }, [size.width, size.height]);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, rounds, onComplete);
  });

  const newRound = () => {
    const toys = shuffle(TOYS).slice(0, level.toys);
    const target = pick(toys);
    // Spread the toys over the park without piling them on top of each other.
    const spots: Placed[] = [];
    for (const toy of toys) {
      let x = 0, y = 0, guard = 0;
      do {
        x = 0.08 + Math.random() * 0.84;
        y = 0.22 + Math.random() * 0.62;
      } while (guard++ < 300 && spots.some(s => Math.hypot(s.x - x, (s.y - y) * 0.7) < 0.13));
      spots.push({ toy, x, y });
    }
    setPlaced(spots);
    setWanted(target);
    setFound(null);
    setRound(r => r + 1);
    speak(t(`Help {name} find the ${target.name}!`, { name }), config.voiceEnabled);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newRound();
  };

  const moveTorch = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    torchRef.current = p;
    setTorch(p);
  };

  const tapToy = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isPlaying || found !== null) return;
    const spot = placed[i];
    const px = spot.x * size.width, py = spot.y * size.height;
    const lit = Math.hypot(px - torchRef.current.x, py - torchRef.current.y) <= level.torch * 0.8;
    // Toys in the dark can't be seen, so they can't be picked: shine the torch first.
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    torchRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setTorch(torchRef.current);
    if (!lit) return;
    setRounds(r => r + 1);
    if (spot.toy === wanted) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setFound(i);
      setToySize(s => Math.max(level.minSize, s * 0.92));
      speak(t(`You found the ${wanted.name}! Good job!`), config.voiceEnabled);
      later(newRound, 1600);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(i);
      later(() => setWrong(null), 400);
      speak(t(`That's the ${spot.toy.name}. Keep looking!`), config.voiceEnabled);
    }
  };

  const r = level.torch;
  // Everything outside the torch beam stays pitch dark.
  const darkness = `radial-gradient(circle ${r}px at ${torch.x}px ${torch.y}px, transparent 0, transparent ${r * 0.72}px, black ${r}px)`;

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col overflow-hidden rounded-xl border-4 border-slate-800 bg-black">
      {!started && (
        <StartOverlay label={t('Grab the Torch')} hint={t("It's dark! Slide the torch around and help {name} find the lost toy.", { name })} onStart={start}>
          <RescuePup role="police" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <div className="relative z-20 mx-auto mt-3 flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 py-1.5 pl-2 pr-5">
          <RescuePup role="police" size={52} style={tintStyle(config, 'target')} />
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('Find')}</span>
          <span className="text-4xl leading-none" style={tintStyle(config, 'target')}>{wanted.emoji}</span>
        </div>
      )}

      <div
        ref={areaRef}
        className="absolute inset-0 touch-none"
        onPointerDown={started ? moveTorch : undefined}
        onPointerMove={started ? moveTorch : undefined}
      >
        {started && size.width > 0 && (
          <>
            {/* The park: trees and bushes (scenery). */}
            {[0.1, 0.32, 0.55, 0.78, 0.94].map((x, i) => (
              <span
                key={i}
                className="pointer-events-none absolute leading-none"
                style={{ left: `${x * 100}%`, top: `${i % 2 ? 58 : 30}%`, fontSize: 70, opacity: 0.8, transform: 'translate(-50%, -50%)', ...tintStyle(config, 'scene') }}
              >
                {i % 2 ? '🌳' : '🌲'}
              </span>
            ))}
            {placed.map((spot, i) => (
              <motion.button
                key={`${round}-${i}`}
                onPointerDown={tapToy(i)}
                aria-label={t(spot.toy.name)}
                className="absolute flex items-center justify-center leading-none"
                style={{
                  left: spot.x * size.width - Math.max(44, toySize) / 2,
                  top: spot.y * size.height - Math.max(44, toySize) / 2,
                  width: Math.max(44, toySize), height: Math.max(44, toySize),
                  fontSize: toySize,
                  ...tintStyle(config, 'target'),
                }}
                animate={found === i ? { scale: [1, 1.6, 1.3], y: -20 } : wrong === i ? { x: [-6, 6, -6, 6, 0] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                {spot.toy.emoji}
              </motion.button>
            ))}
            {/* The torch beam itself: a soft warm glow where the light falls. */}
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                left: torch.x - r, top: torch.y - r, width: r * 2, height: r * 2,
                background: `radial-gradient(circle, ${config.anaglyphMode ? 'rgba(0,0,0,0)' : 'rgba(253,230,138,0.16)'} 0%, transparent 70%)`,
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: '#000', WebkitMaskImage: darkness, maskImage: darkness, opacity: found !== null ? 0 : 1, transition: 'opacity 0.4s' }}
            />
          </>
        )}
      </div>
    </div>
  );
};
