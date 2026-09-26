import { motion } from 'motion/react';
import { ChevronLeft, Glasses, Minus, Play, Plus, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PatchRecord } from './types';
import { dayKey, formatMinutes, runningMinutes } from './therapy';

/**
 * Patch Pal: a patch-time companion. Wearing the patch for the prescribed time
 * matters more than anything else in amblyopia treatment, so the timer runs
 * on the wall clock (it keeps counting with the app closed) and the daily goal
 * earns a sticker, the same way a finished mission does.
 */

/** Today's minutes, including a timer that is still running. */
export const todayPatchMinutes = (patch: PatchRecord, now: number) => {
  const today = dayKey(now);
  const logged = patch.log[today] ?? 0;
  // A running session is credited to the day it started on.
  const running = patch.startedAt && dayKey(patch.startedAt) === today ? runningMinutes(patch.startedAt, now) : 0;
  return logged + running;
};

const Pirate = ({ size, patched }: { size: number; patched: boolean }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    {/* Head */}
    <circle cx="50" cy="56" r="34" fill="#fcd9b6" />
    {/* Bandana */}
    <path d="M16 48 Q18 18 50 16 Q82 18 84 48 Z" fill="#ef4444" />
    <circle cx="30" cy="30" r="3" fill="#fff" />
    <circle cx="48" cy="24" r="3" fill="#fff" />
    <circle cx="66" cy="30" r="3" fill="#fff" />
    {/* Glasses frames on both eyes, patch over the right eye (viewer's left) */}
    <circle cx="36" cy="56" r="11" fill="none" stroke="#1e293b" strokeWidth="3" />
    <circle cx="64" cy="56" r="11" fill="none" stroke="#1e293b" strokeWidth="3" />
    <path d="M47 56 H53" stroke="#1e293b" strokeWidth="3" />
    {patched ? (
      <>
        <path d="M18 44 L82 62" stroke="#0f172a" strokeWidth="3" />
        <ellipse cx="36" cy="56" rx="9.5" ry="9" fill="#0f172a" />
      </>
    ) : (
      <circle cx="36" cy="56" r="3.5" fill="#0f172a" />
    )}
    <circle cx="64" cy="56" r="3.5" fill="#0f172a" />
    {/* Smile */}
    <path d="M38 74 Q50 84 62 74" fill="none" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** The home-screen strip: today's patch time at a glance. */
export const PatchPalBar = ({ patch, goal, now, onOpen }: {
  patch: PatchRecord;
  goal: number;
  now: number;
  onOpen: () => void;
}) => {
  const minutes = todayPatchMinutes(patch, now);
  const done = minutes >= goal;
  const running = patch.startedAt !== null;
  return (
    <button
      onClick={onOpen}
      className={`flex shrink-0 items-center gap-3 rounded-xl border-2 px-4 py-2 text-left transition-colors ${running ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
    >
      <Pirate size={40} patched={running} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-base font-bold text-slate-50">
          Patch Pal
          {running && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">Patch on</span>}
          {done && <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-300">Goal done!</span>}
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, (minutes / goal) * 100)}%` }} />
        </div>
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums text-slate-300">
        {formatMinutes(minutes)}
        <div className="text-xs text-slate-500">of {formatMinutes(goal)}</div>
      </div>
    </button>
  );
};

/** Full Patch Pal screen: start and stop the patch, fix mistakes, see the week. */
export const PatchPalScreen = ({ patch, goal, now, onStart, onStop, onAdjust, onClose }: {
  patch: PatchRecord;
  goal: number;
  now: number;
  onStart: () => void;
  onStop: () => void;
  onAdjust: (minutes: number) => void;
  onClose: () => void;
}) => {
  const running = patch.startedAt !== null;
  const minutes = todayPatchMinutes(patch, now);
  const progress = Math.min(1, minutes / goal);
  const session = runningMinutes(patch.startedAt, now);
  const week = Array.from({ length: 7 }, (_, i) => {
    const time = now - (6 - i) * 86400000;
    const key = dayKey(time);
    const value = key === dayKey(now) ? minutes : (patch.log[key] ?? 0);
    return { key, label: new Date(time).toLocaleDateString(undefined, { weekday: 'short' }), value };
  });

  return (
    <motion.div
      key="patch"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-4"
    >
      <div className="flex w-full items-center justify-between">
        <Button variant="ghost" onClick={onClose}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
        <h2 className="text-2xl font-bold">Patch Pal</h2>
        <div className="w-20" />
      </div>

      {/* Ring shows today's progress towards the goal. */}
      <div className="relative flex h-56 w-56 items-center justify-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="54" fill="none" stroke={progress >= 1 ? '#facc15' : '#34d399'} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 54} strokeDashoffset={2 * Math.PI * 54 * (1 - progress)}
          />
        </svg>
        <motion.div animate={running ? { rotate: [-4, 4, -4] } : { rotate: 0 }} transition={{ duration: 2.4, repeat: running ? Infinity : 0 }}>
          <Pirate size={140} patched={running} />
        </motion.div>
      </div>

      <div className="text-center">
        <div className="text-4xl font-bold tabular-nums">{formatMinutes(minutes)}</div>
        <div className="text-slate-400">today · goal {formatMinutes(goal)}</div>
        {running && <div className="mt-1 text-sm text-emerald-300">This patch: {formatMinutes(session)}</div>}
      </div>

      {running ? (
        <Button size="lg" variant="outline" onClick={onStop} className="px-10 py-6 text-xl">
          <Square className="mr-2 h-5 w-5" /> Patch off
        </Button>
      ) : (
        <Button size="lg" onClick={onStart} className="px-10 py-6 text-xl">
          <Play className="mr-2 h-6 w-6" /> Patch on!
        </Button>
      )}

      <div className="flex items-center gap-2 text-slate-400">
        <Glasses className="h-5 w-5" />
        <span className="text-sm">Glasses on too!</span>
      </div>

      {/* The last seven days, so a parent can see the habit at a glance. */}
      <div className="w-full rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">This week</div>
        <div className="flex h-28 items-end justify-between gap-2">
          {week.map(day => (
            <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t ${day.value >= goal ? 'bg-yellow-400' : 'bg-emerald-500/70'}`}
                  style={{ height: `${Math.min(100, (day.value / goal) * 100)}%`, minHeight: day.value > 0 ? 4 : 0 }}
                  title={formatMinutes(day.value)}
                />
              </div>
              <span className="text-xs text-slate-500">{day.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
          <span className="text-sm text-slate-400">Forgot the timer? Fix today:</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onAdjust(-15)} aria-label="Remove 15 minutes"><Minus className="h-4 w-4" /> 15</Button>
            <Button variant="outline" size="sm" onClick={() => onAdjust(15)} aria-label="Add 15 minutes"><Plus className="h-4 w-4" /> 15</Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/** Asked before a game in the one-eye phases when the patch timer is not running. */
export const PatchPrompt = ({ onPatchOn, onSkip, onCancel }: {
  onPatchOn: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" onClick={onCancel}>
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center"
      onClick={e => e.stopPropagation()}
    >
      <Pirate size={120} patched />
      <div>
        <h2 className="text-2xl font-bold">Patch on, glasses on!</h2>
        <p className="mt-1 text-slate-400">Ready, captain?</p>
      </div>
      <Button size="lg" onClick={onPatchOn} className="w-full py-6 text-xl">
        <Play className="mr-2 h-6 w-6" /> Patch is on!
      </Button>
      <Button variant="ghost" onClick={onSkip} className="text-slate-400">Play without the patch</Button>
    </motion.div>
  </div>
);
