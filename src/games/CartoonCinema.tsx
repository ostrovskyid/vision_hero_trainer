import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GameHud } from '../GameHud';
import { playSound, scaleColor } from '../feedback';
import { GameProps, StartOverlay, finishSession } from './common';

/**
 * Passive dichoptic viewing, the idea behind clinically tested cartoon-based
 * amblyopia treatment. A looping cartoon (rocket launch, metro ride, night
 * flight) is drawn once per eye:
 *
 * - the target-colour eye (the weaker eye, behind the target filter) gets the
 *   full picture;
 * - the scenery-colour eye (the stronger eye) gets a dimmer copy, with soft
 *   holes that drift across it, so parts of the story are only visible to the
 *   weaker eye.
 *
 * Stars pop up now and then; tapping one shows the child is still watching.
 * Without anaglyph mode it plays as an ordinary full-colour cartoon.
 */

/** Maps a scene colour to what one layer should draw. */
type Paint = (hex: string) => string;

const SCENE_SECONDS = 40;

const luminance = (hex: string) => {
  const v = parseInt(hex.replace('#', ''), 16);
  return (0.3 * ((v >> 16) & 255) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255)) / 255;
};

/** A single-hue layer: every colour becomes the eye's colour at its brightness. */
const eyePaint = (eyeColor: string, gain: number): Paint => {
  const cache = new Map<string, string>();
  return (hex) => {
    let out = cache.get(hex);
    if (!out) {
      out = scaleColor(eyeColor, gain * (0.08 + 0.92 * luminance(hex)));
      cache.set(hex, out);
    }
    return out;
  };
};

const fullColour: Paint = (hex) => hex;

// Fixed star field, so the sky does not flicker between frames.
const SKY_STARS = Array.from({ length: 60 }, (_, i) => ({
  x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
  y: (Math.sin(i * 78.233) * 12345.678) % 1,
  r: 0.6 + ((i * 7) % 5) * 0.3,
})).map(s => ({ x: Math.abs(s.x), y: Math.abs(s.y) * 0.7, r: s.r }));

const BUILDINGS = Array.from({ length: 14 }, (_, i) => ({
  x: i / 14,
  w: 0.055 + ((i * 37) % 5) * 0.006,
  h: 0.18 + ((i * 53) % 7) * 0.035,
}));

