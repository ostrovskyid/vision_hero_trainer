import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Plane, Rocket, Train, Bus, Truck, Bike, Ship,
  Trophy, Play, Settings, ChevronLeft, Volume2, VolumeX, Eye, Maximize, Minimize,
  Radar, CloudFog, ShieldAlert, Crosshair, Target,
  TrainFront, MapPin, Route, TramFront, Brain, Palette, ArrowLeftRight, RotateCcw,
  Shapes, Dog, Clapperboard, Mic, MicOff, Sticker,
  Hash, PenLine, TreePalm, Warehouse, Droplets, ScanSearch
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GameMode, GameConfig, UserProfile, GameStats, PatchRecord } from './types';
import {
  DEFAULT_CONFIG, AVATARS, DIFFICULTY_PRESETS, STICKERS, PATCH_STICKERS,
  ANAGLYPH_PRESETS, ANAGLYPH_TARGET_DEFAULT, ANAGLYPH_SCENE_DEFAULT,
} from './constants';
import { GamePreview } from './GamePreview';
import { GameHud } from './GameHud';
import { PatchPalBar, PatchPalScreen, PatchPrompt, todayPatchMinutes } from './PatchPal';
import { PictureCheckScreen, toDecimal } from './PictureCheck';
import { buildBackup, saveBackupFile, parseBackup, daysSince, BackupFile } from './backup';
import { PHASES, PATCH_PHASES, COMFORT_ZONE_GUTTER, phaseInfo, dayKey, runningMinutes } from './therapy';
import { ShapeGarage } from './games/ShapeGarage';
import { PopOutPups } from './games/PopOutPups';
import { CartoonCinema } from './games/CartoonCinema';
import { CountCarriages } from './games/CountCarriages';
import { RocketDots } from './games/RocketDots';
import { ZooHideSeek } from './games/ZooHideSeek';
import { BusDriver } from './games/BusDriver';
import { HangarMatch } from './games/HangarMatch';
import { CarWash } from './games/CarWash';
import { SpotDifference } from './games/SpotDifference';
import { AnaglyphFilters } from './games/common';
import { scaleColor, withAlpha, playSound, speak, stopSpeaking } from './feedback';

/**
 * The home screen tiles. Colour classes are spelled out in full because
 * Tailwind compiles class names ahead of time and cannot build them from
 * variables.
 */
const GAME_TILES: {
  mode: GameMode;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  chipClass: string;
  hoverClass: string;
  barClass: string;
  /** Only makes sense with red/cyan glasses, so hidden when anaglyph mode is off. */
  requiresAnaglyph?: boolean;
}[] = [
  { mode: 'tracking', title: 'Rocket Tracker', description: 'Follow the flying rocket.', Icon: Rocket, iconClass: 'text-blue-400', chipClass: 'bg-blue-500/10', hoverClass: 'hover:border-blue-500/60', barClass: 'bg-blue-500' },
  { mode: 'contrast', title: 'Foggy Flight', description: 'Find planes in the fog.', Icon: Plane, iconClass: 'text-purple-400', chipClass: 'bg-purple-500/10', hoverClass: 'hover:border-purple-500/60', barClass: 'bg-purple-500' },
  { mode: 'detail', title: 'Traffic Jam', description: 'Spot the odd one out.', Icon: Car, iconClass: 'text-orange-400', chipClass: 'bg-orange-500/10', hoverClass: 'hover:border-orange-500/60', barClass: 'bg-orange-500' },
  { mode: 'saccades', title: 'Speedway Saccades', description: 'Catch the jumping car.', Icon: Train, iconClass: 'text-red-400', chipClass: 'bg-red-500/10', hoverClass: 'hover:border-red-500/60', barClass: 'bg-red-500' },
  { mode: 'peripheral', title: 'Peripheral Patrol', description: 'Catch targets at the edges.', Icon: Radar, iconClass: 'text-green-400', chipClass: 'bg-green-500/10', hoverClass: 'hover:border-green-500/60', barClass: 'bg-green-500' },
  { mode: 'spotter', title: 'Foggy Spotter', description: 'Find the faded shape.', Icon: CloudFog, iconClass: 'text-yellow-400', chipClass: 'bg-yellow-500/10', hoverClass: 'hover:border-yellow-500/60', barClass: 'bg-yellow-500' },
  { mode: 'checkpoint', title: 'Checkpoint', description: 'Tap the matching vehicle.', Icon: ShieldAlert, iconClass: 'text-cyan-400', chipClass: 'bg-cyan-500/10', hoverClass: 'hover:border-cyan-500/60', barClass: 'bg-cyan-500' },
  { mode: 'metro', title: 'Metro Tracker', description: 'Follow the metro train.', Icon: TrainFront, iconClass: 'text-rose-400', chipClass: 'bg-rose-500/10', hoverClass: 'hover:border-rose-500/60', barClass: 'bg-rose-500' },
  { mode: 'station', title: 'Station Hunt', description: 'Find the right station letter.', Icon: MapPin, iconClass: 'text-emerald-400', chipClass: 'bg-emerald-500/10', hoverClass: 'hover:border-emerald-500/60', barClass: 'bg-emerald-500' },
  { mode: 'navigator', title: 'Line Navigator', description: 'Trace the line to its stop.', Icon: Route, iconClass: 'text-indigo-400', chipClass: 'bg-indigo-500/10', hoverClass: 'hover:border-indigo-500/60', barClass: 'bg-indigo-500' },
  { mode: 'crossing', title: 'Railway Crossing', description: 'Tap trains, skip the cars.', Icon: TramFront, iconClass: 'text-sky-400', chipClass: 'bg-sky-500/10', hoverClass: 'hover:border-sky-500/60', barClass: 'bg-sky-500' },
  { mode: 'memory', title: 'Metro Memory', description: 'Repeat the lit-up route.', Icon: Brain, iconClass: 'text-fuchsia-400', chipClass: 'bg-fuchsia-500/10', hoverClass: 'hover:border-fuchsia-500/60', barClass: 'bg-fuchsia-500' },
  { mode: 'shapes', title: 'Shape Garage', description: 'Find the wheel with the same shape.', Icon: Shapes, iconClass: 'text-amber-400', chipClass: 'bg-amber-500/10', hoverClass: 'hover:border-amber-500/60', barClass: 'bg-amber-500' },
  { mode: 'popout', title: 'Pop-Out Pups', description: 'Tap the pup that floats out.', Icon: Dog, iconClass: 'text-pink-400', chipClass: 'bg-pink-500/10', hoverClass: 'hover:border-pink-500/60', barClass: 'bg-pink-500', requiresAnaglyph: true },
  { mode: 'cinema', title: 'Cartoon Cinema', description: 'Watch the show, tap the stars.', Icon: Clapperboard, iconClass: 'text-teal-400', chipClass: 'bg-teal-500/10', hoverClass: 'hover:border-teal-500/60', barClass: 'bg-teal-500' },
  { mode: 'carriages', title: 'Count the Carriages', description: 'How many carriages went by?', Icon: Hash, iconClass: 'text-red-400', chipClass: 'bg-red-500/10', hoverClass: 'hover:border-red-500/60', barClass: 'bg-red-500' },
  { mode: 'dots', title: 'Rocket Dot-to-Dot', description: 'Join 1, 2, 3… and blast off.', Icon: PenLine, iconClass: 'text-sky-400', chipClass: 'bg-sky-500/10', hoverClass: 'hover:border-sky-500/60', barClass: 'bg-sky-500' },
  { mode: 'zoo', title: 'Zoo Hide & Seek', description: 'Find the hiding animal.', Icon: TreePalm, iconClass: 'text-lime-400', chipClass: 'bg-lime-500/10', hoverClass: 'hover:border-lime-500/60', barClass: 'bg-lime-500' },
  { mode: 'bus', title: 'Bus Driver', description: 'Drive the bus, pick everyone up.', Icon: Bus, iconClass: 'text-yellow-400', chipClass: 'bg-yellow-500/10', hoverClass: 'hover:border-yellow-500/60', barClass: 'bg-yellow-500' },
  { mode: 'hangar', title: 'Hangar Match', description: 'Park each plane by its shadow.', Icon: Warehouse, iconClass: 'text-violet-400', chipClass: 'bg-violet-500/10', hoverClass: 'hover:border-violet-500/60', barClass: 'bg-violet-500' },
  { mode: 'carwash', title: 'Car Wash', description: 'Rub off every mud spot.', Icon: Droplets, iconClass: 'text-cyan-400', chipClass: 'bg-cyan-500/10', hoverClass: 'hover:border-cyan-500/60', barClass: 'bg-cyan-500' },
  { mode: 'differences', title: 'Spot the Difference', description: 'What changed in the zoo?', Icon: ScanSearch, iconClass: 'text-orange-400', chipClass: 'bg-orange-500/10', hoverClass: 'hover:border-orange-500/60', barClass: 'bg-orange-500' },
];

const ALL_MODES = GAME_TILES.map(t => t.mode);

/** The skill badge shown above each exercise. */
const SKILL_LABELS: Record<GameMode, string> = {
  tracking: 'Tracking Exercise',
  contrast: 'Contrast Training',
  detail: 'Detail Focus',
  saccades: 'Saccadic Movement',
  peripheral: 'Peripheral Awareness',
  spotter: 'Contrast Sensitivity',
  checkpoint: 'Visual Discrimination',
  metro: 'Smooth Pursuit',
  station: 'Acuity & Crowding',
  navigator: 'Visual Tracing',
  crossing: 'Pursuit & Attention',
  memory: 'Visual Memory',
  shapes: 'Acuity & Crowding',
  popout: '3D Depth',
  cinema: 'Dichoptic Viewing',
  carriages: 'Visual Span & Counting',
  dots: 'Eye-Hand Coordination',
  zoo: 'Visual Closure',
  bus: 'Eye-Hand Pursuit',
  hangar: 'Shape Discrimination',
  carwash: 'Visual Scanning',
  differences: 'Visual Comparison',
};

/**
 * Read aloud when an exercise opens, so a child who cannot read yet still
 * knows what to do. Kept short and concrete.
 */
const GAME_INSTRUCTIONS: Record<GameMode, string> = {
  tracking: 'Follow the rocket and tap it!',
  contrast: 'Find the planes hiding in the fog!',
  detail: 'One vehicle is different. Can you find it?',
  saccades: 'Catch the car when it jumps!',
  peripheral: 'Look at the middle. Tap the things at the edges!',
  spotter: 'Find the cloud that is lighter!',
  checkpoint: 'Tap only the vehicle that matches!',
  metro: 'Follow the metro train and tap it!',
  station: 'Find the station letter!',
  navigator: 'Follow the line with your eyes!',
  crossing: 'Tap the trains. Let the cars go by!',
  memory: 'Watch the stations light up, then tap them in order!',
  shapes: 'Find the wheel with the same shape!',
  popout: 'Put on your 3D glasses. Tap the pup that floats out!',
  cinema: 'Watch the cartoon and tap the stars!',
  carriages: 'Watch the train and count the carriages!',
  dots: 'Slide your finger from one to two to three!',
  zoo: 'The animals are hiding. Can you find them?',
  bus: 'Put your finger on the bus and drive it along the road!',
  hangar: 'Drag each plane into the hangar with its shadow!',
  carwash: 'Rub off all the mud!',
  differences: 'The two pictures are nearly the same. Find what is different!',
};

