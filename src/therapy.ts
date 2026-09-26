import { GameConfig, TherapyPhase } from './types';
import { t } from './i18n';

/**
 * Treatment phases a parent can switch between in Parent's Corner. Each one
 * applies a few settings at the moment it is chosen; the parent can still
 * change any of them afterwards. The app never moves between phases by
 * itself: the eye doctor decides when a phase starts and ends.
 */
export interface PhaseInfo {
  id: TherapyPhase;
  label: string;
  short: string;
  description: string;
  /** Settings applied when the parent picks this phase. */
  apply: Partial<GameConfig>;
  /** Games and the daily mission are hidden while resting after surgery. */
  locked?: boolean;
}

export const PHASES: PhaseInfo[] = [
  {
    id: 'free',
    label: 'Free play',
    short: 'Free play',
    description: 'No treatment-plan restrictions. Every game and setting is available.',
    apply: {},
  },
  {
    id: 'preop',
    label: 'Before surgery',
    short: 'One eye',
    description: 'One eye at a time with the patch on. Red/cyan mode off, targets kept away from the left edge.',
    apply: { anaglyphMode: false, comfortZone: true },
  },
  {
    id: 'recovery',
    label: 'Recovery',
    short: 'Resting',
    description: 'Healing after an operation. Games and missions are paused; Patch Pal stays available if patching continues.',
    apply: {},
    locked: true,
  },
  {
    id: 'pleoptic',
    label: 'Weaker-eye training',
    short: 'One eye',
    description: 'Training the weaker eye with the patch on. Red/cyan mode off; the comfort zone can be turned off if eye movement allows.',
    apply: { anaglyphMode: false, comfortZone: true },
  },
  {
    id: 'binocular',
    label: 'Two eyes together',
    short: 'Both eyes',
    description: 'Red/cyan glasses, both eyes open: Lion in the Cage, then Fusion Stars, then Pop-Out Pups. Only start this when the eye doctor or orthoptist agrees.',
    apply: { anaglyphMode: true },
  },
  {
    id: 'maintenance',
    label: 'Keeping the gains',
    short: 'Keep-up',
    description: 'After patching is reduced or stopped: shorter missions to keep the eye working.',
    apply: { missionSeconds: 60 },
  },
];

export const phaseInfo = (id: TherapyPhase) => PHASES.find(p => p.id === id) ?? PHASES[0];

/** Phases in which play should normally happen with the patch on. */
export const PATCH_PHASES: TherapyPhase[] = ['preop', 'pleoptic'];

/** Share of the play area kept empty on the left while the comfort zone is on. */
export const COMFORT_ZONE_GUTTER = '22%';

/** Local calendar day, so logs roll over at the child's midnight. */
export const dayKey = (time = Date.now()) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A forgotten timer is capped so one missed "stop" does not claim a whole day. */
export const MAX_PATCH_SESSION_MINUTES = 8 * 60;

export const runningMinutes = (startedAt: number | null, now = Date.now()) =>
  startedAt ? Math.min(MAX_PATCH_SESSION_MINUTES, Math.max(0, (now - startedAt) / 60000)) : 0;

export const formatMinutes = (minutes: number) => {
  const m = Math.floor(minutes);
  const h = Math.floor(m / 60);
  return h > 0 ? t('{h} h {m} min', { h, m: String(m % 60).padStart(2, '0') }) : t('{m} min', { m });
};
