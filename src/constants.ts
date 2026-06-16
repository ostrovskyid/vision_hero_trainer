import { GameConfig } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  speed: 5,
  size: 40,
  contrast: 100,
  duration: 90,
  anaglyphMode: false,
  soundEnabled: true,
  difficulty: 'medium',
};

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