const drawSky = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, paint: Paint, color: string) => {
  ctx.fillStyle = paint(color);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = paint('#e2e8f0');
  for (const [i, s] of SKY_STARS.entries()) {
    const twinkle = 0.6 + 0.4 * Math.sin(t * 2 + i);
    ctx.globalAlpha = twinkle;
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r * Math.max(1, w / 900), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const drawCity = (ctx: CanvasRenderingContext2D, w: number, h: number, offset: number, paint: Paint) => {
  const base = h * 0.8;
  for (const b of BUILDINGS) {
    const x = (((b.x - offset) % 1) + 1) % 1 * w * 1.1 - w * 0.05;
    const bw = b.w * w;
    const bh = b.h * h;
    ctx.fillStyle = paint('#334155');
    ctx.fillRect(x, base - bh, bw, bh);
    ctx.fillStyle = paint('#fde047');
    for (let wy = base - bh + 8; wy < base - 10; wy += 16) {
      for (let wx = x + 5; wx < x + bw - 8; wx += 12) {
        if ((Math.floor(wx) + Math.floor(wy)) % 3 !== 0) ctx.fillRect(wx, wy, 5, 7);
      }
    }
  }
};

const drawRocketScene = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, paint: Paint) => {
  drawSky(ctx, w, h, t, paint, '#0b1030');
  const u = Math.min(w, h);
  // Ringed planet.
  ctx.fillStyle = paint('#f59e0b');
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.22, u * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = paint('#fcd34d');
  ctx.lineWidth = u * 0.012;
  ctx.beginPath();
  ctx.ellipse(w * 0.8, h * 0.22, u * 0.14, u * 0.035, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  // Ground and launch pad.
  ctx.fillStyle = paint('#1e293b');
  ctx.fillRect(0, h * 0.88, w, h * 0.12);
  ctx.fillStyle = paint('#64748b');
  ctx.fillRect(w * 0.14, h * 0.84, u * 0.16, h * 0.04);

  // Countdown on the pad, lift-off, then a long looping flight to follow.
  let x: number, y: number, angle = 0;
  const padX = w * 0.14 + u * 0.08, padY = h * 0.84 - u * 0.09;
  if (t < 4) {
    x = padX + Math.sin(t * 40) * (t > 2.5 ? 1.5 : 0);
    y = padY;
  } else if (t < 10) {
    const k = (t - 4) / 6;
    x = padX;
    y = padY - k * k * (padY - h * 0.3);
  } else {
    // A slow figure of eight across the whole sky, eased in from the climb.
    const k = (t - 10) * 0.3;
    const fx = w * 0.5 - Math.cos(k) * w * 0.36 + (padX - w * 0.14);
    const fy = h * 0.42 - Math.sin(2 * k) * h * 0.2;
    const blend = Math.min(1, (t - 10) / 2);
    x = padX + (fx - padX) * blend;
    y = h * 0.3 + (fy - h * 0.3) * blend;
    const dx = Math.sin(k) * w * 0.36;
    const dy = -Math.cos(2 * k) * h * 0.4;
    angle = Math.atan2(dy, dx) + Math.PI / 2;
  }
  drawRocket(ctx, x, y, u * 0.09, angle, t, t >= 3, paint);
};

const drawRocket = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number, t: number, flame: boolean, paint: Paint) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (flame) {
    const f = 0.8 + 0.3 * Math.sin(t * 30);
    ctx.fillStyle = paint('#f97316');
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.9);
    ctx.lineTo(0, s * (0.9 + 0.9 * f));
    ctx.lineTo(s * 0.3, s * 0.9);
    ctx.fill();
    ctx.fillStyle = paint('#fde047');
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.9);
    ctx.lineTo(0, s * (0.9 + 0.5 * f));
    ctx.lineTo(s * 0.15, s * 0.9);
    ctx.fill();
  }
  // Fins.
  ctx.fillStyle = paint('#ef4444');
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, s * 0.3); ctx.lineTo(-s * 0.7, s * 0.95); ctx.lineTo(-s * 0.3, s * 0.85); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.35, s * 0.3); ctx.lineTo(s * 0.7, s * 0.95); ctx.lineTo(s * 0.3, s * 0.85); ctx.fill();
  // Body and nose.
  ctx.fillStyle = paint('#e5e7eb');
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.38, s * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paint('#ef4444');
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.55);
  ctx.quadraticCurveTo(0, -s * 1.35, s * 0.3, -s * 0.55);
  ctx.fill();
  // Window.
  ctx.fillStyle = paint('#38bdf8');
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawMetroScene = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, paint: Paint) => {
  drawSky(ctx, w, h, t, paint, '#111827');
  const u = Math.min(w, h);
  // Moon.
  ctx.fillStyle = paint('#f1f5f9');
  ctx.beginPath();
  ctx.arc(w * 0.15, h * 0.18, u * 0.06, 0, Math.PI * 2);
  ctx.fill();
  drawCity(ctx, w, h, t * 0.01, paint);
  // Viaduct and track.
  const trackY = h * 0.8;
  ctx.fillStyle = paint('#475569');
  ctx.fillRect(0, trackY, w, h * 0.03);
  for (let px = ((-t * 20) % 120 + 120) % 120 - 120; px < w; px += 120) {
    ctx.fillRect(px + 50, trackY, 14, h - trackY);
  }
  // A three-car train glides across, pauses at the station, and carries on.
  const lap = 16;
  const k = (t % lap) / lap;
  const trainLen = u * 0.75;
  const eased = k < 0.4 ? k / 0.4 * 0.5 : k < 0.55 ? 0.5 : 0.5 + (k - 0.55) / 0.45 * 0.5;
  const x = -trainLen + eased * (w + trainLen * 2) - trainLen * 0.5;
  const carW = trainLen / 3 - 6;
  const carH = u * 0.1;
  for (let i = 0; i < 3; i++) {
    const cx = x + i * (carW + 6);
    ctx.fillStyle = paint('#ef4444');
    ctx.beginPath();
    ctx.roundRect(cx, trackY - carH - 8, carW, carH, 10);
    ctx.fill();
    ctx.fillStyle = paint('#bae6fd');
    for (let j = 0; j < 3; j++) ctx.fillRect(cx + 10 + j * (carW - 20) / 3, trackY - carH, (carW - 20) / 3 - 8, carH * 0.35);
    ctx.fillStyle = paint('#0f172a');
    for (const wx of [cx + carW * 0.2, cx + carW * 0.8]) {
      ctx.beginPath();
      ctx.arc(wx, trackY - 6, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Station sign.
  ctx.fillStyle = paint('#22c55e');
  ctx.beginPath();
  ctx.arc(w * 0.5, trackY - carH - u * 0.12, u * 0.04, 0, Math.PI * 2);
  ctx.fill();
};

const drawPlaneScene = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, paint: Paint) => {
  drawSky(ctx, w, h, t, paint, '#0c1a3a');
  const u = Math.min(w, h);
  drawCity(ctx, w, h, t * 0.03, paint);
  // Clouds drift the other way.
  ctx.fillStyle = paint('#64748b');
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 0.3 + 1 - (t * 0.02) % 1) % 1.2) * w - w * 0.1;
    const cy = h * (0.2 + (i % 2) * 0.2);
    for (const [dx, dy, r] of [[0, 0, 1], [0.9, -0.3, 0.8], [1.6, 0.1, 0.7], [-0.8, 0.15, 0.6]]) {
      ctx.beginPath();
      ctx.arc(cx + dx * u * 0.05, cy + dy * u * 0.05, r * u * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The plane swoops in a slow figure of eight.
  const k = t * 0.3;
  const x = w * 0.5 + Math.sin(k) * w * 0.35;
  const y = h * 0.42 + Math.sin(k * 2) * h * 0.14;
  const dir = Math.cos(k) >= 0 ? 1 : -1;
  const s = u * 0.11;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.rotate(Math.cos(k * 2) * 0.25);
  ctx.fillStyle = paint('#94a3b8');
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, 0); ctx.lineTo(-s * 0.5, s * 0.7); ctx.lineTo(-s * 0.25, s * 0.7); ctx.lineTo(s * 0.3, 0); ctx.fill();
  ctx.fillStyle = paint('#e5e7eb');
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paint('#3b82f6');
  ctx.beginPath();
  ctx.moveTo(-s * 0.85, 0); ctx.lineTo(-s * 1.05, -s * 0.5); ctx.lineTo(-s * 0.7, -s * 0.5); ctx.lineTo(-s * 0.5, 0); ctx.fill();
  ctx.fillStyle = paint('#38bdf8');
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(-s * 0.3 + i * s * 0.22, -s * 0.03, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const SCENES = [drawRocketScene, drawMetroScene, drawPlaneScene];

const drawScene = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, paint: Paint) => {
  const index = Math.floor(t / SCENE_SECONDS) % SCENES.length;
  const local = t % SCENE_SECONDS;
  SCENES[index](ctx, w, h, local, paint);
  // Fade through black between scenes.
  const edge = Math.min(local, SCENE_SECONDS - local);
  if (edge < 0.8) {
    ctx.fillStyle = `rgba(0,0,0,${1 - edge / 0.8})`;
    ctx.fillRect(0, 0, w, h);
  }
};

interface Star { x: number; y: number; born: number; }

const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
};

const STAR_LIFE = 5;

export const CartoonCinema = ({ config, onComplete }: GameProps) => {
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starRef = useRef<Star | null>(null);
  const clockRef = useRef(0);
  const scoreRef = useRef(0);
  const starsRef = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // One offscreen layer per eye, combined additively onto the visible canvas.
    const layerA = document.createElement('canvas');
    const layerB = document.createElement('canvas');
    const ctxA = layerA.getContext('2d')!;
    const ctxB = layerB.getContext('2d')!;

    let width = 0, height = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      for (const c of [canvas, layerA, layerB]) {
        c.width = Math.max(1, Math.round(width * dpr));
        c.height = Math.max(1, Math.round(height * dpr));
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Paint functions cache their colours, so keep them across frames.
    const paints = new Map<string, Paint>();
    const paintFor = (color: string, gain: number) => {
      const key = `${color}:${gain}`;
      let p = paints.get(key);
      if (!p) { p = eyePaint(color, gain); paints.set(key, p); }
      return p;
    };

    let nextStarAt = 6;
    let last = performance.now();
    let lastHud = 0;
    let frame = 0;
    let done = false;

    const tick = (now: number) => {
      // Cap the step so a backgrounded tab does not skip the show forward.
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      clockRef.current += dt;
      const t = clockRef.current;
      const cfg = configRef.current;

      if (!starRef.current && t >= nextStarAt) {
        starRef.current = { x: 0.12 + Math.random() * 0.76, y: 0.15 + Math.random() * 0.6, born: t };
        starsRef.current += 1;
      }
      if (starRef.current && t - starRef.current.born > STAR_LIFE) {
        starRef.current = null;
        nextStarAt = t + 6 + Math.random() * 8;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (cfg.anaglyphMode) {
        ctxA.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctxB.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawScene(ctxA, width, height, t, paintFor(cfg.anaglyphTarget, 1));
        drawScene(ctxB, width, height, t, paintFor(cfg.anaglyphScene, cfg.cinemaFellowLevel / 100));
        // Soft drifting holes in the strong eye's picture.
        ctxB.globalCompositeOperation = 'destination-out';
        const r = Math.min(width, height) * 0.22;
        for (let i = 0; i < 3; i++) {
          const bx = width * (0.5 + 0.38 * Math.sin(t * 0.13 + i * 2.1));
          const by = height * (0.5 + 0.34 * Math.cos(t * 0.11 + i * 1.7));
          const g = ctxB.createRadialGradient(bx, by, 0, bx, by, r);
          g.addColorStop(0, 'rgba(0,0,0,1)');
          g.addColorStop(0.6, 'rgba(0,0,0,0.85)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctxB.fillStyle = g;
          ctxB.fillRect(bx - r, by - r, r * 2, r * 2);
        }
        ctxB.globalCompositeOperation = 'source-over';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(layerA, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(layerB, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        drawScene(ctx, width, height, t, fullColour);
      }

      const star = starRef.current;
      if (star) {
        const age = t - star.born;
        const pop = Math.min(1, age * 3);
        const r = Math.max(28, cfg.size * 0.8) * pop * (1 + 0.12 * Math.sin(age * 6));
        // In anaglyph mode only the weaker eye can see the star.
        drawStar(ctx, star.x * width, star.y * height, r, cfg.anaglyphMode ? cfg.anaglyphTarget : '#facc15');
      }

      const left = Math.max(0, cfg.duration - t);
      if (now - lastHud > 250) {
        lastHud = now;
        setTimeLeft(left);
        setScore(scoreRef.current);
      }
      if (left <= 0 && !done) {
        done = true;
        finishSession(cfg, scoreRef.current, starsRef.current, completeRef.current);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [started]);

  const handleTap = (e: PointerEvent<HTMLCanvasElement>) => {
    const star = starRef.current;
    const canvas = canvasRef.current;
    if (!star || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const r = Math.max(28, config.size * 0.8);
    // Generous hit area: this is an "are you watching?" check, not a precision task.
    if (Math.hypot(x - star.x * rect.width, y - star.y * rect.height) < r * 1.8) {
      starRef.current = null;
      scoreRef.current += 1;
      setScore(scoreRef.current);
      playSound('hit', config.soundEnabled);
    }
  };

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border-4 border-slate-800 bg-black">
      {!started && (
        <StartOverlay
          label="Start the Show"
          hint={config.anaglyphMode ? 'Put on your 3D glasses, watch the cartoon and tap the stars!' : 'Watch the cartoon and tap the stars!'}
          onStart={() => setStarted(true)}
        />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" onPointerDown={handleTap} />
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />
    </div>
  );
};
