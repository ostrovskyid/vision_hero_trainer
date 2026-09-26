import type { CSSProperties } from 'react';
import { GameConfig } from './types';
import { t, getLang } from './i18n';

/**
 * The rescue pups: original characters (a police pup, a pilot pup and a fire
 * pup) for the pup games. A parent can give them names in Parent's Corner;
 * the names are stored only on that device, so a child can play with the
 * pups they already love without the app itself carrying anyone's trademark.
 */

export type PupRole = keyof GameConfig['pupNames'];

export const PUP_ROLES: PupRole[] = ['police', 'pilot', 'fire', 'builder', 'recycle', 'snow', 'water', 'jungle', 'city', 'dino'];

export const DEFAULT_PUP_NAMES: Record<PupRole, string> = {
  police: 'Police Pup',
  pilot: 'Pilot Pup',
  fire: 'Fire Pup',
  builder: 'Builder Pup',
  recycle: 'Recycling Pup',
  snow: 'Snow Pup',
  water: 'Water Pup',
  jungle: 'Jungle Pup',
  city: 'City Pup',
  dino: 'Dino Pup',
};

export const pupName = (config: GameConfig, role: PupRole) =>
  config.pupNames?.[role]?.trim() || t(DEFAULT_PUP_NAMES[role]);

/** "Chase's" / "Police Pup's": for titles like "Chase's Night Search". */
export const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

/**
 * A pup game's title with the pup's name: "Chase's Night Search", or
 * "Гонщик: Ночной поиск" in Russian, where a possessive would need the name
 * declined.
 */
export const pupTitle = (name: string, title: string) =>
  getLang() === 'ru' ? `${name}: ${t(title)}` : `${possessive(name)} ${title}`;

const LOOKS: Record<PupRole, { fur: string; ear: string; hat: string; badge: string }> = {
  police: { fur: '#a16207', ear: '#78350f', hat: '#1d4ed8', badge: '#facc15' },
  pilot: { fur: '#e7c9a0', ear: '#b88a5a', hat: '#ec4899', badge: '#fde68a' },
  fire: { fur: '#f8fafc', ear: '#1e293b', hat: '#dc2626', badge: '#facc15' },
  builder: { fur: '#c8a26b', ear: '#8a6a3f', hat: '#facc15', badge: '#f97316' },
  recycle: { fur: '#9ca3af', ear: '#6b7280', hat: '#16a34a', badge: '#bbf7d0' },
  snow: { fur: '#e2e8f0', ear: '#64748b', hat: '#7c3aed', badge: '#e0f2fe' },
  water: { fur: '#7c4a2d', ear: '#4a2c1a', hat: '#f97316', badge: '#38bdf8' },
  jungle: { fur: '#b07a45', ear: '#7a4f24', hat: '#65a30d', badge: '#fef08a' },
  city: { fur: '#9a5b34', ear: '#5c3317', hat: '#8b5cf6', badge: '#f0abfc' },
  dino: { fur: '#1f2937', ear: '#111827', hat: '#16a34a', badge: '#bef264' },
};

