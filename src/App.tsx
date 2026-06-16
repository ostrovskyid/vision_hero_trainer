import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, Plane, Rocket, Train, Bus, Truck, Bike, Ship, 
  Trophy, Play, Settings, ChevronLeft, Zap, Volume2, VolumeX, Eye, Maximize, Minimize,
  Radar, CloudFog, ShieldAlert, Crosshair, Target
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GameMode, GameConfig, UserProfile, GameStats } from './types';
import { DEFAULT_CONFIG, AVATARS, DIFFICULTY_PRESETS } from './constants';

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
      className="relative w-full h-[75vh] min-h-[500px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800 cursor-crosshair"
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
            <Rocket className={`w-full h-full ${config.anaglyphMode ? 'text-[#FF0000] fill-[#FF0000]' : 'text-blue-400 fill-blue-400'} drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]`} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{ width: Math.random() * 3, height: Math.random() * 3, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, backgroundColor: config.anaglyphMode ? '#00FFFF' : '#FFFFFF' }} />
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
      className="relative w-full h-[75vh] min-h-[500px] bg-slate-400 rounded-xl overflow-hidden border-4 border-slate-800"
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

      <div className={`absolute inset-0 ${config.anaglyphMode ? 'bg-[#00FFFF]/30' : 'bg-slate-300/50 backdrop-blur-sm'}`} />

      {target && isPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: currentContrast / 100, rotate: target.rotation, scale: target.scale }}
          className="absolute cursor-pointer -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${target.x}%`, top: `${target.y}%`, width: config.size, height: config.size }}
          onClick={handleHit}
        >
          <target.icon className={`w-full h-full ${config.anaglyphMode ? 'text-[#FF0000]' : 'text-slate-600'}`} />
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
    <div className="relative w-full h-[75vh] min-h-[500px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800 flex items-center justify-center">
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
            className={`${config.difficulty === 'hard' ? 'w-20 h-20 md:w-24 md:h-24' : 'w-24 h-24 md:w-32 md:h-32'} rounded-2xl flex items-center justify-center transition-colors ${config.anaglyphMode ? 'bg-[#00FFFF]/20 hover:bg-[#00FFFF]/30' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <item.icon className={`${config.difficulty === 'hard' ? 'w-10 h-10 md:w-12 md:h-12' : 'w-12 h-12 md:w-16 md:h-16'} ${config.anaglyphMode ? 'text-[#FF0000]' : 'text-orange-400'}`} />
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
      className="relative w-full h-[75vh] min-h-[500px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800"
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
          <Car className={`w-full h-full ${config.anaglyphMode ? 'text-[#FF0000]' : targetPos.color}`} />
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
      className="relative w-full h-[75vh] min-h-[500px] bg-slate-950 rounded-xl overflow-hidden border-4 border-slate-800 cursor-crosshair"
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
          <Radar className={`w-full h-full ${config.anaglyphMode ? 'text-[#FF0000]' : 'text-green-400'}`} />
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
    <div className="relative w-full h-[75vh] min-h-[500px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800 flex items-center justify-center">
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
            className={`${config.difficulty === 'hard' ? 'w-20 h-20 md:w-24 md:h-24' : 'w-24 h-24 md:w-32 md:h-32'} rounded-2xl flex items-center justify-center transition-colors ${config.anaglyphMode ? 'bg-[#00FFFF]/20 hover:bg-[#00FFFF]/30' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <CloudFog className={`${config.difficulty === 'hard' ? 'w-10 h-10 md:w-12 md:h-12' : 'w-12 h-12 md:w-16 md:h-16'} ${config.anaglyphMode ? 'text-[#FF0000]' : 'text-yellow-400'} ${item.isTarget ? targetOpacity : 'opacity-100'}`} />
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
      className="relative w-full h-[75vh] min-h-[500px] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-800 flex flex-col items-center justify-center"
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
            {React.createElement(targetIcon, { className: "w-12 h-12 text-blue-400" })}
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
              {React.createElement(currentIcon, { className: `w-16 h-16 ${config.anaglyphMode ? 'text-[#FF0000]' : 'text-slate-100'}` })}
            </motion.button>
            <span className="text-slate-400">Tap if it matches the target!</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [screen, setScreen] = useState<'home' | 'game' | 'settings' | 'stats'>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>('tracking');
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
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
        checkpoint: parsed?.stats?.checkpoint || []
      }
    };
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    localStorage.setItem('eyequest_user', JSON.stringify(user));
  }, [user]);

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
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              {user.avatar}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Vision Express</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Level {user.level}</span>
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

        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <Card className="relative bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group overflow-hidden" onClick={() => { setSelectedMode('tracking'); setScreen('game'); }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Rocket className="h-6 w-6 text-blue-500" />
                  </div>
                  <CardTitle className="text-slate-50">Rocket Tracker</CardTitle>
                  <CardDescription className="text-slate-400">Improve eye tracking by following the moving rocket.</CardDescription>
                </CardHeader>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
              </Card>

              <Card className="relative bg-slate-900 border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer group overflow-hidden" onClick={() => { setSelectedMode('contrast'); setScreen('game'); }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Plane className="h-6 w-6 text-purple-500" />
                  </div>
                  <CardTitle className="text-slate-50">Foggy Flight</CardTitle>
                  <CardDescription className="text-slate-400">Train contrast sensitivity by finding planes in the fog.</CardDescription>
                </CardHeader>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
              </Card>

              <Card className="relative bg-slate-900 border-slate-800 hover:border-orange-500/50 transition-all cursor-pointer group overflow-hidden" onClick={() => { setSelectedMode('detail'); setScreen('game'); }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Car className="h-6 w-6 text-orange-500" />
                  </div>
                  <CardTitle className="text-slate-50">Traffic Jam</CardTitle>
                  <CardDescription className="text-slate-400">Sharpen focus by finding the odd vehicle out.</CardDescription>
                </CardHeader>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
              </Card>

              <Card className="relative bg-slate-900 border-slate-800 hover:border-red-500/50 transition-all cursor-pointer group overflow-hidden" onClick={() => { setSelectedMode('saccades'); setScreen('game'); }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Train className="h-6 w-6 text-red-500" />
                  </div>
                  <CardTitle className="text-slate-50">Speedway Saccades</CardTitle>
                  <CardDescription className="text-slate-400">Train rapid eye movement by alternating focus between targets.</CardDescription>
                </CardHeader>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
              </Card>

              <Card className="relative bg-slate-900 border-slate-800 hover:border-green-500/50 transition-all cursor-pointer group overflow-hidden" onClick={() => { setSelectedMode('peripheral'); setScreen('game'); }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Radar className="h-6 w-6 text-green-500" />
                  </div>
                  <CardTitle className="text-slate-50">Peripheral Patrol</CardTitle>
                  <CardDescription className="text-slate-400">Expand your visual field by detecting targets at the edges.</CardDescription>
                </CardHeader>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
              </Card>

              <Card className="relative bg-slate-900 border-slate-800 hover:border-yellow-500/50 transition-all cursor-pointer group overflow-hidden" onClick={() => { setSelectedMode('spotter'); setScreen('game'); }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <CloudFog className="h-6 w-6 text-yellow-500" />
                  </div>
                  <CardTitle className="text-slate-50">Foggy Spotter</CardTitle>
                  <CardDescription className="text-slate-400">Train contrast sensitivity by finding the faded shape.</CardDescription>
                </CardHeader>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
              </Card>

              <Card className="relative bg-slate-900 border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group overflow-hidden md:col-span-2" onClick={() => { setSelectedMode('checkpoint'); setScreen('game'); }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <ShieldAlert className="h-6 w-6 text-cyan-500" />
                  </div>
                  <CardTitle className="text-slate-50">Checkpoint</CardTitle>
                  <CardDescription className="text-slate-400">Improve visual discrimination and reaction time.</CardDescription>
                </CardHeader>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
              </Card>

            </motion.div>
          )}

          {screen === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setScreen('home')}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back to Base
                </Button>
                <Badge className="bg-blue-600">
                  {selectedMode === 'tracking' && 'Tracking Exercise'}
                  {selectedMode === 'contrast' && 'Contrast Training'}
                  {selectedMode === 'detail' && 'Detail Focus'}
                  {selectedMode === 'saccades' && 'Saccadic Movement'}
                  {selectedMode === 'peripheral' && 'Peripheral Awareness'}
                  {selectedMode === 'spotter' && 'Contrast Sensitivity'}
                  {selectedMode === 'checkpoint' && 'Visual Discrimination'}
                </Badge>
              </div>

              {selectedMode === 'tracking' && <RocketTracker config={config} onComplete={handleGameComplete} />}
              {selectedMode === 'contrast' && <FoggyFlight config={config} onComplete={handleGameComplete} />}
              {selectedMode === 'detail' && <TrafficJam config={config} onComplete={handleGameComplete} />}
              {selectedMode === 'saccades' && <SpeedwaySaccades config={config} onComplete={handleGameComplete} />}
              {selectedMode === 'peripheral' && <PeripheralPatrol config={config} onComplete={handleGameComplete} />}
              {selectedMode === 'spotter' && <FoggySpotter config={config} onComplete={handleGameComplete} />}
              {selectedMode === 'checkpoint' && <Checkpoint config={config} onComplete={handleGameComplete} />}
              
              <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-4 items-start">
                <div className="p-2 bg-blue-500/20 rounded-full">
                  <Eye className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-400">Pro Tip</h4>
                  <p className="text-sm text-slate-400">Make sure to wear your patch on the strong eye as directed by your doctor for best results!</p>
                </div>
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
                  <div className="text-xs text-slate-500 uppercase">Experience</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="text-2xl font-bold text-purple-400">{user.stats[selectedMode].slice(-1)[0]?.score}</div>
                  <div className="text-xs text-slate-500 uppercase">Score</div>
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
                    <label className="text-sm font-medium">Difficulty Level</label>
                    <div className="grid grid-cols-3 gap-2">
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
                      <label className="text-sm font-medium">Movement Speed</label>
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
                      <label className="text-sm font-medium">Target Size (px)</label>
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
                      <label className="text-sm font-medium">Session Duration (s)</label>
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
                      <label className="text-sm font-medium">Sound Effects</label>
                      <p className="text-xs text-slate-500">Enable or disable game sounds.</p>
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
                      <label className="text-sm font-medium">Anaglyph Mode (Red/Cyan)</label>
                      <p className="text-xs text-slate-500">Enable if you have Red/Cyan glasses for dichoptic training.</p>
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
                        className={`text-3xl p-3 rounded-xl border-2 transition-all ${user.avatar === av ? 'border-blue-500 bg-blue-500/10' : 'border-transparent bg-slate-800 hover:bg-slate-700'}`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="text-xs text-slate-500 text-center italic">
                Disclaimer: This application is a training aid and should be used in conjunction with professional medical advice and treatment plans.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
