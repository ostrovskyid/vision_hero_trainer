import type { CSSProperties } from 'react';
import { GameConfig } from './types';

/**
 * The rescue pups: original characters (a police pup, a pilot pup and a fire
 * pup) for the pup games. A parent can give them names in Parent's Corner;
 * the names are stored only on that device, so a child can play with the
 * pups they already love without the app itself carrying anyone's trademark.
 */

export type PupRole = 'police' | 'pilot' | 'fire';

export const DEFAULT_PUP_NAMES: Record<PupRole, string> = {
  police: 'Police Pup',
  pilot: 'Pilot Pup',
  fire: 'Fire Pup',
};

export const pupName = (config: GameConfig, role: PupRole) =>
  config.pupNames?.[role]?.trim() || DEFAULT_PUP_NAMES[role];

/** "Chase's" / "Police Pup's": for titles like "Chase's Night Search". */
export const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

const LOOKS: Record<PupRole, { fur: string; ear: string; hat: string; badge: string }> = {
  police: { fur: '#a16207', ear: '#78350f', hat: '#1d4ed8', badge: '#facc15' },
  pilot: { fur: '#e7c9a0', ear: '#b88a5a', hat: '#ec4899', badge: '#fde68a' },
  fire: { fur: '#f8fafc', ear: '#1e293b', hat: '#dc2626', badge: '#facc15' },
};

/** A pup's head with its job's hat and badge. Filled shapes, so it tints cleanly for red/cyan mode. */
export const RescuePup = ({ role, size, style }: { role: PupRole; size: number; style?: CSSProperties }) => {
  const c = LOOKS[role];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', ...style }}>
      {/* Ears */}
      <ellipse cx="18" cy="50" rx="12" ry="22" fill={c.ear} />
      <ellipse cx="82" cy="50" rx="12" ry="22" fill={c.ear} />
      {/* Head and muzzle */}
      <circle cx="50" cy="56" r="32" fill={c.fur} />
      {role === 'fire' && (
        <>
          <circle cx="34" cy="68" r="4" fill="#1e293b" />
          <circle cx="70" cy="44" r="3.5" fill="#1e293b" />
          <circle cx="62" cy="76" r="3" fill="#1e293b" />
        </>
      )}
      <ellipse cx="50" cy="70" rx="17" ry="12" fill="#fef3c7" />
      {/* Eyes, nose, smile */}
      <circle cx="38" cy="54" r="5" fill="#0f172a" />
      <circle cx="62" cy="54" r="5" fill="#0f172a" />
      <circle cx="39.5" cy="52.5" r="1.6" fill="#fff" />
      <circle cx="63.5" cy="52.5" r="1.6" fill="#fff" />
      <ellipse cx="50" cy="65" rx="6" ry="4.5" fill="#0f172a" />
      <path d="M42 73 Q50 80 58 73" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
      {/* Hat */}
      {role === 'police' && (
        <>
          <path d="M20 34 Q50 4 80 34 Z" fill={c.hat} />
          <rect x="16" y="32" width="68" height="8" rx="4" fill="#1e3a8a" />
          <path d="M50 14 L54 22 L62 22 L56 27 L58 35 L50 30 L42 35 L44 27 L38 22 L46 22 Z" fill={c.badge} />
        </>
      )}
      {role === 'pilot' && (
        <>
          <path d="M18 40 Q50 0 82 40 Q50 30 18 40 Z" fill={c.hat} />
          <circle cx="36" cy="32" r="8" fill="#bae6fd" stroke="#9d174d" strokeWidth="3" />
          <circle cx="64" cy="32" r="8" fill="#bae6fd" stroke="#9d174d" strokeWidth="3" />
          <path d="M44 32 H56" stroke="#9d174d" strokeWidth="3" />
        </>
      )}
      {role === 'fire' && (
        <>
          <path d="M16 38 Q50 -2 84 38 L90 42 H10 Z" fill={c.hat} />
          <path d="M50 12 Q58 22 52 30 Q60 28 56 38 H44 Q40 28 50 12 Z" fill={c.badge} />
        </>
      )}
    </svg>
  );
};

/** Fills {police}, {pilot} and {fire} in a sentence with the pups' names. */
export const withPupNames = (text: string, config: GameConfig) =>
  text.replace(/\{(police|pilot|fire)\}/g, (_, role: PupRole) => pupName(config, role));