/** Local calendar day, so the daily mission resets at the child's midnight. */
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Today's mission: two active games the child has played least recently,
 * then Cartoon Cinema to wind down. Ties are broken by a seed from the date,
 * so the choice stays the same all day and rotates from one day to the next.
 */
const pickMission = (user: UserProfile, anaglyph: boolean): GameMode[] => {
  const day = todayKey();
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const lastPlayed = (mode: GameMode) => user.stats[mode].slice(-1)[0]?.date ?? '';
  const candidates = GAME_TILES
    .filter(t => t.mode !== 'cinema' && (anaglyph || !t.requiresAnaglyph))
    .map((t, i) => ({ mode: t.mode, last: lastPlayed(t.mode), tie: ((seed + i * 2654435761) >>> 0) % 997 }))
    .sort((a, b) => (a.last < b.last ? -1 : a.last > b.last ? 1 : a.tie - b.tie));
  return [candidates[0].mode, candidates[1].mode, 'cinema'];
};

const CONFIG_STORAGE_KEY = 'eyequest_config';
const DISPLAY_STORAGE_KEY = 'eyequest_display';

const RocketTracker = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const [shake, setShake] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const moveTarget = () => {
    const time = Date.now() / 1000;
    // Use speed to control the frequency of movement
    let speedFactor = config.speed * 0.4;
    
    // Hard mode: add erratic frequency shifts
    if (config.difficulty === 'hard') {
      speedFactor *= (1 + Math.sin(time * 2) * 0.3);
    }
    
    // Lissajous curve provides a more complex "full area" coverage than a simple circle
    // Using 42 as radius to keep target within 8-92% range (avoiding edges)
    const x = 50 + Math.cos(time * speedFactor) * 42;
    const y = 50 + Math.sin(time * speedFactor * 0.8) * 42;
    
    setTargetPos({ x, y });
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 0.016));
        moveTarget();
      }, 16); // 60fps for smooth movement
    } else if (timeLeft <= 0 && isPlaying) {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / config.duration, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, timeLeft]);

  const handleHit = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!isPlaying) return;
    playSound('hit', config.soundEnabled);
    setScore((s) => s + 1);
  };

  const handleMiss = () => {
    if (!isPlaying) return;
    playSound('miss', config.soundEnabled);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setScore(s => Math.max(0, s - 1));
  };

  return (
    <motion.div 
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800 cursor-crosshair"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
      onPointerDown={handleMiss}
    >
      {!isPlaying && Math.ceil(timeLeft) === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50" onPointerDown={(e) => e.stopPropagation()}>
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Mission
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <AnimatePresence>
        {isPlaying && (
          <motion.div
            key="target"
            animate={{ left: `${targetPos.x}%`, top: `${targetPos.y}%`, rotate: Date.now() / 10 }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ width: config.size, height: config.size }}
            onPointerDown={handleHit}
          >
            <Rocket className={`w-full h-full ${config.anaglyphMode ? 'text-[var(--ag-target)] fill-[var(--ag-target)] drop-shadow-[0_0_15px_var(--ag-glow)]' : 'text-blue-400 fill-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]'}`} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{ width: Math.random() * 3, height: Math.random() * 3, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, backgroundColor: config.anaglyphMode ? config.anaglyphScene : '#FFFFFF' }} />
        ))}
      </div>
    </motion.div>
  );
};

const FoggyFlight = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [target, setTarget] = useState<{ x: number; y: number; rotation: number; scale: number; icon: any } | null>(null);
  const [currentContrast, setCurrentContrast] = useState(config.contrast);
  const [shake, setShake] = useState(false);

  const spawnTarget = () => {
    const flyingIcons = [Plane, Rocket];
    // Hard mode: start with lower contrast
    if (config.difficulty === 'hard' && score === 0) {
      setCurrentContrast(40);
    }
    setTarget({ 
      x: Math.random() * 80 + 10, 
      y: Math.random() * 80 + 10,
      rotation: Math.random() * 360,
      scale: 0.7 + Math.random() * 0.6,
      icon: flyingIcons[Math.floor(Math.random() * flyingIcons.length)]
    });
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      if (!target) spawnTarget();
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / 10, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
  }, [isPlaying, timeLeft, target]);

  const handleHit = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('hit', config.soundEnabled);
    setScore((s) => s + 1);
    setCurrentContrast((c) => Math.max(5, c - 5));
    spawnTarget();
  };

  const handleMiss = () => {
    if (!isPlaying) return;
    playSound('miss', config.soundEnabled);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setScore(s => Math.max(0, s - 1));
  };

  return (
    <motion.div 
      // A light grey field would be seen equally by both eyes and destroy the
      // dichoptic separation, so anaglyph mode keeps the ground dark.
      className={`relative w-full h-full min-h-[420px] ${config.anaglyphMode ? 'bg-slate-950' : 'bg-slate-400'} rounded-xl overflow-hidden border-4 border-slate-800`}
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
      onClick={handleMiss}
    >
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50" onClick={(e) => e.stopPropagation()}>
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Flight
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div className={`absolute inset-0 ${config.anaglyphMode ? 'bg-[var(--ag-scene-30)]' : 'bg-slate-300/50 backdrop-blur-sm'}`} />

      {target && isPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: currentContrast / 100, rotate: target.rotation, scale: target.scale }}
          className="absolute cursor-pointer -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${target.x}%`, top: `${target.y}%`, width: config.size, height: config.size }}
          onClick={handleHit}
        >
          <target.icon className={`w-full h-full ${config.anaglyphMode ? 'text-[var(--ag-target)]' : 'text-slate-600'}`} />
        </motion.div>
      )}
    </motion.div>
  );
};

const TrafficJam = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [grid, setGrid] = useState<{ icon: any; isOdd: boolean }[]>([]);
  const [shake, setShake] = useState(false);
  const icons = [Car, Plane, Rocket, Train, Bus, Truck, Bike, Ship];

  const generateGrid = () => {
    const size = config.difficulty === 'hard' ? 25 : 16; 
    const cols = config.difficulty === 'hard' ? 5 : 4;
    const mainIcon = icons[Math.floor(Math.random() * icons.length)];
    let oddIcon = icons[Math.floor(Math.random() * icons.length)];
    while (oddIcon === mainIcon) oddIcon = icons[Math.floor(Math.random() * icons.length)];

    const newGrid = Array(size).fill(null).map(() => ({ icon: mainIcon, isOdd: false }));
    const oddIndex = Math.floor(Math.random() * size);
    newGrid[oddIndex] = { icon: oddIcon, isOdd: true };
    setGrid(newGrid);
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      if (grid.length === 0) generateGrid();
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / 10, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
  }, [isPlaying, timeLeft, grid]);

  const handleChoice = (isOdd: boolean) => {
    if (isOdd) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      generateGrid();
    } else {
      playSound('miss', config.soundEnabled);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setScore(s => Math.max(0, s - 1));
    }
  };

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800 flex items-center justify-center">
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Traffic Jam
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <motion.div 
        className={`grid ${config.difficulty === 'hard' ? 'grid-cols-5' : 'grid-cols-4'} gap-8 p-8`}
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {grid.map((item, i) => (
          <motion.button
            key={`${i}-${score}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleChoice(item.isOdd)}
            className={`${config.difficulty === 'hard' ? 'w-20 h-20 md:w-24 md:h-24' : 'w-24 h-24 md:w-32 md:h-32'} rounded-2xl flex items-center justify-center transition-colors ${config.anaglyphMode ? 'bg-[var(--ag-scene-20)] hover:bg-[var(--ag-scene-30)]' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <item.icon className={`${config.difficulty === 'hard' ? 'w-10 h-10 md:w-12 md:h-12' : 'w-12 h-12 md:w-16 md:h-16'} ${config.anaglyphMode ? 'text-[var(--ag-target)]' : 'text-orange-400'}`} />
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

const SpeedwaySaccades = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetPos, setTargetPos] = useState({ x: 10, y: 50, color: 'text-green-400', scale: 1 });
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / config.duration, date: new Date().toISOString() });
      confetti({ particleCount: 150, spread: 100 });
    }
  }, [isPlaying, timeLeft]);

  const handleHit = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('hit', config.soundEnabled);
    setScore(s => s + 1);
    const colors = ['text-green-400', 'text-blue-400', 'text-red-400', 'text-yellow-400', 'text-purple-400', 'text-orange-400', 'text-pink-400'];
    setTargetPos(prev => ({
      x: prev.x < 50 ? 80 + Math.random() * 10 : 10 + Math.random() * 10,
      y: 20 + Math.random() * 60,
      color: colors[Math.floor(Math.random() * colors.length)],
      scale: 0.7 + Math.random() * 0.6
    }));
  };

  const handleMiss = () => {
    if (!isPlaying) return;
    playSound('miss', config.soundEnabled);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setScore(s => Math.max(0, s - 1));
  };

  return (
    <motion.div 
      className="relative w-full h-full min-h-[420px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
      onClick={handleMiss}
    >
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50" onClick={(e) => e.stopPropagation()}>
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Speedway
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {isPlaying && (
        <motion.div
          className="absolute cursor-pointer -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%`, width: config.size, height: config.size }}
          animate={{ scale: targetPos.scale }}
          onClick={handleHit}
        >
          <Car className={`w-full h-full ${config.anaglyphMode ? 'text-[var(--ag-target)]' : targetPos.color}`} />
        </motion.div>
      )}
    </motion.div>
  );
};

const PeripheralPatrol = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetPos, setTargetPos] = useState({ x: 10, y: 10 });
  const [shake, setShake] = useState(false);

  const spawnTarget = () => {
    const isTopBottom = Math.random() > 0.5;
    let x, y;
    if (isTopBottom) {
      x = Math.random() * 80 + 10;
      y = Math.random() > 0.5 ? Math.random() * 10 + 5 : Math.random() * 10 + 85;
    } else {
      y = Math.random() * 80 + 10;
      x = Math.random() > 0.5 ? Math.random() * 10 + 5 : Math.random() * 10 + 85;
    }
    setTargetPos({ x, y });
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      if (score === 0 && timeLeft === config.duration) spawnTarget();
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / config.duration, date: new Date().toISOString() });
      confetti({ particleCount: 150, spread: 100 });
    }
  }, [isPlaying, timeLeft]);

  const handleHit = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('hit', config.soundEnabled);
    setScore(s => s + 1);
    spawnTarget();
  };

  const handleMiss = () => {
    if (!isPlaying) return;
    playSound('miss', config.soundEnabled);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setScore(s => Math.max(0, s - 1));
  };

  return (
    <motion.div 
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800 cursor-crosshair"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
      onClick={handleMiss}
    >
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Patrol
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50">
        <Crosshair className="w-16 h-16 text-blue-500 animate-pulse" />
      </div>

      {isPlaying && (
        <motion.div
          className="absolute cursor-pointer -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%`, width: config.size, height: config.size }}
          onClick={handleHit}
        >
          <Radar className={`w-full h-full ${config.anaglyphMode ? 'text-[var(--ag-target)]' : 'text-green-400'}`} />
        </motion.div>
      )}
    </motion.div>
  );
};