/** A pup's head with its job's hat and badge. Filled shapes, so it tints cleanly for red/cyan mode. */
export const RescuePup = ({ role, size, style }: { role: PupRole; size: number; style?: CSSProperties }) => {
  const c = LOOKS[role];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', ...style }}>
      {/* Ears */}
      {role === 'jungle' ? (
        // The jungle pup's big ears, for hearing the jungle.
        <>
          <ellipse cx="10" cy="42" rx="14" ry="30" fill={c.ear} transform="rotate(-25 10 42)" />
          <ellipse cx="90" cy="42" rx="14" ry="30" fill={c.ear} transform="rotate(25 90 42)" />
        </>
      ) : (
        <>
          <ellipse cx="18" cy="50" rx="12" ry="22" fill={c.ear} />
          <ellipse cx="82" cy="50" rx="12" ry="22" fill={c.ear} />
        </>
      )}
      {/* Head and muzzle */}
      <circle cx="50" cy="56" r="32" fill={c.fur} />
      {role === 'fire' && (
        <>
          <circle cx="34" cy="68" r="4" fill="#1e293b" />
          <circle cx="70" cy="44" r="3.5" fill="#1e293b" />
          <circle cx="62" cy="76" r="3" fill="#1e293b" />
        </>
      )}
      {role === 'dino' && (
        // White blaze and rust cheeks, like a mountain dog.
        <>
          <path d="M44 30 Q50 26 56 30 L54 60 H46 Z" fill="#f8fafc" />
          <circle cx="30" cy="66" r="6" fill="#b45309" />
          <circle cx="70" cy="66" r="6" fill="#b45309" />
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
      {role === 'builder' && (
        <>
          {/* Hard hat with a stripe and a brim. */}
          <path d="M20 36 Q20 8 50 8 Q80 8 80 36 Z" fill={c.hat} />
          <rect x="46" y="8" width="8" height="28" fill={c.badge} />
          <rect x="12" y="33" width="76" height="8" rx="4" fill={c.hat} />
        </>
      )}
      {role === 'recycle' && (
        <>
          {/* Cap with a recycling ring. */}
          <path d="M18 38 Q50 4 82 38 Z" fill={c.hat} />
          <rect x="14" y="34" width="72" height="7" rx="3.5" fill="#15803d" />
          <circle cx="50" cy="24" r="8" fill="none" stroke={c.badge} strokeWidth="3" strokeDasharray="10 4" />
        </>
      )}
      {role === 'snow' && (
        <>
          {/* Woolly hat with a pompom and a snowflake. */}
          <path d="M18 38 Q18 10 50 10 Q82 10 82 38 Z" fill={c.hat} />
          <rect x="16" y="32" width="68" height="9" rx="4.5" fill="#a78bfa" />
          <circle cx="50" cy="8" r="7" fill={c.badge} />
          <path d="M50 16 V30 M44 19 L56 27 M56 19 L44 27" stroke={c.badge} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {role === 'water' && (
        <>
          {/* Cap with a wave. */}
          <path d="M18 38 Q50 4 82 38 Z" fill={c.hat} />
          <rect x="14" y="34" width="72" height="7" rx="3.5" fill="#c2410c" />
          <path d="M36 26 Q41 20 46 26 T56 26 T66 26" fill="none" stroke={c.badge} strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {role === 'jungle' && (
        <>
          {/* Explorer's hat. */}
          <path d="M24 34 Q24 10 50 10 Q76 10 76 34 Z" fill={c.hat} />
          <rect x="24" y="26" width="52" height="6" fill={c.badge} />
          <ellipse cx="50" cy="35" rx="36" ry="6" fill="#4d7c0f" />
        </>
      )}
      {role === 'city' && (
        <>
          {/* Scooter helmet with goggles. */}
          <path d="M18 40 Q18 8 50 8 Q82 8 82 40 Z" fill={c.hat} />
          <circle cx="38" cy="30" r="7" fill={c.badge} stroke="#581c87" strokeWidth="3" />
          <circle cx="62" cy="30" r="7" fill={c.badge} stroke="#581c87" strokeWidth="3" />
          <path d="M45 30 H55" stroke="#581c87" strokeWidth="3" />
        </>
      )}
      {role === 'dino' && (
        <>
          {/* Cap with dinosaur spikes. */}
          <path d="M18 38 Q50 4 82 38 Z" fill={c.hat} />
          <path d="M34 20 L38 8 L44 16 L50 4 L56 16 L62 8 L66 20 Z" fill={c.badge} />
          <rect x="14" y="34" width="72" height="7" rx="3.5" fill="#15803d" />
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
  text.replace(/\{(police|pilot|fire|builder|recycle|snow|water|jungle|city|dino)\}/g, (_, role: PupRole) => pupName(config, role));
