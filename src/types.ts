export type GameMode = 'tracking' | 'contrast' | 'detail' | 'saccades' | 'peripheral' | 'spotter' | 'checkpoint' | 'metro' | 'station' | 'navigator' | 'crossing' | 'memory';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameStats {
  score: number;
  timeSpent: number;
  accuracy: number;
  date: string;
  difficulty?: Difficulty;
}

export interface UserProfile {
  name: string;
  avatar: string;
  level: number;
  experience: number;
  stats: Record<GameMode, GameStats[]>;
}

export interface GameConfig {
  speed: number;
  size: number;
  contrast: number;
  duration: number;
  anaglyphMode: boolean;
  soundEnabled: boolean;
  difficulty: Difficulty;
}
