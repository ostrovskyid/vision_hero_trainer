import { useState } from 'react';
import { motion } from 'motion/react';
import { GameHud } from '../GameHud';
import { playSound, speak } from '../feedback';
import { GameProps, StartOverlay, finishSession, useSessionTimer, useLater, tintStyle, sceneColor, shuffle } from './common';
import { t } from '../i18n';

/**
 * Pexeso (pairs memory). Turn two cards; a matching pair stays open. Harder
 * levels have more, smaller cards and look-alike vehicles (car / taxi / SUV,
 * bus / trolleybus / minibus), so each card has to be looked at closely as
 * well as remembered.
 */

const PLAIN = ['🚗', '🚌', '🚀', '✈️', '🚂', '🚁', '🚒', '🚜'];
const LOOK_ALIKES = ['🚗', '🚕', '🚙', '🚌', '🚎', '🚐', '✈️', '🛩️'];

const LEVELS = {
  easy: { pairs: 3, cols: 3, pool: PLAIN },
  medium: { pairs: 6, cols: 4, pool: PLAIN },
  hard: { pairs: 8, cols: 4, pool: LOOK_ALIKES },
} as const;

interface Card { id: number; emoji: string; matched: boolean }

export const VehiclePexeso = ({ config, onComplete }: GameProps) => {
  const level = LEVELS[config.difficulty];
  const later = useLater();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [turns, setTurns] = useState(0);
  const [deal, setDeal] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<number[]>([]);

  const timeLeft = useSessionTimer(config.duration, isPlaying, () => {
    setIsPlaying(false);
    finishSession(config, score, Math.max(1, turns), onComplete);
  });

  const newDeal = () => {
    const faces = shuffle(level.pool).slice(0, level.pairs);
    setCards(shuffle([...faces, ...faces]).map((emoji, id) => ({ id, emoji, matched: false })));
    setOpen([]);
    setDeal(d => d + 1);
  };

  const start = () => {
    setStarted(true);
    setIsPlaying(true);
    newDeal();
    speak(t('Turn two cards. Can you find the pairs?'), config.voiceEnabled);
  };

  const turn = (i: number) => {
    if (!isPlaying || open.length >= 2 || open.includes(i) || cards[i].matched) return;
    const now = [...open, i];
    setOpen(now);
    if (now.length < 2) return;
    setTurns(t => t + 1);
    const [a, b] = now;
    if (cards[a].emoji === cards[b].emoji) {
      playSound('hit', config.soundEnabled);
      setScore(s => s + 1);
      const next = cards.map((c, j) => (j === a || j === b ? { ...c, matched: true } : c));
      later(() => {
        setCards(next);
        setOpen([]);
        if (next.every(c => c.matched)) {
          playSound('honk', config.soundEnabled);
          speak(t('You found them all!'), config.voiceEnabled);
          later(newDeal, 1200);
        }
      }, 500);
    } else {
      // Not a pair: a moment to look, then both turn back. No points lost.
      later(() => setOpen([]), 1100);
    }
  };

  const cardSize = config.difficulty === 'hard' ? 76 : config.difficulty === 'medium' ? 90 : 110;
  const back = sceneColor(config, '#1e3a8a');

  return (
    <div className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-950 pb-8 pt-12">
      {!started && (
        <StartOverlay label={t('Deal the Cards')} hint={t('Turn two cards and find the pairs!')} onStart={start}>
          <div className="text-6xl" style={tintStyle(config, 'target')}>🃏</div>
        </StartOverlay>
      )}
      <GameHud score={score} timeLeft={timeLeft} duration={config.duration} />

      {started && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${level.cols}, ${cardSize}px)` }}>
          {cards.map((card, i) => {
            const faceUp = card.matched || open.includes(i);
            return (
              <motion.button
                key={`${deal}-${card.id}`}
                onClick={() => turn(i)}
                aria-label={faceUp ? card.emoji : t('Card')}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: faceUp ? 0 : 180, opacity: card.matched ? 0.55 : 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: cardSize, height: cardSize * 1.2,
                  backgroundColor: faceUp ? '#000000' : back,
                  border: `3px solid ${sceneColor(config, '#334155')}`,
                }}
              >
                {faceUp && (
                  <span className="leading-none" style={{ fontSize: cardSize * 0.55, ...tintStyle(config, 'target') }}>{card.emoji}</span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};
