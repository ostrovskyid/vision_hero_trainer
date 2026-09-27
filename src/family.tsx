import type { CSSProperties } from 'react';
import { GameConfig } from './types';
import { t } from './i18n';

/**
 * The family characters for Fetch: the child (a boy in glasses) and the
 * family dog (a golden-apricot cocker spaniel), with names a parent sets in
 * Parent's Corner. Drawn with filled shapes so they tint for red/cyan mode.
 */

export const dogName = (config: GameConfig) => config.dogName?.trim() || t('Sarabi');
export const childName = (config: GameConfig) => config.childName?.trim() || '';

/**
 * A golden-apricot cocker spaniel's head: one warm colour all over, long
 * curly ears in the same shade, dark eyes and a black nose.
 */
export const Spaniel = ({ size, style }: { size: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', ...style }}>
    {/* Long ears, hanging low, with curls. */}
    <path d="M24 30 Q6 38 6 58 Q4 72 10 84 Q18 94 28 86 Q36 74 32 52 Z" fill="#d09052" />
    <path d="M76 30 Q94 38 94 58 Q96 72 90 84 Q82 94 72 86 Q64 74 68 52 Z" fill="#d09052" />
    <g fill="none" stroke="#a9692c" strokeWidth="2.2" strokeLinecap="round">
      <path d="M10 56 q5 3 0 7 q-5 3 0 7 M18 64 q5 3 0 7 q-5 3 0 7 M12 80 q4 2 8 0" />
      <path d="M90 56 q-5 3 0 7 q5 3 0 7 M82 64 q-5 3 0 7 q5 3 0 7 M88 80 q-4 2 -8 0" />
    </g>
    {/* Head, a soft top-knot and the muzzle, all the same golden colour. */}
    <ellipse cx="50" cy="50" rx="26" ry="29" fill="#c98543" />
    <path d="M34 26 Q42 14 50 20 Q58 14 66 26 Q58 22 50 25 Q42 22 34 26 Z" fill="#dca060" />
    <ellipse cx="50" cy="68" rx="14" ry="11" fill="#d7975a" />
    {/* Dark, gentle eyes with a little brow. */}
    <path d="M34 42 Q40 38 46 42 M54 42 Q60 38 66 42" fill="none" stroke="#a9692c" strokeWidth="2" strokeLinecap="round" />
    <circle cx="40" cy="48" r="4.8" fill="#1a0f08" />
    <circle cx="60" cy="48" r="4.8" fill="#1a0f08" />
    <circle cx="41.4" cy="46.5" r="1.4" fill="#fff" />
    <circle cx="61.4" cy="46.5" r="1.4" fill="#fff" />
    {/* Black nose and a small smile. */}
    <ellipse cx="50" cy="62" rx="7" ry="5.2" fill="#111111" />
    <circle cx="48" cy="60.5" r="1.3" fill="#fff" fillOpacity="0.5" />
    <path d="M44 71 Q50 75 56 71" fill="none" stroke="#7a4518" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** The child: a smiling boy in round glasses. */
export const Boy = ({ size, style }: { size: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', ...style }}>
    <circle cx="50" cy="54" r="30" fill="#f5c9a0" />
    <path d="M20 50 Q18 22 50 20 Q82 22 80 50 Q72 34 50 34 Q30 34 20 50 Z" fill="#6b4226" />
    <circle cx="20" cy="56" r="5" fill="#f5c9a0" />
    <circle cx="80" cy="56" r="5" fill="#f5c9a0" />
    <circle cx="38" cy="54" r="9" fill="#e0f2fe" fillOpacity="0.5" stroke="#1e3a8a" strokeWidth="3" />
    <circle cx="62" cy="54" r="9" fill="#e0f2fe" fillOpacity="0.5" stroke="#1e3a8a" strokeWidth="3" />
    <path d="M47 54 H53" stroke="#1e3a8a" strokeWidth="3" />
    <circle cx="38" cy="54" r="3" fill="#1f2937" />
    <circle cx="62" cy="54" r="3" fill="#1f2937" />
    <path d="M40 70 Q50 78 60 70" fill="none" stroke="#9a3412" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** The faceted two-colour ball: one half red, one half teal. */
export const FacetBall = ({ size, style }: { size: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', ...style }}>
    <defs>
      <clipPath id="facet-ball"><circle cx="50" cy="50" r="46" /></clipPath>
    </defs>
    <g clipPath="url(#facet-ball)">
      <rect x="0" y="0" width="50" height="100" fill="#f0506e" />
      <rect x="50" y="0" width="50" height="100" fill="#2cc4b0" />
      {/* Facets: a triangle lattice in slightly darker lines. */}
      <g stroke="#000" strokeOpacity="0.18" strokeWidth="2.5" fill="none">
        <path d="M0 25 L25 0 L50 25 L75 0 L100 25 M0 50 L25 25 L50 50 L75 25 L100 50 M0 75 L25 50 L50 75 L75 50 L100 75 M0 100 L25 75 L50 100 L75 75 L100 100" />
        <path d="M25 0 V100 M75 0 V100" />
      </g>
    </g>
    <circle cx="50" cy="50" r="46" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="2" />
  </svg>
);