const FoggySpotter = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [grid, setGrid] = useState<{ isTarget: boolean }[]>([]);
  const [shake, setShake] = useState(false);

  const generateGrid = () => {
    const size = config.difficulty === 'hard' ? 25 : 16; 
    const newGrid = Array(size).fill(null).map(() => ({ isTarget: false }));
    const targetIndex = Math.floor(Math.random() * size);
    newGrid[targetIndex] = { isTarget: true };
    setGrid(newGrid);
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      if (grid.length === 0) generateGrid();
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / 10, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 } });
    }
  }, [isPlaying, timeLeft, grid]);

  const handleChoice = (isTarget: boolean) => {
    if (isTarget) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      generateGrid();
    } else {
      playSound('miss', config.soundEnabled);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setScore(s => Math.max(0, s - 1));
    }
  };

  const cols = config.difficulty === 'hard' ? 'grid-cols-5' : 'grid-cols-4';
  const targetOpacity = config.difficulty === 'hard' ? 'opacity-70' : (config.difficulty === 'medium' ? 'opacity-50' : 'opacity-30');

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800 flex items-center justify-center">
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Spotter
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <motion.div 
        className={`grid ${cols} gap-8 p-8`}
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {grid.map((item, i) => (
          <motion.button
            key={`${i}-${score}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleChoice(item.isTarget)}
            className={`${config.difficulty === 'hard' ? 'w-20 h-20 md:w-24 md:h-24' : 'w-24 h-24 md:w-32 md:h-32'} rounded-2xl flex items-center justify-center transition-colors ${config.anaglyphMode ? 'bg-[var(--ag-scene-20)] hover:bg-[var(--ag-scene-30)]' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <CloudFog className={`${config.difficulty === 'hard' ? 'w-10 h-10 md:w-12 md:h-12' : 'w-12 h-12 md:w-16 md:h-16'} ${config.anaglyphMode ? 'text-[var(--ag-target)]' : 'text-yellow-400'} ${item.isTarget ? targetOpacity : 'opacity-100'}`} />
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

const Checkpoint = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shake, setShake] = useState(false);
  const icons = [Car, Plane, Rocket, Train, Bus, Truck, Bike, Ship];
  
  const [targetIcon, setTargetIcon] = useState<any>(null);
  const [currentIcon, setCurrentIcon] = useState<any>(null);
  const [isTarget, setIsTarget] = useState(false);
  const [turn, setTurn] = useState(0);

  const spawnNext = (keepTarget: boolean = true) => {
    const tIcon = (keepTarget && targetIcon) ? targetIcon : icons[Math.floor(Math.random() * icons.length)];
    
    // 50% chance to be the target
    const isT = Math.random() > 0.5;
    
    let cIcon;
    if (isT) {
      cIcon = tIcon;
    } else {
      cIcon = icons[Math.floor(Math.random() * icons.length)];
      // Ensure it's definitely NOT the target if isT is false
      while (cIcon === tIcon) {
        cIcon = icons[Math.floor(Math.random() * icons.length)];
      }
    }
    
    setTargetIcon(() => tIcon);
    setCurrentIcon(() => cIcon);
    setIsTarget(isT);
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / config.duration, date: new Date().toISOString() });
      confetti({ particleCount: 150, spread: 100 });
    }
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    if (!isPlaying || timeLeft === 0) return;

    if (!targetIcon) {
      spawnNext(false);
      return;
    }

    const speedMs = config.difficulty === 'hard' ? 2000 : (config.difficulty === 'medium' ? 3000 : 4500);
    
    const timeout = setTimeout(() => {
      // If they missed a target, penalize
      if (isTarget) {
        playSound('miss', config.soundEnabled);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setScore(s => Math.max(0, s - 1));
      }
      spawnNext(true);
      setTurn(t => t + 1);
    }, speedMs);

    return () => clearTimeout(timeout);
  }, [isPlaying, turn, targetIcon, isTarget]);

  const handleAction = (clicked: boolean) => {
    if (!isPlaying) return;
    
    if (clicked && isTarget) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      spawnNext(true);
      setTurn(t => t + 1);
    } else if (clicked && !isTarget) {
      playSound('miss', config.soundEnabled);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setScore(s => Math.max(0, s - 1));
      spawnNext(true);
      setTurn(t => t + 1);
    }
  };

  return (
    <motion.div 
      className="relative w-full h-full min-h-[420px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800 flex flex-col items-center justify-center"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Checkpoint
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {isPlaying && targetIcon && currentIcon && (
        <div className="flex flex-col items-center gap-12">
          <div className="flex flex-col items-center gap-2 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <span className="text-sm text-slate-400 uppercase tracking-wider font-bold">Target Vehicle</span>
            {React.createElement(targetIcon, { className: `w-12 h-12 ${config.anaglyphMode ? 'text-[var(--ag-target)]' : 'text-blue-400'}` })}
          </div>

          <div className="flex flex-col items-center gap-8">
            <motion.button
              key={`turn-${turn}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAction(true)}
              className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 hover:border-blue-500 transition-colors"
            >
              {React.createElement(currentIcon, { className: `w-16 h-16 ${config.anaglyphMode ? 'text-[var(--ag-target)]' : 'text-slate-100'}` })}
            </motion.button>
            <span className="text-slate-400">Tap if it matches the target!</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Metro line colors inspired by classic metro map design
const METRO_COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6'];

// A winding metro line with wide horizontal sweeps to encourage
// full left-right eye excursions (smooth pursuit into abduction)
const METRO_PATH = 'M 6 15 L 50 15 L 70 30 L 20 45 L 80 60 L 30 75 L 60 85 L 94 85';
const STATION_FRACTIONS = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1];

const MetroTracker = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trainPos, setTrainPos] = useState({ x: 6, y: 15 });
  const [trainDist, setTrainDist] = useState(0);
  const [stations, setStations] = useState<{ x: number; y: number; dist: number }[]>([]);
  const [shake, setShake] = useState(false);
  const pathRef = useRef<SVGPathElement | null>(null);
  const distRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    setStations(STATION_FRACTIONS.map(f => {
      const p = path.getPointAtLength(f * total);
      return { x: p.x, y: p.y, dist: f * total };
    }));
  }, []);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 0.016));
        const path = pathRef.current;
        if (!path) return;
        const total = path.getTotalLength();
        // Deliberately slow: young children need a target the eye can
        // comfortably lock onto. Speed 5 ≈ one full sweep in ~12s.
        let unitsPerTick = config.speed * 0.08;
        // Hard mode: erratic speed shifts, like a train braking and accelerating
        if (config.difficulty === 'hard') {
          unitsPerTick *= (1 + Math.sin(Date.now() / 500) * 0.4);
        }
        distRef.current += unitsPerTick;
        // Ping-pong along the line so the train sweeps back and forth
        const cycle = distRef.current % (total * 2);
        const dist = cycle < total ? cycle : total * 2 - cycle;
        const p = path.getPointAtLength(dist);
        setTrainPos({ x: p.x, y: p.y });
        setTrainDist(dist);
      }, 16);
    } else if (timeLeft <= 0 && isPlaying) {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / config.duration, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, timeLeft]);

  const handleHit = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!isPlaying) return;
    playSound('hit', config.soundEnabled);
    setScore((s) => s + 1);
  };

  const handleMiss = () => {
    if (!isPlaying) return;
    playSound('miss', config.soundEnabled);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setScore(s => Math.max(0, s - 1));
  };

  const lineColor = config.anaglyphMode ? config.anaglyphScene : '#eab308';

  return (
    <motion.div
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800 cursor-crosshair"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
      onPointerDown={handleMiss}
    >
      {!isPlaying && Math.ceil(timeLeft) === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50" onPointerDown={(e) => e.stopPropagation()}>
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Depart Station
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path ref={pathRef} d={METRO_PATH} fill="none" stroke={lineColor} strokeOpacity={0.35} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      {stations.map((st, i) => {
        const active = Math.abs(trainDist - st.dist) < 6;
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 pointer-events-none transition-all duration-200"
            style={{
              left: `${st.x}%`, top: `${st.y}%`,
              width: active ? 20 : 14, height: active ? 20 : 14,
              borderColor: lineColor,
              backgroundColor: active ? lineColor : '#0f172a',
              boxShadow: active ? `0 0 12px ${lineColor}` : 'none'
            }}
          />
        );
      })}

      {isPlaying && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${trainPos.x}%`, top: `${trainPos.y}%`, width: config.size, height: config.size }}
          onPointerDown={handleHit}
        >
          <TrainFront className={`w-full h-full ${config.anaglyphMode ? 'text-[var(--ag-target)] fill-[var(--ag-target)] drop-shadow-[0_0_15px_var(--ag-glow)]' : 'text-red-400 fill-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.8)]'}`} />
        </div>
      )}
    </motion.div>
  );
};

// Groups of visually similar letters make the search harder,
// training fine acuity under crowding conditions
const LETTER_GROUPS = [
  ['E', 'F', 'H', 'L', 'T', 'I'],
  ['O', 'Q', 'C', 'G', 'D'],
  ['M', 'N', 'W', 'V', 'K'],
  ['B', 'R', 'P', 'S', 'E'],
];

