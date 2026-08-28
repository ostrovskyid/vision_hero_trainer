import { AnaglyphPreset, GameConfig } from './types';

export const ANAGLYPH_TARGET_DEFAULT = '#FF0000';
export const ANAGLYPH_SCENE_DEFAULT = '#00FFFF';

export const DEFAULT_CONFIG: GameConfig = {
  speed: 5,
  size: 40,
  contrast: 100,
  duration: 90,
  anaglyphMode: false,
  anaglyphTarget: ANAGLYPH_TARGET_DEFAULT,
  anaglyphScene: ANAGLYPH_SCENE_DEFAULT,
  anaglyphTargetLevel: 100,
  anaglyphSceneLevel: 100,
  soundEnabled: true,
  autoFullscreen: true,
  difficulty: 'medium',
};

/**
 * Screens differ in how saturated their red and cyan primaries are, and cheap
 * red/cyan glasses differ in what they actually block, so the "textbook"
 * pure red / pure cyan pair ghosts badly on some combinations. These are
 * starting points for calibration — the colours stay fully adjustable.
 */
export const ANAGLYPH_PRESETS: AnaglyphPreset[] = [
  {
    name: 'Classic',
    description: 'Pure red and pure cyan. The reference pair — try this first.',
    target: '#FF0000',
    scene: '#00FFFF',
  },
  {
    name: 'Dimmed scene',
    description: 'Darker cyan for bright screens where the scenery overpowers the target.',
    target: '#FF0000',
    scene: '#00C4C4',
  },
  {
    name: 'Blue-shifted',
    description: 'Less green in the scenery, for glasses that leak green through the red lens.',
    target: '#FF0000',
    scene: '#0096FF',
  },
  {
    name: 'Green-shifted',
    description: 'Less blue in the scenery, for glasses that leak blue through the red lens.',
    target: '#FF0000',
    scene: '#00FF96',
  },
  {
    name: 'Deep red',
    description: 'Darker target for screens whose red bleeds through the cyan lens.',
    target: '#C80000',
    scene: '#00FFFF',
  },
];

export const DIFFICULTY_PRESETS: Record<string, Partial<GameConfig>> = {
  easy: { speed: 2, size: 60, contrast: 100 },
  medium: { speed: 5, size: 40, contrast: 100 },
  hard: { speed: 9, size: 20, contrast: 100 },
};

export const AVATARS = [
  '🚗', '✈️', '🚀', '🚂', '🚌', '🚁'
];

export const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#f59e0b',
  background: '#0f172a',
};
