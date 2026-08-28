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
  /** Colour the target eye should see through its filter (calibrated per screen). */
  anaglyphTarget: string;
  /** Colour of the scenery the other eye sees (calibrated per screen). */
  anaglyphScene: string;
  /** 0-100 brightness of the target colour. Lowering it kills red ghosting. */
  anaglyphTargetLevel: number;
  /** 0-100 brightness of the scenery colour. */
  anaglyphSceneLevel: number;
  soundEnabled: boolean;
  /** Enter full screen when an exercise starts, to maximise the play area. */
  autoFullscreen: boolean;
  difficulty: Difficulty;
}

export interface AnaglyphPreset {
  name: string;
  description: string;
  target: string;
  scene: string;
}