const StationHunt = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [grid, setGrid] = useState<{ letter: string; color: string; isTarget: boolean }[]>([]);
  const [targetLetter, setTargetLetter] = useState('E');
  const [shake, setShake] = useState(false);

  const generateGrid = () => {
    const group = LETTER_GROUPS[Math.floor(Math.random() * LETTER_GROUPS.length)];
    const target = group[Math.floor(Math.random() * group.length)];
    const distractors = group.filter(l => l !== target);
    const size = config.difficulty === 'hard' ? 25 : 16;
    const newGrid = Array(size).fill(null).map(() => ({
      letter: distractors[Math.floor(Math.random() * distractors.length)],
      color: METRO_COLORS[Math.floor(Math.random() * METRO_COLORS.length)],
      isTarget: false
    }));
    const targetIndex = Math.floor(Math.random() * size);
    newGrid[targetIndex] = { letter: target, color: METRO_COLORS[Math.floor(Math.random() * METRO_COLORS.length)], isTarget: true };
    setTargetLetter(target);
    setGrid(newGrid);
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      if (grid.length === 0) generateGrid();
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / 10, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
  }, [isPlaying, timeLeft, grid]);

  const handleChoice = (isTarget: boolean) => {
    if (isTarget) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      generateGrid();
    } else {
      playSound('miss', config.soundEnabled);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setScore(s => Math.max(0, s - 1));
    }
  };

  const letterSize = config.difficulty === 'hard' ? 'text-xs md:text-sm' : (config.difficulty === 'medium' ? 'text-base md:text-lg' : 'text-xl md:text-2xl');
  const cellSize = config.difficulty === 'hard' ? 'w-12 h-12 md:w-16 md:h-16' : 'w-14 h-14 md:w-20 md:h-20';

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800 flex flex-col items-center justify-center">
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Start Station Hunt
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {isPlaying && (
        <div className="flex items-center gap-3 mb-6 bg-slate-800 px-6 py-3 rounded-full border border-slate-700">
          <span className="text-sm text-slate-400 uppercase tracking-wider font-bold">Find station</span>
          <div
            className={`w-10 h-10 rounded-full border-4 flex items-center justify-center font-bold text-lg ${config.anaglyphMode ? 'bg-black text-[var(--ag-target)]' : 'bg-slate-50 text-slate-900'}`}
            style={{ borderColor: config.anaglyphMode ? config.anaglyphTarget : '#3b82f6' }}
          >
            {targetLetter}
          </div>
        </div>
      )}

      <motion.div
        className={`grid ${config.difficulty === 'hard' ? 'grid-cols-5' : 'grid-cols-4'} gap-3 md:gap-4 p-4`}
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {grid.map((item, i) => (
          <motion.button
            key={`${i}-${score}-${targetLetter}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleChoice(item.isTarget)}
            className={`${cellSize} rounded-full flex items-center justify-center font-bold border-4 transition-colors ${config.anaglyphMode ? 'bg-black text-[var(--ag-target)]' : 'bg-slate-50 text-slate-900'}`}
            style={{ borderColor: config.anaglyphMode ? config.anaglyphScene : item.color }}
          >
            <span className={letterSize}>{item.letter}</span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

interface NavigatorPuzzle {
  lines: { color: string; path: string; label: string }[];
  endOrder: number[]; // endOrder[lineIndex] = terminal slot index
  targetLine: number;
  terminals: { x: number; y: number; label: string }[];
}

const TERMINAL_LABELS = ['A', 'B', 'C', 'D'];

const LineNavigator = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [puzzle, setPuzzle] = useState<NavigatorPuzzle | null>(null);
  const [shake, setShake] = useState(false);

  const generatePuzzle = () => {
    const numLines = config.difficulty === 'hard' ? 4 : 3;
    const startYs = Array(numLines).fill(0).map((_, i) => 20 + (60 / (numLines - 1)) * i);
    const endYs = [...startYs];
    // Shuffle terminals until at least one line crosses another
    let order = startYs.map((_, i) => i);
    do {
      order = order.sort(() => Math.random() - 0.5).slice();
    } while (order.every((v, i) => v === i));

    const lines = startYs.map((sy, i) => {
      const ey = endYs[order[i]];
      const c1y = 10 + Math.random() * 80;
      const c2y = 10 + Math.random() * 80;
      return {
        color: METRO_COLORS[i],
        label: `M${i + 1}`,
        path: `M 8 ${sy} C 35 ${c1y}, 65 ${c2y}, 90 ${ey}`
      };
    });

    setPuzzle({
      lines,
      endOrder: order,
      targetLine: Math.floor(Math.random() * numLines),
      terminals: endYs.map((y, i) => ({ x: 90, y, label: TERMINAL_LABELS[i] }))
    });
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      if (!puzzle) generatePuzzle();
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / 10, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
  }, [isPlaying, timeLeft, puzzle]);

  const handleChoice = (terminalIndex: number) => {
    if (!puzzle || !isPlaying) return;
    if (puzzle.endOrder[puzzle.targetLine] === terminalIndex) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      generatePuzzle();
    } else {
      playSound('miss', config.soundEnabled);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setScore(s => Math.max(0, s - 1));
    }
  };

  const target = puzzle?.lines[puzzle.targetLine];

  return (
    <motion.div
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
            <Play className="mr-2 h-6 w-6" /> Open the Map
          </Button>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {isPlaying && puzzle && target && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-800 px-6 py-2 rounded-full border border-slate-700">
            <span className="text-sm text-slate-400 font-bold whitespace-nowrap">Follow line</span>
            <span className={`px-3 py-1 rounded-md font-bold ${config.anaglyphMode ? 'text-slate-950' : 'text-white'}`} style={{ backgroundColor: config.anaglyphMode ? config.anaglyphTarget : target.color }}>{target.label}</span>
            <span className="text-sm text-slate-400 font-bold whitespace-nowrap">with your eyes only!</span>
          </div>

          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {puzzle.lines.map((line, i) => (
              <path key={i} d={line.path} fill="none" stroke={config.anaglyphMode ? (i === puzzle.targetLine ? config.anaglyphTarget : config.anaglyphScene) : line.color} strokeWidth={1.2} strokeLinecap="round" />
            ))}
          </svg>

          {puzzle.lines.map((line, i) => {
            const sy = 20 + (60 / (puzzle.lines.length - 1)) * i;
            return (
              <div
                key={line.label}
                className={`absolute -translate-y-1/2 px-2 py-0.5 rounded font-bold text-sm md:text-base ${config.anaglyphMode ? 'text-slate-950' : 'text-white'}`}
                style={{
                  left: '1%',
                  top: `${sy}%`,
                  // Each label has to match its own line, or the labels stop
                  // telling the child which line is the target.
                  backgroundColor: config.anaglyphMode
                    ? (i === puzzle.targetLine ? config.anaglyphTarget : config.anaglyphScene)
                    : line.color,
                }}
              >
                {line.label}
              </div>
            );
          })}

          {puzzle.terminals.map((t, i) => (
            <motion.button
              key={t.label}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleChoice(i)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full border-4 flex items-center justify-center font-bold text-lg md:text-xl z-10 ${config.anaglyphMode ? 'bg-slate-950 text-[var(--ag-scene)]' : 'bg-slate-50 border-slate-400 text-slate-900'}`}
              style={{ left: `${t.x}%`, top: `${t.y}%`, borderColor: config.anaglyphMode ? config.anaglyphScene : undefined }}
            >
              {t.label}
            </motion.button>
          ))}
        </>
      )}
    </motion.div>
  );
};

interface Vehicle {
  id: number;
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  isTarget: boolean;
  icon: any;
}

const CROSSING_LANES = [16, 33, 50, 67, 84];

const RailwayCrossing = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [shake, setShake] = useState(false);
  const idRef = useRef(0);
  const spawnCooldownRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 0.016));

        setVehicles(prev => {
          let next = prev
            .map(v => ({ ...v, x: v.x + v.dir * v.speed }))
            .filter(v => v.x > -10 && v.x < 110);

          spawnCooldownRef.current -= 16;
          const maxConcurrent = config.difficulty === 'hard' ? 5 : (config.difficulty === 'medium' ? 4 : 3);
          if (spawnCooldownRef.current <= 0 && next.length < maxConcurrent) {
            const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
            const isTarget = Math.random() < 0.45;
            const distractors = [Car, Bus, Truck];
            // Gentle pace so a young child can lock onto each vehicle
            const baseSpeed = config.speed * 0.02 * (config.difficulty === 'hard' ? 1.4 : 1);
            next = [...next, {
              id: idRef.current++,
              x: dir === 1 ? -8 : 108,
              y: CROSSING_LANES[Math.floor(Math.random() * CROSSING_LANES.length)],
              dir,
              speed: baseSpeed * (0.7 + Math.random() * 0.6),
              isTarget,
              icon: isTarget ? TrainFront : distractors[Math.floor(Math.random() * distractors.length)]
            }];
            spawnCooldownRef.current = 1000 + Math.random() * 1200;
          }
          return next;
        });
      }, 16);
    } else if (timeLeft <= 0 && isPlaying) {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / config.duration, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, timeLeft]);

  const handleTap = (v: Vehicle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!isPlaying) return;
    if (v.isTarget) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
    } else {
      playSound('miss', config.soundEnabled);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setScore(s => Math.max(0, s - 1));
    }
    setVehicles(prev => prev.filter(x => x.id !== v.id));
  };

  return (
    <motion.div
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {!isPlaying && Math.ceil(timeLeft) === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-slate-300 font-medium">Tap only the trains — let the cars pass!</p>
            <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
              <Play className="mr-2 h-6 w-6" /> Open the Crossing
            </Button>
          </div>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {CROSSING_LANES.map(y => (
        <div key={y} className="absolute left-0 right-0 border-t-2 border-dashed border-slate-800 pointer-events-none" style={{ top: `${y}%` }} />
      ))}

      {vehicles.map(v => (
        <div
          key={v.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
          style={{ left: `${v.x}%`, top: `${v.y}%`, width: config.size * 1.2, height: config.size * 1.2 }}
          onPointerDown={handleTap(v)}
        >
          <v.icon
            className={`w-full h-full ${config.anaglyphMode
              ? (v.isTarget ? 'text-[var(--ag-target)]' : 'text-[var(--ag-scene)]')
              : (v.isTarget ? 'text-red-400' : 'text-slate-400')}`}
            style={{ transform: v.dir === -1 ? 'scaleX(-1)' : undefined }}
          />
        </div>
      ))}
    </motion.div>
  );
};

const MEMORY_STATIONS = [
  { x: 18, y: 28, color: '#22c55e' },
  { x: 50, y: 16, color: '#eab308' },
  { x: 82, y: 28, color: '#ef4444' },
  { x: 82, y: 72, color: '#3b82f6' },
  { x: 50, y: 84, color: '#a855f7' },
  { x: 18, y: 72, color: '#f97316' },
];

const MetroMemory = ({ config, onComplete }: { config: GameConfig; onComplete: (stats: GameStats) => void }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState<'showing' | 'input'>('showing');
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [litStation, setLitStation] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const baseLength = config.difficulty === 'hard' ? 4 : (config.difficulty === 'medium' ? 3 : 2);
  const stepMs = config.difficulty === 'hard' ? 550 : 750;

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const startRound = (length: number) => {
    clearTimeouts();
    const seq: number[] = [];
    for (let i = 0; i < length; i++) {
      let next = Math.floor(Math.random() * MEMORY_STATIONS.length);
      // Avoid immediate repeats so every step is a visible eye jump
      while (seq.length > 0 && next === seq[seq.length - 1]) {
        next = Math.floor(Math.random() * MEMORY_STATIONS.length);
      }
      seq.push(next);
    }
    setSequence(seq);
    setInputIndex(0);
    setPhase('showing');
    setLitStation(null);
    seq.forEach((stationIdx, i) => {
      timeoutsRef.current.push(setTimeout(() => setLitStation(stationIdx), 400 + i * stepMs));
      timeoutsRef.current.push(setTimeout(() => setLitStation(null), 400 + i * stepMs + stepMs * 0.7));
    });
    timeoutsRef.current.push(setTimeout(() => setPhase('input'), 400 + seq.length * stepMs));
  };

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      if (sequence.length === 0) startRound(baseLength);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      clearTimeouts();
      playSound('complete', config.soundEnabled);
      onComplete({ score, timeSpent: config.duration, accuracy: score / 10, date: new Date().toISOString() });
      confetti({ particleCount: 250, spread: 160, origin: { y: 0.5 }, colors: ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'] });
    }
  }, [isPlaying, timeLeft, sequence]);

  useEffect(() => clearTimeouts, []);

  const handleStationTap = (stationIdx: number) => {
    if (!isPlaying || phase !== 'input') return;
    if (stationIdx === sequence[inputIndex]) {
      playSound('hit', config.soundEnabled);
      setLitStation(stationIdx);
      timeoutsRef.current.push(setTimeout(() => setLitStation(null), 250));
      if (inputIndex + 1 >= sequence.length) {
        setScore(s => s + 1);
        setPhase('showing');
        // Sequence grows by one after each success
        timeoutsRef.current.push(setTimeout(() => startRound(sequence.length + 1), 700));
      } else {
        setInputIndex(i => i + 1);
      }
    } else {
      playSound('miss', config.soundEnabled);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setScore(s => Math.max(0, s - 1));
      setPhase('showing');
      timeoutsRef.current.push(setTimeout(() => startRound(baseLength), 700));
    }
  };

  return (
    <motion.div
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800"
      animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {!isPlaying && timeLeft === config.duration && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-slate-300 font-medium">Watch which stations light up, then tap them in the same order!</p>
            <Button size="lg" onClick={() => setIsPlaying(true)} className="text-xl px-8 py-6">
              <Play className="mr-2 h-6 w-6" /> Start the Route
            </Button>
          </div>
        </div>
      )}

      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {isPlaying && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-800 px-6 py-2 rounded-full border border-slate-700">
          <span className="text-sm font-bold text-slate-300">
            {phase === 'showing' ? '👀 Watch the route...' : '✋ Your turn! Repeat the route'}
          </span>
        </div>
      )}

      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon
          points={MEMORY_STATIONS.map(s => `${s.x},${s.y}`).join(' ')}
          fill="none"
          stroke={config.anaglyphMode ? config.anaglyphScene : '#334155'}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>

      {MEMORY_STATIONS.map((st, i) => {
        const lit = litStation === i;
        const color = config.anaglyphMode ? config.anaglyphTarget : st.color;
        return (
          <motion.button
            key={i}
            whileHover={phase === 'input' ? { scale: 1.1 } : {}}
            whileTap={phase === 'input' ? { scale: 0.9 } : {}}
            onClick={() => handleStationTap(i)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 transition-all duration-150"
            style={{
              left: `${st.x}%`, top: `${st.y}%`,
              width: config.size * 1.5, height: config.size * 1.5,
              borderColor: color,
              backgroundColor: lit ? color : '#0f172a',
              boxShadow: lit ? `0 0 30px ${color}` : 'none',
              cursor: phase === 'input' ? 'pointer' : 'default'
            }}
          />
        );
      })}
    </motion.div>
  );
};

