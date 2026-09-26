import { useRef, useState, type PointerEvent } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useElementSize, useLater, sceneColor, tintStyle, pick } from './common';
import { RescuePup, pupName } from '../pups';
import { t } from '../i18n';

/**
 * The recycling pup's sorting yard: rubbish arrives on the belt and the child
 * drags each piece into the right bin, green for glass, blue for paper and
 * yellow for plastic (the colours of the bins at home). Steering a finger to a
 * target trains eye-hand control; telling a jar from a bottle from a cup
 * trains looking at shape. A tap on a bin works too, for small hands.
 */

type Kind = 'glass' | 'paper' | 'plastic';

const BINS: Record<Kind, { color: string; icon: string; name: string }> = {
  glass: { color: '#16a34a', icon: '🍾', name: 'glass' },
  paper: { color: '#2563eb', icon: '📰', name: 'paper' },
  plastic: { color: '#eab308', icon: '🧴', name: 'plastic' },
};

const ITEMS: Record<Kind, string[]> = {
  glass: ['🍾', '🫙', '🍷', '🥛'],
  paper: ['📰', '📦', '✉️', '📄', '📚'],
  plastic: ['🧴', '🥤', '🪣', '🧃'],
};

const LEVELS = {
  easy: { kinds: ['paper', 'plastic'] as Kind[] },
  medium: { kinds: ['glass', 'paper', 'plastic'] as Kind[] },
  hard: { kinds: ['glass', 'paper', 'plastic'] as Kind[] },
} as const;

export const RecyclingSort = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const name = pupName(config, 'recycle');
  const [areaRef, size] = useElementSize<HTMLDivElement>();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [item, setItem] = useState<{ kind: Kind; emoji: string; id: number }>({ kind: 'paper', emoji: '📰', id: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [sorted, setSorted] = useState<Kind | null>(null);
  const [wrong, setWrong] = useState<Kind | null>(null);
  const binRefs = useRef<Partial<Record<Kind, HTMLDivElement | null>>>({});
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, tries), onComplete);
  });

  const nextItem = () => {
    const kind = pick(level.kinds);
    setItem(prev => ({ kind, emoji: pick(ITEMS[kind]), id: prev.id + 1 }));
    setSorted(null);
    setDrag(null);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    nextItem();
    speak(t('Help {name} sort the rubbish! Drag each thing into the right bin.', { name }), config.voiceEnabled);
  };

  const choose = (bin: Kind) => {
    if (!isPlaying || sorted) return;
    setTries(n => n + 1);
    if (bin === item.kind) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      setSorted(bin);
      setDrag(null);
      later(nextItem, 700);
    } else {
      playSound('miss', config.soundEnabled);
      setWrong(bin);
      setDrag(null);
      later(() => setWrong(null), 400);
      speak(t(`That goes in the ${BINS[item.kind].name} bin.`), config.voiceEnabled);
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (sorted) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setDrag({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    const hit = level.kinds.find(k => {
      const r = binRefs.current[k]?.getBoundingClientRect();
      return r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (hit) choose(hit);
    else setDrag(null);
  };

  // Bins fill the bottom of the play area; the item is a little smaller on hard.
  const binSize = Math.max(96, Math.min((size.width - 64) / (level.kinds.length + 0.6), size.height * 0.34));
  const itemSize = binSize * (config.difficulty === 'hard' ? 0.5 : 0.62);
  const belt = sceneColor(config, '#475569');

  return (
    <div className="relative h-full min-h-[420px] w-full touch-none overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950">
      {!started && (
        <StartOverlay label={t('Open the Yard')} hint={t('Drag each thing into the bin of the same colour!')} onStart={start}>
          <RescuePup role="recycle" size={110} style={tintStyle(config, 'target')} />
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      <div ref={areaRef} className="absolute inset-0 flex flex-col items-center justify-between pb-12 pt-14">
        {started && size.width > 0 && (
          <>
            {/* The belt with the next piece of rubbish (target eye). */}
            <div className="relative flex w-full items-center justify-center" style={{ height: itemSize * 1.5 }}>
              <div className="absolute left-[8%] right-[8%] rounded-full" style={{ bottom: 0, height: 14, backgroundColor: belt }} />
              <div className="absolute left-[3%] bottom-0">
                <RescuePup role="recycle" size={Math.min(96, itemSize * 1.2)} style={tintStyle(config, 'target')} />
              </div>
              {!sorted && (
                <motion.div
                  key={item.id}
                  className="relative z-10"
                  initial={{ x: -size.width / 2, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                <div
                  className="flex cursor-grab items-center justify-center"
                  style={{ width: itemSize * 1.3, height: itemSize * 1.3, transform: drag ? `translate(${drag.x}px, ${drag.y}px) scale(1.1)` : undefined }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={() => { dragStart.current = null; setDrag(null); }}
                  role="img"
                  aria-label={item.emoji}
                >
                  <span className="leading-none" style={{ fontSize: itemSize, ...tintStyle(config, 'target') }}>{item.emoji}</span>
                </div>
                </motion.div>
              )}
            </div>

            {/* The bins (scenery), each showing what goes in it. */}
            <div className="flex items-end justify-center" style={{ gap: binSize * 0.18 }}>
              {level.kinds.map(k => (
                <motion.div
                  key={k}
                  ref={el => { binRefs.current[k] = el; }}
                  role="button"
                  aria-label={t(`${BINS[k].name} bin`)}
                  onClick={() => choose(k)}
                  animate={wrong === k ? { x: [-8, 8, -8, 8, 0] } : sorted === k ? { y: [0, -14, 0] } : { x: 0, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="relative flex cursor-pointer flex-col items-center justify-start rounded-b-2xl rounded-t-md pt-3"
                  style={{ width: binSize, height: binSize * 1.15, backgroundColor: sceneColor(config, BINS[k].color) }}
                >
                  <div className="absolute -top-2 left-[-4%] right-[-4%] h-4 rounded-md" style={{ backgroundColor: sceneColor(config, BINS[k].color), filter: 'brightness(0.8)' }} />
                  <span className="mt-2 flex items-center justify-center rounded-full bg-white/90 leading-none" style={{ width: binSize * 0.55, height: binSize * 0.55, fontSize: binSize * 0.34 }}>
                    {BINS[k].icon}
                  </span>
                  {sorted === k && (
                    <motion.span
                      className="absolute leading-none"
                      style={{ top: -itemSize * 0.8, fontSize: itemSize * 0.8, ...tintStyle(config, 'target') }}
                      initial={{ y: -40, opacity: 1 }}
                      animate={{ y: itemSize * 0.8, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    >
                      {item.emoji}
                    </motion.span>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
