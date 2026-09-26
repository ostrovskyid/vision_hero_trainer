export type GameMode = 'tracking' | 'contrast' | 'detail' | 'saccades' | 'peripheral' | 'spotter' | 'checkpoint' | 'metro' | 'station' | 'navigator' | 'crossing' | 'memory' | 'shapes' | 'popout' | 'cinema'
  | 'carriages' | 'dots' | 'zoo' | 'bus' | 'hangar' | 'carwash' | 'differences'
  | 'stripes' | 'docking' | 'maze' | 'paint' | 'pexeso'
  | 'cage' | 'fusion'
  | 'nightsearch' | 'skycatch' | 'firerescue' | 'lookout';
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Where the child is in their treatment plan, as set by a parent to match
 * what the eye doctor has asked for. 'free' applies no restrictions.
 */
export type TherapyPhase = 'free' | 'preop' | 'recovery' | 'pleoptic' | 'binocular' | 'maintenance';

/** One result of the monthly picture check (a home trend, not a clinical test). */
export interface VisionCheck {
  /** ISO timestamp. */
  date: string;
  eye: 'left' | 'right' | 'both';
  distanceCm: number;
  glasses: boolean;
  /** Symbols shown inside a crowding box. */
  crowded: boolean;
  /** Smallest line passed, in logMAR (0 = decimal 1.0; 1.3 = decimal 0.05). */
  logMAR: number;
  /** True when even the largest line was not passed. */
  belowChart?: boolean;
  /** True when the smallest line the screen can draw was passed (result is "at least"). */
  atLimit?: boolean;
}

/** Patch (occlusion) time, tracked by Patch Pal. */
export interface PatchRecord {
  /** Minutes of patch time per local day (YYYY-MM-DD). */
  log: Record<string, number>;
  /** Epoch ms when the running patch timer started, or null when stopped. */
  startedAt: number | null;
  /** Local day of the last daily-goal sticker, so it is awarded once a day. */
  lastStickerDate?: string;
}

export interface GameStats {
  score: number;
  timeSpent: number;
  accuracy: number;
  date: string;
  difficulty?: Difficulty;
  /** Lion in the Cage: where the child lined the pictures up, in prism dioptres (+ = eyes turned in). */
  alignedPD?: number;
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
  patch: PatchRecord;
  checks: VisionCheck[];
  /** Seasonal album stickers, by album key (e.g. "2026-autumn"). */
  albums: Record<string, string[]>;
  /** ISO timestamp of the last backup file saved from this device. */
  lastBackupAt?: string;
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
  /** Treatment phase chosen in Parent's Corner. */
  therapyPhase: TherapyPhase;
  /** Keep game targets out of the left part of the screen. */
  comfortZone: boolean;
  /** Daily patch-time goal in minutes. */
  patchGoalMinutes: number;
  /** CSS pixels per millimetre on this screen, from the card calibration; 0 = not calibrated. */
  pxPerMm: number;
  /**
   * Eye angle to compensate in the two-eye games, in prism dioptres as the
   * orthoptist measures it. Positive = eyes turn in (esotropia), negative =
   * out (exotropia). The two eyes' pictures are shifted apart by this much.
   */
  deviationPD: number;
  /** Names a parent gives the rescue pups, stored only on this device. */
  pupNames: { police: string; pilot: string; fire: string };
  /** Show games that need reading letters (for when the child starts reading). */
  readingGames: boolean;
}

export interface AnaglyphPreset {
  name: string;
  description: string;
  target: string;
  scene: string;
}