const ColorField = ({ label, hint, value, onChange }: {
  label: string;
  hint: string;
  value: string;
  onChange: (hex: string) => void;
}) => {
  // The text field keeps its own draft so half-typed hex codes never reach the
  // config (and never blank out the games behind the settings screen).
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = (raw: string) => {
    const next = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toUpperCase());
  };

  return (
    <div className="space-y-2">
      <label className="text-base font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-12 w-16 shrink-0 cursor-pointer rounded-md border border-slate-700 bg-slate-800 p-1"
        />
        <input
          type="text"
          aria-label={`${label} hex value`}
          value={draft}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }}
          onBlur={() => setDraft(value)}
          className="h-12 w-full rounded-md border border-slate-700 bg-slate-800 px-4 font-mono text-base uppercase text-slate-100 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <p className="text-sm text-slate-400">{hint}</p>
    </div>
  );
};

/**
 * Builds a complete profile from stored or restored data, filling anything
 * missing (older saves, older backups) with defaults.
 */
const normalizeUser = (parsed: any): UserProfile => {
  return {
    name: parsed?.name || 'Hero',
    avatar: parsed?.avatar || '🚀',
    level: parsed?.level || 1,
    experience: parsed?.experience || 0,
    stats: Object.fromEntries(
      ALL_MODES.map(mode => [mode, parsed?.stats?.[mode] || []])
    ) as Record<GameMode, GameStats[]>,
    stickers: Array.isArray(parsed?.stickers) ? parsed.stickers : [],
    lastMissionDate: parsed?.lastMissionDate,
    patch: {
      log: parsed?.patch?.log && typeof parsed.patch.log === 'object' ? parsed.patch.log : {},
      startedAt: typeof parsed?.patch?.startedAt === 'number' ? parsed.patch.startedAt : null,
      lastStickerDate: parsed?.patch?.lastStickerDate,
    },
    checks: Array.isArray(parsed?.checks) ? parsed.checks : [],
    lastBackupAt: typeof parsed?.lastBackupAt === 'string' ? parsed.lastBackupAt : undefined,
  };
};

// --- Main App ---

