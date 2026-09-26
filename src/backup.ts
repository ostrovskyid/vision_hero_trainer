import { GameConfig, UserProfile } from './types';
import { t } from './i18n';

/**
 * Backup and restore to a file. Everything the app remembers lives in this
 * browser's storage, which a tablet reset, a cleared browser or a new device
 * would lose. Treatment runs for years, so the whole record (progress,
 * stickers, patch log, picture checks, settings and the screen calibration)
 * can be saved to one JSON file and loaded back on any device.
 */

export const BACKUP_FORMAT = 'vision-hero-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  savedAt: string;
  user: UserProfile;
  config: GameConfig;
}

export const buildBackup = (user: UserProfile, config: GameConfig): BackupFile => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  savedAt: new Date().toISOString(),
  user,
  config,
});

export const backupFileName = (date = new Date()) =>
  `vision-hero-backup-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.json`;

/**
 * Hands the file to the person: the share sheet where the device offers it
 * for files (tablets: save to Files, Drive, email, messenger), otherwise a
 * normal download. Resolves to false if the person closed the share sheet.
 */
export const saveBackupFile = async (backup: BackupFile): Promise<boolean> => {
  const name = backupFileName();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: t('Vision Hero backup') });
      return true;
    } catch (err) {
      // Closing the share sheet is a choice, not a failure; anything else
      // falls through to a download.
      if ((err as Error)?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
};

export type ParsedBackup =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: string };

/** Checks a file really is a Vision Hero backup before anything is replaced. */
export const parseBackup = (text: string): ParsedBackup => {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: t("This file isn't a Vision Hero backup (it isn't readable JSON).") };
  }
  if (!data || data.format !== BACKUP_FORMAT) {
    return { ok: false, error: t("This file isn't a Vision Hero backup. Choose a file named vision-hero-backup-….json.") };
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    return { ok: false, error: t('This backup was made by a newer version of the app. Reload the app to update it, then try again.') };
  }
  if (!data.user || typeof data.user !== 'object' || !data.config || typeof data.config !== 'object') {
    return { ok: false, error: t('This backup is incomplete: the progress or settings part is missing.') };
  }
  return { ok: true, backup: data as BackupFile };
};

/** Whole days since an ISO timestamp, or null if there is none. */
export const daysSince = (iso?: string, now = Date.now()) =>
  iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : null;
