export type GameMode = 'tracking' | 'contrast' | 'detail' | 'saccades' | 'peripheral' | 'spotter' | 'checkpoint' | 'metro' | 'station' | 'navigator' | 'crossing' | 'memory' | 'shapes' | 'popout' | 'cinema'
  | 'carriages' | 'dots' | 'zoo' | 'bus' | 'hangar' | 'carwash' | 'differences';
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
  /** Vehicle stickers earned, one per day the daily mission is finished. */
  stickers: string[];
  /** Local YYYY-MM-DD of the last finished daily mission. */
  lastMissionDate?: string;
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
  /** Read instructions aloud, for children who cannot read yet. */
  voiceEnabled: boolean;
  /** Length of each game in the daily mission, in seconds. */
  missionSeconds: number;
  /** Length of a free-play Cartoon Cinema show, in minutes. */
  cinemaMinutes: number;
  /** 0-100 brightness of the strong (scenery) eye's picture in Cartoon Cinema. */
  cinemaFellowLevel: number;
}

export interface AnaglyphPreset {
  name: string;
  description: string;
  target: string;
  scene: string;
}
