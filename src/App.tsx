import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Plane, Rocket, Train, Bus, Truck, Bike, Ship,
  Trophy, Play, Settings, ChevronLeft, Zap, Volume2, VolumeX, Eye, Maximize, Minimize,
  Radar, CloudFog, ShieldAlert, Crosshair, Target,
  TrainFront, MapPin, Route, TramFront, Brain, Palette, ArrowLeftRight, RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GameMode, GameConfig, UserProfile, GameStats } from './types';
import {
  DEFAULT_CONFIG, AVATARS, DIFFICULTY_PRESETS,
  ANAGLYPH_PRESETS, ANAGLYPH_TARGET_DEFAULT, ANAGLYPH_SCENE_DEFAULT,
} from './constants';
import { GamePreview } from './GamePreview';

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
}[] = [
  { mode: 'tracking', title: 'Rocket Tracker', description: 'Follow the flying rocket with your eyes.', Icon: Rocket, iconClass: 'text-blue-400', chipClass: 'bg-blue-500/10', hoverClass: 'hover:border-blue-500/60', barClass: 'bg-blue-500' },
  { mode: 'contrast', title: 'Foggy Flight', description: 'Find the planes hiding in the fog.', Icon: Plane, iconClass: 'text-purple-400', chipClass: 'bg-purple-500/10', hoverClass: 'hover:border-purple-500/60', barClass: 'bg-purple-500' },
  { mode: 'detail', title: 'Traffic Jam', description: 'Spot the one vehicle that is different.', Icon: Car, iconClass: 'text-orange-400', chipClass: 'bg-orange-500/10', hoverClass: 'hover:border-orange-500/60', barClass: 'bg-orange-500' },
  { mode: 'saccades', title: 'Speedway Saccades', description: 'Catch the car as it jumps side to side.', Icon: Train, iconClass: 'text-red-400', chipClass: 'bg-red-500/10', hoverClass: 'hover:border-red-500/60', barClass: 'bg-red-500' },
  { mode: 'peripheral', title: 'Peripheral Patrol', description: 'Look straight ahead and catch the edges.', Icon: Radar, iconClass: 'text-green-400', chipClass: 'bg-green-500/10', hoverClass: 'hover:border-green-500/60', barClass: 'bg-green-500' },
  { mode: 'spotter', title: 'Foggy Spotter', description: 'Find the one shape that has faded away.', Icon: CloudFog, iconClass: 'text-yellow-400', chipClass: 'bg-yellow-500/10', hoverClass: 'hover:border-yellow-500/60', barClass: 'bg-yellow-500' },
  { mode: 'checkpoint', title: 'Checkpoint', description: 'Tap only the vehicle that matches.', Icon: ShieldAlert, iconClass: 'text-cyan-400', chipClass: 'bg-cyan-500/10', hoverClass: 'hover:border-cyan-500/60', barClass: 'bg-cyan-500' },
  { mode: 'metro', title: 'Metro Tracker', description: 'Follow the train along the metro line.', Icon: TrainFront, iconClass: 'text-rose-400', chipClass: 'bg-rose-500/10', hoverClass: 'hover:border-rose-500/60', barClass: 'bg-rose-500' },
  { mode: 'station', title: 'Station Hunt', description: 'Find the right station letter.', Icon: MapPin, iconClass: 'text-emerald-400', chipClass: 'bg-emerald-500/10', hoverClass: 'hover:border-emerald-500/60', barClass: 'bg-emerald-500' },
  { mode: 'navigator', title: 'Line Navigator', description: 'Follow one line to the right station.', Icon: Route, iconClass: 'text-indigo-400', chipClass: 'bg-indigo-500/10', hoverClass: 'hover:border-indigo-500/60', barClass: 'bg-indigo-500' },
  { mode: 'crossing', title: 'Railway Crossing', description: 'Tap the trains and let the cars pass.', Icon: TramFront, iconClass: 'text-sky-400', chipClass: 'bg-sky-500/10', hoverClass: 'hover:border-sky-500/60', barClass: 'bg-sky-500' },
  { mode: 'memory', title: 'Metro Memory', description: 'Remember the route and tap it back.', Icon: Brain, iconClass: 'text-fuchsia-400', chipClass: 'bg-fuchsia-500/10', hoverClass: 'hover:border-fuchsia-500/60', barClass: 'bg-fuchsia-500' },
];