export default function App() {
  const [screen, setScreen] = useState<'home' | 'game' | 'settings' | 'stats' | 'patch' | 'check'>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>('tracking');
  const [config, setConfig] = useState<GameConfig>(() => {
    // Exercise settings and the display calibration are stored separately:
    // calibration belongs to the screen/glasses combination on THIS device and
    // should outlive any change to difficulty, duration and the rest.
    try {
      const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
      const savedDisplay = localStorage.getItem(DISPLAY_STORAGE_KEY);
      return {
        ...DEFAULT_CONFIG,
        ...(savedConfig ? JSON.parse(savedConfig) : {}),
        ...(savedDisplay ? JSON.parse(savedDisplay) : {}),
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  const [user, setUser] = useState<UserProfile>(() => {
    // Storage can be blocked (private mode, embedded frames); start fresh then.
    try {
      const saved = localStorage.getItem('eyequest_user');
      return normalizeUser(saved ? JSON.parse(saved) : null);
    } catch {
      return normalizeUser(null);
    }
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calibrationTest, setCalibrationTest] = useState(false);
  // The daily mission in progress, if any: three games played back to back.
  const [mission, setMission] = useState<{ modes: GameMode[]; index: number } | null>(null);
  // Set when the last mission game ends: the sticker just earned, or null if
  // today's sticker was already collected.
  const [missionReward, setMissionReward] = useState<string | null | undefined>(undefined);

  const visibleTiles = GAME_TILES.filter(t => config.anaglyphMode || !t.requiresAnaglyph);
  const phase = phaseInfo(config.therapyPhase);
  const patchRunning = user.patch.startedAt !== null;
  // A game that is waiting for the "patch on?" answer before it starts.
  const [pendingPlay, setPendingPlay] = useState<(() => void) | null>(null);

  // Patch time runs on the wall clock, so re-render while the timer is running
  // (every second on Patch Pal itself, every 20 s elsewhere).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!patchRunning && screen !== 'patch') return;
    const id = setInterval(() => setNow(Date.now()), screen === 'patch' ? 1000 : 20000);
    return () => clearInterval(id);
  }, [patchRunning, screen]);

  const updatePatch = (change: (patch: PatchRecord) => PatchRecord) =>
    setUser(prev => ({ ...prev, patch: change(prev.patch) }));

  const startPatch = () => {
    if (patchRunning) return;
    setNow(Date.now());
    updatePatch(p => ({ ...p, startedAt: Date.now() }));
    speak('Patch on! Ahoy, captain!', config.voiceEnabled);
  };

  const stopPatch = () => {
    setNow(Date.now());
    updatePatch(p => {
      if (!p.startedAt) return p;
      // Credited to the day the patch went on.
      const day = dayKey(p.startedAt);
      const minutes = runningMinutes(p.startedAt);
      return { ...p, startedAt: null, log: { ...p.log, [day]: Math.round((p.log[day] ?? 0) + minutes) } };
    });
  };

  const adjustPatch = (minutes: number) => {
    const day = dayKey();
    updatePatch(p => ({ ...p, log: { ...p.log, [day]: Math.max(0, (p.log[day] ?? 0) + minutes) } }));
  };

  // One pirate sticker the first time each day that the patch goal is reached.
  const patchToday = todayPatchMinutes(user.patch, now);
  useEffect(() => {
    const today = dayKey(now);
    if (patchToday < config.patchGoalMinutes || user.patch.lastStickerDate === today) return;
    const sticker = PATCH_STICKERS[user.stickers.length % PATCH_STICKERS.length];
    setUser(prev => ({
      ...prev,
      stickers: [...prev.stickers, sticker],
      patch: { ...prev.patch, lastStickerDate: today },
    }));
    playSound('complete', config.soundEnabled);
    confetti({ particleCount: 200, spread: 140, origin: { y: 0.4 } });
    speak('Patch goal done! You won a pirate sticker!', config.voiceEnabled);
  }, [patchToday, config.patchGoalMinutes, user.patch.lastStickerDate]);

  /**
   * In the one-eye phases, ask for the patch (and glasses) before playing if
   * the patch timer is not running. The prompt's button is a tap, so full
   * screen and speech still start from a user gesture.
   */
  const requestPlay = (play: () => void) => {
    if (PATCH_PHASES.includes(config.therapyPhase) && !patchRunning) {
      setPendingPlay(() => play);
      return;
    }
    play();
  };

  // Backup and restore.
  const [backupMessage, setBackupMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const restoreInput = useRef<HTMLInputElement | null>(null);

  const saveBackup = async () => {
    const savedAt = new Date().toISOString();
    const saved = await saveBackupFile(buildBackup({ ...user, lastBackupAt: savedAt }, config));
    if (saved) {
      setUser(prev => ({ ...prev, lastBackupAt: savedAt }));
      setBackupMessage({ kind: 'ok', text: 'Backup saved. Keep the file somewhere safe, like Google Drive or email.' });
    }
  };

  const pickRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if ('error' in parsed) {
      setBackupMessage({ kind: 'error', text: parsed.error });
      return;
    }
    setBackupMessage(null);
    setPendingRestore(parsed.backup);
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    setUser(normalizeUser(pendingRestore.user));
    // Keep this screen's own calibration: the backup's came from another screen.
    setConfig(c => ({
      ...DEFAULT_CONFIG,
      ...pendingRestore.config,
      anaglyphTarget: c.anaglyphTarget,
      anaglyphScene: c.anaglyphScene,
      anaglyphTargetLevel: c.anaglyphTargetLevel,
      anaglyphSceneLevel: c.anaglyphSceneLevel,
      pxPerMm: c.pxPerMm,
    }));
    setPendingRestore(null);
    setBackupMessage({ kind: 'ok', text: `Restored the backup from ${new Date(pendingRestore.savedAt).toLocaleDateString()}.` });
  };

  const lastCheck = user.checks[user.checks.length - 1];
  const checkDue = !lastCheck || (daysSince(lastCheck.date) ?? 0) >= 30;
  const backupAge = daysSince(user.lastBackupAt);

  const choosePhase = (id: GameConfig['therapyPhase']) => {
    const info = phaseInfo(id);
    setConfig(c => ({ ...c, ...info.apply, therapyPhase: id }));
  };
  const missionDoneToday = user.lastMissionDate === todayKey();

  // Home and game both lay themselves out inside one viewport height; settings
  // and stats stay ordinary scrolling pages.
  const fillsViewport = screen === 'home' || screen === 'game';

  // Brightness is folded in here so the settings screen keeps editing the base
  // colours while games and previews render the calibrated result.
  const renderConfig = useMemo<GameConfig>(() => ({
    ...config,
    anaglyphTarget: scaleColor(config.anaglyphTarget, config.anaglyphTargetLevel / 100),
    anaglyphScene: scaleColor(config.anaglyphScene, config.anaglyphSceneLevel / 100),
  }), [config]);

  useEffect(() => {
    try {
      localStorage.setItem('eyequest_user', JSON.stringify(user));
    } catch {
      // Progress just won't persist.
    }
  }, [user]);

  useEffect(() => {
    const { anaglyphTarget, anaglyphScene, anaglyphTargetLevel, anaglyphSceneLevel, pxPerMm, ...exerciseConfig } = config;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(exerciseConfig));
      // Kept under its own key: one calibration per device, set up once.
      localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify({
        anaglyphTarget, anaglyphScene, anaglyphTargetLevel, anaglyphSceneLevel, pxPerMm,
      }));
    } catch {
      // Storage can be unavailable (private mode); settings just won't persist.
    }
  }, [config]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  /**
   * Browsers only grant full screen from a user gesture, so this runs on the
   * tap that opens an exercise. A page cannot go full screen on load — for
   * that, install the app to the home screen (the manifest asks for full
   * screen) and it launches without browser chrome.
   */
  const startGame = (mode: GameMode) => {
    setSelectedMode(mode);
    setScreen('game');
    setMissionReward(undefined);
    // Spoken from the tap itself: iOS only lets a page start speech from a gesture.
    speak(GAME_INSTRUCTIONS[mode], config.voiceEnabled);
    if (config.autoFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Refused (unsupported, or iPhone Safari): the in-app layout still
        // fills the viewport, so this is only a nicety.
      });
    }
  };

  const startMission = () => {
    const modes = pickMission(user, config.anaglyphMode);
    setMission({ modes, index: 0 });
    startGame(modes[0]);
  };

  const nextMissionGame = () => {
    if (!mission) return;
    const index = mission.index + 1;
    setMission({ ...mission, index });
    startGame(mission.modes[index]);
  };

  const leaveGame = () => {
    stopSpeaking();
    setMission(null);
    setScreen('home');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // A tablet dims and locks while a child is watching a slow target without
  // touching the screen, which ends the exercise. Hold the screen awake for as
  // long as an exercise is open, and re-acquire it after the tab is hidden
  // (Android drops the lock on backgrounding).
  useEffect(() => {
    if (screen !== 'game') return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const acquire = () => {
      nav.wakeLock!.request('screen')
        .then(lock => { if (cancelled) lock.release().catch(() => {}); else sentinel = lock; })
        .catch(() => {
          // Denied (unsupported, or not a secure context) — nothing to do.
        });
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [screen]);

  const handleGameComplete = (stats: GameStats) => {
    const statsWithDifficulty = { ...stats, difficulty: config.difficulty };
    const finishesMission = !!mission && mission.index === mission.modes.length - 1;
    const day = todayKey();
    const earnsSticker = finishesMission && user.lastMissionDate !== day;
    const sticker = STICKERS[user.stickers.length % STICKERS.length];
    setUser(prev => ({
      ...prev,
      experience: prev.experience + stats.score * 10,
      level: Math.floor((prev.experience + stats.score * 10) / 100) + 1,
      stats: {
        ...prev.stats,
        [selectedMode]: [...prev.stats[selectedMode], statsWithDifficulty]
      },
      ...(earnsSticker ? { stickers: [...prev.stickers, sticker], lastMissionDate: day } : {}),
    }));
    if (finishesMission) {
      setMissionReward(earnsSticker ? sticker : null);
      setMission(null);
      speak(earnsSticker ? 'Mission complete! You won a new sticker!' : 'Mission complete! Great job!', config.voiceEnabled);
    } else if (mission) {
      speak('Great job! Ready for the next game?', config.voiceEnabled);
    } else {
      speak('Great job!', config.voiceEnabled);
    }
    setScreen('stats');
  };

  // Mission games all run for the same short length; a free-play cinema show
  // uses its own, longer setting.
  const gameConfig = useMemo<GameConfig>(() => {
    if (mission) return { ...renderConfig, duration: config.missionSeconds };
    if (selectedMode === 'cinema') return { ...renderConfig, duration: config.cinemaMinutes * 60 };
    return renderConfig;
  }, [renderConfig, mission, selectedMode, config.missionSeconds, config.cinemaMinutes]);

  return (
    <div
      className={`safe-area bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 ${fillsViewport ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
      // Tailwind cannot compile colours that are only known at runtime, so the
      // calibrated anaglyph pair is published as inherited CSS variables here.
      style={{
        '--ag-target': renderConfig.anaglyphTarget,
        '--ag-scene': renderConfig.anaglyphScene,
        '--ag-scene-20': withAlpha(renderConfig.anaglyphScene, 0.2),
        '--ag-scene-30': withAlpha(renderConfig.anaglyphScene, 0.3),
        // Target glow must stay inside the target's own channel, or it reaches
        // the other eye as a grey halo.
        '--ag-glow': withAlpha(renderConfig.anaglyphTarget, 0.75),
      } as React.CSSProperties}
    >
      <AnaglyphFilters target={renderConfig.anaglyphTarget} scene={renderConfig.anaglyphScene} />

      {pendingPlay && (
        <PatchPrompt
          onPatchOn={() => { const play = pendingPlay; setPendingPlay(null); startPatch(); play(); }}
          onSkip={() => { const play = pendingPlay; setPendingPlay(null); play(); }}
          onCancel={() => setPendingPlay(null)}
        />
      )}
      {/* Calibration has to be judged on a dark field like the games use — the lit
          settings page around the inline preview reaches both eyes and masks the
          ghosting the parent is trying to see. */}
      {calibrationTest && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
          <div className="relative flex w-full max-w-3xl items-center justify-center gap-16 py-16">
            <div className="absolute left-0 right-0 h-2" style={{ backgroundColor: renderConfig.anaglyphScene, opacity: 0.35 }} />
            {[10, 50, 90].map(left => (
              <div
                key={left}
                className="absolute h-5 w-5 -translate-x-1/2 rounded-full border-2"
                style={{ left: `${left}%`, borderColor: renderConfig.anaglyphScene, backgroundColor: '#000000' }}
              />
            ))}
            <TrainFront className="relative h-24 w-24" style={{ color: renderConfig.anaglyphTarget }} />
            <span className="relative text-7xl font-bold" style={{ color: renderConfig.anaglyphTarget }}>E</span>
          </div>

          <div className="mt-16 flex items-center gap-3 text-slate-600">
            <span className="text-xs uppercase tracking-wider">Target</span>
            <button
              onClick={() => setConfig(c => ({ ...c, anaglyphTargetLevel: Math.max(20, c.anaglyphTargetLevel - 5) }))}
              className="h-12 w-12 rounded-md border border-slate-800 text-xl text-slate-500 hover:text-slate-300"
              aria-label="Dimmer target"
            >
              –
            </button>
            <span className="w-16 text-center font-mono text-base tabular-nums text-slate-500">{config.anaglyphTargetLevel}%</span>
            <button
              onClick={() => setConfig(c => ({ ...c, anaglyphTargetLevel: Math.min(100, c.anaglyphTargetLevel + 5) }))}
              className="h-12 w-12 rounded-md border border-slate-800 text-xl text-slate-500 hover:text-slate-300"
              aria-label="Brighter target"
            >
              +
            </button>
            <button
              onClick={() => setCalibrationTest(false)}
              className="ml-6 h-12 rounded-md border border-slate-800 px-6 text-base text-slate-500 hover:text-slate-300"
            >
              Done
            </button>
          </div>
          <p className="mt-6 max-w-md px-6 text-center text-xs leading-relaxed text-slate-700">
            Cover one eye at a time. Dim the target until it disappears through the scenery lens
            while staying clearly visible through the other one.
          </p>
        </div>
      )}

      {/* During a game the layout switches to a full-viewport flex column so the
          play area gets every pixel the screen has (100dvh tracks resizes and
          mobile browser chrome automatically) */}
      <div className={`mx-auto flex flex-col ${fillsViewport ? 'h-full max-w-none p-2 md:p-4' : 'max-w-7xl p-4 md:p-8'}`}>

        {/* Header */}
        {screen !== 'game' && (
        <header className={`flex items-center justify-between shrink-0 ${screen === 'home' ? 'mb-3 md:mb-4' : 'mb-8'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              {user.avatar}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vision Express</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-300 uppercase tracking-wider">Level {user.level}</span>
                {config.therapyPhase !== 'free' && (
                  <Badge variant="outline" className="border-slate-700 text-slate-300">{phase.short}</Badge>
                )}
                <Progress value={(user.experience % 100)} className="w-20 h-1.5" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Toggle Fullscreen">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setScreen('settings')}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>
        )}

        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-1 min-h-0 flex-col gap-3"
            >
              {config.therapyPhase !== 'free' && (
                <PatchPalBar patch={user.patch} goal={config.patchGoalMinutes} now={now} onOpen={() => setScreen('patch')} />
              )}

              {phase.locked ? (
                // Recovery after an operation: nothing to play, just a friendly note.
                <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
                  <div className="text-7xl">🩹</div>
                  <h2 className="text-3xl font-bold">Get well soon, captain!</h2>
                  <p className="max-w-md text-lg text-slate-300">
                    Your eye is resting after the doctor fixed it. The games will be back when the doctor says so.
                  </p>
                  <p className="text-sm text-slate-500">A parent can change this in Parent's Corner.</p>
                </div>
              ) : (
              <>
              {/* One big button runs today's mission: three short games, then a sticker. */}
              <button
                onClick={() => requestPlay(startMission)}
                className="flex shrink-0 items-center gap-3 rounded-xl border-2 border-yellow-400/60 bg-gradient-to-r from-yellow-500/20 to-orange-500/10 px-4 py-2.5 text-left transition-transform active:scale-[0.99] hover:border-yellow-300"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.45)]">
                  <Play className="h-6 w-6 fill-slate-950" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold leading-tight text-yellow-100 md:text-xl">Today's Mission</div>
                  <div className="text-sm text-slate-300">
                    {missionDoneToday ? 'Sticker collected! Play again for fun.' : '3 games, then a new sticker!'}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {pickMission(user, config.anaglyphMode).map((mode, i) => {
                    const tile = GAME_TILES.find(t => t.mode === mode)!;
                    return (
                      <div key={i} className={`flex h-10 w-10 items-center justify-center rounded-lg ${tile.chipClass}`}>
                        <tile.Icon className={`h-6 w-6 ${tile.iconClass}`} />
                      </div>
                    );
                  })}
                </div>
              </button>

              {/* The tiles share the leftover viewport height: the column
                  count steps up with width so rows stay a sensible shape, and
                  the rows split the height evenly but never shrink below 9rem. Very short
                  windows fall back to scrolling rather than crushing the tiles. */}
              <div className="grid flex-1 min-h-0 auto-rows-[minmax(9rem,1fr)] grid-cols-2 gap-2.5 overflow-y-auto md:grid-cols-3 md:gap-3 xl:grid-cols-4">
                {visibleTiles.map(tile => (
                  <Card
                    key={tile.mode}
                    className={`relative flex min-h-[9rem] flex-col gap-0 overflow-hidden border-slate-800 bg-slate-900 p-2.5 ${tile.hoverClass} group cursor-pointer transition-all md:p-3`}
                    onClick={() => requestPlay(() => startGame(tile.mode))}
                  >
                    <div className="min-h-0 flex-1">
                      <GamePreview mode={tile.mode} />
                    </div>
                    <div className="mt-2.5 flex shrink-0 items-center gap-2.5 md:mt-3">
                      <div className={`h-10 w-10 shrink-0 rounded-lg md:h-11 md:w-11 ${tile.chipClass} flex items-center justify-center transition-transform group-hover:scale-110`}>
                        <tile.Icon className={`h-6 w-6 ${tile.iconClass}`} />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base leading-tight text-slate-50 md:text-lg">{tile.title}</CardTitle>
                        <CardDescription className="mt-0.5 hidden truncate text-sm text-slate-300 lg:block">{tile.description}</CardDescription>
                      </div>
                    </div>
                    <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${tile.barClass} translate-y-full transform transition-transform group-hover:translate-y-0`} />
                  </Card>
                ))}
              </div>

              </>
              )}

              <div className="flex shrink-0 items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5">
                <Sticker className="h-5 w-5 shrink-0 text-blue-400" />
                {user.stickers.length > 0 ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label={`${user.stickers.length} stickers collected`}>
                    {/* Newest first, so a fresh sticker is always in view. */}
                    {[...user.stickers].reverse().slice(0, 24).map((sticker, i) => (
                      <span key={i} className="text-2xl leading-none">{sticker}</span>
                    ))}
                  </div>
                ) : (
                  <p className="min-w-0 flex-1 text-sm text-slate-300 md:text-base">
                    Finish today's mission to win your first sticker!
                  </p>
                )}
                <p className="hidden shrink-0 items-center gap-2 text-sm text-slate-400 lg:flex">
                  <Eye className="h-4 w-4 text-blue-400" /> Wear the patch as your doctor directed.
                </p>
              </div>

            </motion.div>
          )}

          {screen === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="h-full min-h-0 flex flex-col"
            >
              <div className="mb-2 flex items-center justify-between shrink-0">
                <Button variant="ghost" size="sm" onClick={leaveGame}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back to Base
                </Button>
                <div className="flex items-center gap-1">
                <Badge className="bg-blue-600">
                  {mission && `Mission ${mission.index + 1}/${mission.modes.length} · `}
                  {SKILL_LABELS[selectedMode]}
                </Badge>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Toggle Fullscreen">
                  {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </Button>
                </div>
              </div>

              {/* The comfort zone keeps the left part of the play area empty, so
                  targets never ask an eye with limited outward movement to look
                  far to the left. */}
              <div
                className="flex-1 min-h-0 overflow-y-auto"
                style={config.comfortZone ? { paddingLeft: COMFORT_ZONE_GUTTER } : undefined}
              >
              {selectedMode === 'tracking' && <RocketTracker config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'contrast' && <FoggyFlight config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'detail' && <TrafficJam config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'saccades' && <SpeedwaySaccades config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'peripheral' && <PeripheralPatrol config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'spotter' && <FoggySpotter config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'checkpoint' && <Checkpoint config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'metro' && <MetroTracker config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'station' && <StationHunt config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'navigator' && <LineNavigator config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'crossing' && <RailwayCrossing config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'memory' && <MetroMemory config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'shapes' && <ShapeGarage config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'popout' && <PopOutPups config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'cinema' && <CartoonCinema config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'carriages' && <CountCarriages config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'dots' && <RocketDots config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'zoo' && <ZooHideSeek config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'bus' && <BusDriver config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'hangar' && <HangarMatch config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'carwash' && <CarWash config={gameConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'differences' && <SpotDifference config={gameConfig} onComplete={handleGameComplete} />}
              </div>
            </motion.div>
          )}

          {screen === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              {typeof missionReward === 'string' ? (
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
                  className="w-32 h-32 bg-yellow-400/20 border-4 border-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 text-7xl"
                >
                  {missionReward}
                </motion.div>
              ) : (
                <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="h-12 w-12 text-yellow-500" />
                </div>
              )}
              <h2 className="text-3xl font-bold mb-2">
                {typeof missionReward === 'string' ? 'New Sticker!' : 'Mission Accomplished!'}
              </h2>
              <div className="flex justify-center mb-4">
                <Badge variant="outline" className="capitalize px-4 py-1 border-slate-700">
                  {user.stats[selectedMode].slice(-1)[0]?.difficulty || 'medium'} Mode
                </Badge>
              </div>
              <p className="text-slate-400 mb-8">You're getting stronger every day, Hero.</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="text-2xl font-bold text-blue-400">+{user.stats[selectedMode].slice(-1)[0]?.score * 10}</div>
                  <div className="text-sm text-slate-300 uppercase">Experience</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="text-2xl font-bold text-purple-400">{user.stats[selectedMode].slice(-1)[0]?.score}</div>
                  <div className="text-sm text-slate-300 uppercase">Score</div>
                </div>
              </div>

              {mission && mission.index < mission.modes.length - 1 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex gap-2" aria-label={`Game ${mission.index + 1} of ${mission.modes.length} done`}>
                    {mission.modes.map((mode, i) => {
                      const tile = GAME_TILES.find(t => t.mode === mode)!;
                      return (
                        <div
                          key={i}
                          className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${i <= mission.index ? 'border-green-500 bg-green-500/15' : 'border-slate-700 bg-slate-900'}`}
                        >
                          <tile.Icon className={`h-6 w-6 ${tile.iconClass}`} />
                        </div>
                      );
                    })}
                  </div>
                  <Button size="lg" onClick={nextMissionGame} className="px-10 py-6 text-xl">
                    <Play className="mr-2 h-6 w-6" /> Next Game
                  </Button>
                  <Button variant="ghost" onClick={leaveGame}>Stop for today</Button>
                </div>
              ) : (
                <Button size="lg" onClick={() => setScreen('home')} className="px-8">
                  Continue Journey
                </Button>
              )}
            </motion.div>
          )}

          {screen === 'patch' && (
            <PatchPalScreen
              patch={user.patch}
              goal={config.patchGoalMinutes}
              now={now}
              onStart={startPatch}
              onStop={stopPatch}
              onAdjust={adjustPatch}
              onClose={() => setScreen('home')}
            />
          )}

          {screen === 'check' && (
            <PictureCheckScreen
              checks={user.checks}
              pxPerMm={config.pxPerMm}
              onCalibrate={px => setConfig(c => ({ ...c, pxPerMm: px }))}
              onSave={check => setUser(prev => ({ ...prev, checks: [...prev.checks, check] }))}
              onClose={() => setScreen('settings')}
            />
          )}

          {screen === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Parent's Corner</h2>
                <Button variant="ghost" onClick={() => setScreen('home')}>Close</Button>
              </div>

              {/* The treatment plan comes first: it decides which games appear
                  and how they are set up. */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-50">Treatment Plan</CardTitle>
                  <CardDescription className="text-slate-400">
                    Match the app to the stage your eye doctor has set. Choosing a stage applies its settings once; you can still change any of them below.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PHASES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => choosePhase(p.id)}
                        aria-pressed={config.therapyPhase === p.id}
                        className={`rounded-lg border p-3 text-left transition-colors ${config.therapyPhase === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 hover:border-slate-600'}`}
                      >
                        <div className="font-medium text-slate-50">{p.label}</div>
                        <div className="mt-0.5 text-sm text-slate-400">{p.description}</div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
                    <div className="space-y-0.5">
                      <label className="text-base font-medium">Comfort Zone</label>
                      <p className="text-sm text-slate-400">Keep targets out of the left part of the screen, for an eye that can't turn fully outward to the left. Ask the eye doctor whether to use it.</p>
                    </div>
                    <Button
                      variant={config.comfortZone ? 'default' : 'outline'}
                      onClick={() => setConfig(c => ({ ...c, comfortZone: !c.comfortZone }))}
                    >
                      {config.comfortZone ? 'On' : 'Off'}
                    </Button>
                  </div>

                  <div className="space-y-4 border-t border-slate-800 pt-4">
                    <div className="flex justify-between">
                      <div className="space-y-0.5">
                        <label className="text-base font-medium">Daily Patch Goal</label>
                        <p className="text-sm text-slate-400">The patch time your eye doctor prescribed. Patch Pal gives a sticker each day it is reached.</p>
                      </div>
                      <span className="text-sm text-blue-400">{Math.floor(config.patchGoalMinutes / 60)} h {String(config.patchGoalMinutes % 60).padStart(2, '0')} min</span>
                    </div>
                    <Slider
                      value={[config.patchGoalMinutes]}
                      min={30} max={480} step={30}
                      onValueChange={(vals) => {
                        const val = Array.isArray(vals) ? vals[0] : vals;
                        setConfig(c => ({ ...c, patchGoalMinutes: val }));
                      }}
                    />
                    <Button variant="outline" onClick={() => setScreen('patch')}>Open Patch Pal</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-50 flex items-center gap-2">
                    Monthly Picture Check
                    {checkDue && <Badge className="bg-amber-500 text-slate-950">Due</Badge>}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    A short vision check with picture symbols, done the same way every month. It shows the trend for each eye; it is not a medical test.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                  <Button onClick={() => setScreen('check')}>{config.pxPerMm > 0 ? 'Open picture check' : 'Set up picture check'}</Button>
                  <span className="text-sm text-slate-400">
                    {lastCheck
                      ? `Last check ${new Date(lastCheck.date).toLocaleDateString()}: ${lastCheck.eye} eye ${toDecimal(lastCheck.logMAR)}`
                      : 'No checks yet.'}
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-50 flex items-center gap-2">
                    Backup
                    {(backupAge === null || backupAge >= 30) && <Badge className="bg-amber-500 text-slate-950">Recommended</Badge>}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Progress lives only on this device. Save a backup file once a month, and load it on a new or reset tablet to carry on where you left off. It includes stickers, game history, the patch log, picture checks and settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={saveBackup}>Save backup file</Button>
                    <Button variant="outline" onClick={() => restoreInput.current?.click()}>Restore from file…</Button>
                    <input
                      id="restore-file"
                      ref={restoreInput}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={e => { pickRestoreFile(e.target.files?.[0]); e.target.value = ''; }}
                    />
                    <span className="text-sm text-slate-400">
                      {backupAge === null ? 'Never backed up.' : backupAge === 0 ? 'Last backup: today.' : `Last backup: ${backupAge} day${backupAge === 1 ? '' : 's'} ago.`}
                    </span>
                  </div>
                  {pendingRestore && (
                    // Restoring replaces everything, so it is confirmed here in the page.
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                      <p className="text-slate-100">
                        Replace everything on this device with the backup from <strong>{new Date(pendingRestore.savedAt).toLocaleString()}</strong>?
                        It has {pendingRestore.user?.stickers?.length ?? 0} stickers and {pendingRestore.user?.checks?.length ?? 0} picture checks. This screen's colour and size calibration is kept.
                      </p>
                      <div className="mt-3 flex gap-3">
                        <Button onClick={confirmRestore}>Replace and restore</Button>
                        <Button variant="ghost" onClick={() => setPendingRestore(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {backupMessage && (
                    <p className={`text-sm ${backupMessage.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`} role="status">{backupMessage.text}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-50">Exercise Configuration</CardTitle>
                  <CardDescription className="text-slate-400">Adjust the difficulty and duration of the training sessions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-base font-medium">Difficulty Level</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          variant={config.difficulty === d ? "default" : "outline"}
                          className="capitalize"
                          onClick={() => {
                            const preset = DIFFICULTY_PRESETS[d];
                            setConfig(c => ({ ...c, difficulty: d, ...preset }));
                          }}
                        >
                          {d}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <label className="text-base font-medium">Movement Speed</label>
                      <span className="text-sm text-blue-400">{config.speed}</span>
                    </div>
                    <Slider 
                      value={[config.speed]} 
                      min={1} max={10} step={1} 
                      onValueChange={(vals) => {
                        const val = Array.isArray(vals) ? vals[0] : vals;
                        setConfig(c => ({...c, speed: val}));
                      }}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <label className="text-base font-medium">Target Size (px)</label>
                      <span className="text-sm text-blue-400">{config.size}px</span>
                    </div>
                    <Slider 
                      value={[config.size]} 
                      min={20} max={100} step={5} 
                      onValueChange={(vals) => {
                        const val = Array.isArray(vals) ? vals[0] : vals;
                        setConfig(c => ({...c, size: val}));
                      }}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <label className="text-base font-medium">Session Duration (s)</label>
                      <span className="text-sm text-blue-400">{config.duration}s</span>
                    </div>
                    <Slider 
                      value={[config.duration]} 
                      min={10} max={300} step={10} 
                      onValueChange={(vals) => {
                        const val = Array.isArray(vals) ? vals[0] : vals;
                        setConfig(c => ({...c, duration: val}));
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="space-y-0.5">
                      <label className="text-base font-medium">Sound Effects</label>
                      <p className="text-sm text-slate-400">Enable or disable game sounds.</p>
                    </div>
                    <Button 
                      variant={config.soundEnabled ? "default" : "outline"}
                      onClick={() => setConfig(c => ({...c, soundEnabled: !c.soundEnabled}))}
                    >
                      {config.soundEnabled ? <Volume2 className="h-4 w-4 mr-2"/> : <VolumeX className="h-4 w-4 mr-2"/>}
                      {config.soundEnabled ? "On" : "Off"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <div className="space-y-0.5">
                        <label className="text-base font-medium">Daily Mission Game Length</label>
                        <p className="text-sm text-slate-400">Each of the three mission games runs this long.</p>
                      </div>
                      <span className="text-sm text-blue-400">{config.missionSeconds}s</span>
                    </div>
                    <Slider
                      value={[config.missionSeconds]}
                      min={60} max={240} step={30}
                      onValueChange={(vals) => {
                        const val = Array.isArray(vals) ? vals[0] : vals;
                        setConfig(c => ({ ...c, missionSeconds: val }));
                      }}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <div className="space-y-0.5">
                        <label className="text-base font-medium">Cartoon Cinema Length</label>
                        <p className="text-sm text-slate-400">How long a Cartoon Cinema show runs in free play.</p>
                      </div>
                      <span className="text-sm text-blue-400">{config.cinemaMinutes} min</span>
                    </div>
                    <Slider
                      value={[config.cinemaMinutes]}
                      min={1} max={10} step={1}
                      onValueChange={(vals) => {
                        const val = Array.isArray(vals) ? vals[0] : vals;
                        setConfig(c => ({ ...c, cinemaMinutes: val }));
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="space-y-0.5">
                      <label className="text-base font-medium">Spoken Instructions</label>
                      <p className="text-sm text-slate-400">Read each game's instructions aloud, for children who can't read yet.</p>
                    </div>
                    <Button
                      variant={config.voiceEnabled ? "default" : "outline"}
                      onClick={() => setConfig(c => ({ ...c, voiceEnabled: !c.voiceEnabled }))}
                    >
                      {config.voiceEnabled ? <Mic className="h-4 w-4 mr-2" /> : <MicOff className="h-4 w-4 mr-2" />}
                      {config.voiceEnabled ? "On" : "Off"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="space-y-0.5">
                      <label className="text-base font-medium">Full Screen Exercises</label>
                      <p className="text-sm text-slate-400">Fill the whole screen when an exercise starts.</p>
                    </div>
                    <Button
                      variant={config.autoFullscreen ? "default" : "outline"}
                      onClick={() => setConfig(c => ({ ...c, autoFullscreen: !c.autoFullscreen }))}
                    >
                      {config.autoFullscreen ? <Maximize className="h-4 w-4 mr-2" /> : <Minimize className="h-4 w-4 mr-2" />}
                      {config.autoFullscreen ? "On" : "Off"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="space-y-0.5">
                      <label className="text-base font-medium">Anaglyph Mode (Red/Cyan)</label>
                      <p className="text-sm text-slate-400">Enable if you have Red/Cyan glasses for dichoptic training. Pop-Out Pups needs the glasses, so it only appears while this is on.</p>
                    </div>
                    <Button
                      variant={config.anaglyphMode ? "default" : "outline"}
                      onClick={() => setConfig(c => ({...c, anaglyphMode: !c.anaglyphMode}))}
                    >
                      {config.anaglyphMode ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                  {config.anaglyphMode && (
                    <div className="pt-4 border-t border-slate-800">
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <div className="space-y-0.5">
                        <label className="text-base font-medium">Cartoon Cinema: Strong-Eye Picture</label>
                        <p className="text-sm text-slate-400">How bright the scenery-colour eye's copy of the cartoon is. Lower pushes more of the work onto the weaker eye.</p>
                      </div>
                      <span className="text-sm text-blue-400">{config.cinemaFellowLevel}%</span>
                    </div>
                    <Slider
                      value={[config.cinemaFellowLevel]}
                      min={0} max={100} step={5}
                      onValueChange={(vals) => {
                        const val = Array.isArray(vals) ? vals[0] : vals;
                        setConfig(c => ({ ...c, cinemaFellowLevel: val }));
                      }}
                    />
                  </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {config.anaglyphMode && (
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-slate-50 flex items-center gap-2">
                      <Palette className="h-5 w-5 text-blue-400" /> Display Calibration
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Screens and glasses vary, so the textbook red/cyan pair ghosts on some
                      combinations. Tune the colours until each eye sees as little of the other's
                      image as possible. Stored on this device only — set it up once per device.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-base font-medium">Preview</label>
                        <Button variant="outline" onClick={() => setCalibrationTest(true)}>
                          <Maximize className="mr-2 h-4 w-4" /> Test full screen
                        </Button>
                      </div>
                      <div className="relative flex h-28 items-center justify-center gap-10 overflow-hidden rounded-xl border-4 border-slate-800 bg-black">
                        <div
                          className="absolute left-0 right-0 h-2"
                          style={{ backgroundColor: renderConfig.anaglyphScene, opacity: 0.35 }}
                        />
                        {[20, 80].map(left => (
                          <div
                            key={left}
                            className="absolute h-4 w-4 -translate-x-1/2 rounded-full border-2"
                            style={{ left: `${left}%`, borderColor: renderConfig.anaglyphScene, backgroundColor: '#000000' }}
                          />
                        ))}
                        <TrainFront className="relative h-12 w-12" style={{ color: renderConfig.anaglyphTarget }} />
                        <span className="relative text-4xl font-bold" style={{ color: renderConfig.anaglyphTarget }}>E</span>
                      </div>
                      <p className="text-sm text-slate-400">
                        Wearing the glasses, cover one eye at a time. Through the lens over the
                        training eye the train and letter should look bright while the line and
                        stations nearly disappear; through the other lens, the opposite. Judge it
                        with <strong className="text-slate-400">Test full screen</strong> — the bright
                        settings page around this strip reaches both eyes and hides the difference.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <label className="text-base font-medium">Target brightness</label>
                        <span className="text-sm text-blue-400">{config.anaglyphTargetLevel}%</span>
                      </div>
                      <Slider
                        value={[config.anaglyphTargetLevel]}
                        min={20} max={100} step={5}
                        onValueChange={(vals) => {
                          const val = Array.isArray(vals) ? vals[0] : vals;
                          setConfig(c => ({ ...c, anaglyphTargetLevel: val }));
                        }}
                      />
                      <p className="text-sm text-slate-400">
                        Turn this down until the targets stop showing as grey outlines through the
                        scenery lens. This is the strongest fix for ghosting.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <label className="text-base font-medium">Scenery brightness</label>
                        <span className="text-sm text-blue-400">{config.anaglyphSceneLevel}%</span>
                      </div>
                      <Slider
                        value={[config.anaglyphSceneLevel]}
                        min={20} max={100} step={5}
                        onValueChange={(vals) => {
                          const val = Array.isArray(vals) ? vals[0] : vals;
                          setConfig(c => ({ ...c, anaglyphSceneLevel: val }));
                        }}
                      />
                      <p className="text-sm text-slate-400">
                        Lower this if the scenery bleeds through the target lens instead.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <ColorField
                        label="Target colour"
                        hint="Targets the training eye must find — red by default."
                        value={config.anaglyphTarget}
                        onChange={(hex) => setConfig(c => ({ ...c, anaglyphTarget: hex }))}
                      />
                      <ColorField
                        label="Scenery colour"
                        hint="Lines, grids and background the other eye sees — cyan by default."
                        value={config.anaglyphScene}
                        onChange={(hex) => setConfig(c => ({ ...c, anaglyphScene: hex }))}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-base font-medium">Starting points</label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ANAGLYPH_PRESETS.map(preset => {
                          const active = config.anaglyphTarget === preset.target && config.anaglyphScene === preset.scene;
                          return (
                            <button
                              key={preset.name}
                              onClick={() => setConfig(c => ({ ...c, anaglyphTarget: preset.target, anaglyphScene: preset.scene }))}
                              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'}`}
                            >
                              <span className="mt-0.5 flex shrink-0 gap-1">
                                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: preset.target }} />
                                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: preset.scene }} />
                              </span>
                              <span>
                                <span className="block text-sm font-medium text-slate-100">{preset.name}</span>
                                <span className="block text-sm text-slate-400">{preset.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setConfig(c => ({ ...c, anaglyphTarget: c.anaglyphScene, anaglyphScene: c.anaglyphTarget }))}
                      >
                        <ArrowLeftRight className="mr-2 h-4 w-4" /> Swap colours
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setConfig(c => ({
                          ...c,
                          anaglyphTarget: ANAGLYPH_TARGET_DEFAULT,
                          anaglyphScene: ANAGLYPH_SCENE_DEFAULT,
                          anaglyphTargetLevel: 100,
                          anaglyphSceneLevel: 100,
                        }))}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" /> Reset to classic
                      </Button>
                    </div>
                    <p className="text-sm text-slate-400">
                      Swap the colours if the glasses put the red lens over the other eye. To reuse
                      this calibration on another device, copy the hex values and brightness levels
                      across.
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-50">Profile Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    {AVATARS.map(av => (
                      <button
                        key={av}
                        onClick={() => setUser(u => ({...u, avatar: av}))}
                        className={`text-4xl h-16 w-16 flex items-center justify-center rounded-xl border-2 transition-all ${user.avatar === av ? 'border-blue-500 bg-blue-500/10' : 'border-transparent bg-slate-800 hover:bg-slate-700'}`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="text-sm text-slate-400 text-center italic">
                Disclaimer: This application is a training aid and should be used in conjunction with professional medical advice and treatment plans.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