const CONFIG_STORAGE_KEY = 'eyequest_config';
const DISPLAY_STORAGE_KEY = 'eyequest_display';

/**
 * Scales a colour's brightness. Cheap cyan filters never block red completely,
 * so a full-intensity red still ghosts through as a grey outline; dimming the
 * target is the most effective lever the software has against that.
 */
const scaleColor = (hex: string, factor: number) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const scale = (channel: number) => Math.round(Math.min(255, Math.max(0, channel * factor)));
  const r = scale((value >> 16) & 255);
  const g = scale((value >> 8) & 255);
  const b = scale(value & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;
};

/** Expands a #rrggbb colour to an rgba() string, for the translucent tints. */
const withAlpha = (hex: string, alpha: number) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const playSound = (type: 'hit' | 'miss' | 'complete', enabled: boolean) => {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'hit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'miss') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'complete') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

      <div className="absolute top-4 left-4 flex gap-4 z-20">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
        <Badge variant="outline" className="text-lg px-3 py-1 bg-black/40 text-white border-slate-700"><Zap className="mr-2 h-4 w-4 text-blue-500" /> {Math.ceil(timeLeft)}s</Badge>
      </div>

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

// --- Main App ---

export default function App() {
  const [screen, setScreen] = useState<'home' | 'game' | 'settings' | 'stats'>('home');
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
    const saved = localStorage.getItem('eyequest_user');
    const parsed = saved ? JSON.parse(saved) : null;
    return {
      name: parsed?.name || 'Hero',
      avatar: parsed?.avatar || '🚀',
      level: parsed?.level || 1,
      experience: parsed?.experience || 0,
      stats: {
        tracking: parsed?.stats?.tracking || [],
        contrast: parsed?.stats?.contrast || [],
        detail: parsed?.stats?.detail || [],
        saccades: parsed?.stats?.saccades || [],
        peripheral: parsed?.stats?.peripheral || [],
        spotter: parsed?.stats?.spotter || [],
        checkpoint: parsed?.stats?.checkpoint || [],
        metro: parsed?.stats?.metro || [],
        station: parsed?.stats?.station || [],
        navigator: parsed?.stats?.navigator || [],
        crossing: parsed?.stats?.crossing || [],
        memory: parsed?.stats?.memory || []
      }
    };
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calibrationTest, setCalibrationTest] = useState(false);

  // Brightness is folded in here so the settings screen keeps editing the base
  // colours while games and previews render the calibrated result.
  const renderConfig = useMemo<GameConfig>(() => ({
    ...config,
    anaglyphTarget: scaleColor(config.anaglyphTarget, config.anaglyphTargetLevel / 100),
    anaglyphScene: scaleColor(config.anaglyphScene, config.anaglyphSceneLevel / 100),
  }), [config]);

  useEffect(() => {
    localStorage.setItem('eyequest_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    const { anaglyphTarget, anaglyphScene, anaglyphTargetLevel, anaglyphSceneLevel, ...exerciseConfig } = config;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(exerciseConfig));
      // Kept under its own key: one calibration per device, set up once.
      localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify({
        anaglyphTarget, anaglyphScene, anaglyphTargetLevel, anaglyphSceneLevel,
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

  const handleGameComplete = (stats: GameStats) => {
    const statsWithDifficulty = { ...stats, difficulty: config.difficulty };
    setUser(prev => ({
      ...prev,
      experience: prev.experience + stats.score * 10,
      level: Math.floor((prev.experience + stats.score * 10) / 100) + 1,
      stats: {
        ...prev.stats,
        [selectedMode]: [...prev.stats[selectedMode], statsWithDifficulty]
      }
    }));
    setScreen('stats');
  };

  return (
    <div
      className={`bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 ${screen === 'game' ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
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
      <div className={`mx-auto ${screen === 'game' ? 'h-full max-w-none p-2 md:p-3 flex flex-col' : 'max-w-7xl p-4 md:p-8'}`}>

        {/* Header */}
        {screen !== 'game' && (
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              {user.avatar}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vision Express</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-300 uppercase tracking-wider">Level {user.level}</span>
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
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {GAME_TILES.map(tile => (
                <Card
                  key={tile.mode}
                  className={`relative bg-slate-900 border-slate-800 ${tile.hoverClass} transition-all cursor-pointer group overflow-hidden`}
                  onClick={() => { setSelectedMode(tile.mode); setScreen('game'); }}
                >
                  <CardHeader>
                    <GamePreview mode={tile.mode} />
                    <div className="mt-4 flex items-start gap-4">
                      <div className={`w-14 h-14 shrink-0 rounded-xl ${tile.chipClass} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <tile.Icon className={`h-8 w-8 ${tile.iconClass}`} />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-slate-50">{tile.title}</CardTitle>
                        <CardDescription className="mt-1 text-base text-slate-300">{tile.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${tile.barClass} transform translate-y-full group-hover:translate-y-0 transition-transform`} />
                </Card>
              ))}

              <div className="md:col-span-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-4 items-start">
                <div className="p-2 bg-blue-500/20 rounded-full">
                  <Eye className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-blue-400">Pro Tip</h4>
                  <p className="text-base text-slate-300">Make sure to wear your patch on the strong eye as directed by your doctor for best results!</p>
                </div>
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
                <Button variant="ghost" size="sm" onClick={() => setScreen('home')}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back to Base
                </Button>
                <div className="flex items-center gap-1">
                <Badge className="bg-blue-600">
                  {selectedMode === 'tracking' && 'Tracking Exercise'}
                  {selectedMode === 'contrast' && 'Contrast Training'}
                  {selectedMode === 'detail' && 'Detail Focus'}
                  {selectedMode === 'saccades' && 'Saccadic Movement'}
                  {selectedMode === 'peripheral' && 'Peripheral Awareness'}
                  {selectedMode === 'spotter' && 'Contrast Sensitivity'}
                  {selectedMode === 'checkpoint' && 'Visual Discrimination'}
                  {selectedMode === 'metro' && 'Smooth Pursuit'}
                  {selectedMode === 'station' && 'Acuity & Crowding'}
                  {selectedMode === 'navigator' && 'Visual Tracing'}
                  {selectedMode === 'crossing' && 'Pursuit & Attention'}
                  {selectedMode === 'memory' && 'Visual Memory'}
                </Badge>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Toggle Fullscreen">
                  {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
              {selectedMode === 'tracking' && <RocketTracker config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'contrast' && <FoggyFlight config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'detail' && <TrafficJam config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'saccades' && <SpeedwaySaccades config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'peripheral' && <PeripheralPatrol config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'spotter' && <FoggySpotter config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'checkpoint' && <Checkpoint config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'metro' && <MetroTracker config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'station' && <StationHunt config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'navigator' && <LineNavigator config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'crossing' && <RailwayCrossing config={renderConfig} onComplete={handleGameComplete} />}
              {selectedMode === 'memory' && <MetroMemory config={renderConfig} onComplete={handleGameComplete} />}
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
              <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="h-12 w-12 text-yellow-500" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Mission Accomplished!</h2>
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

              <Button size="lg" onClick={() => setScreen('home')} className="px-8">
                Continue Journey
              </Button>
            </motion.div>
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

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="space-y-0.5">
                      <label className="text-base font-medium">Anaglyph Mode (Red/Cyan)</label>
                      <p className="text-sm text-slate-400">Enable if you have Red/Cyan glasses for dichoptic training.</p>
                    </div>
                    <Button
                      variant={config.anaglyphMode ? "default" : "outline"}
                      onClick={() => setConfig(c => ({...c, anaglyphMode: !c.anaglyphMode}))}
                    >
                      {config.anaglyphMode ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
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
