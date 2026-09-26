import { UserProfile } from './types';
import { STICKERS } from './constants';

/**
 * Seasonal sticker albums. Treatment runs for years, so rewards need to stay
 * fresh: every season (by the local calendar, northern hemisphere) has its own
 * album of 12 stickers, and each season has two versions that alternate by
 * year, so the same season looks different the next time round. That is eight
 * albums across two years before one repeats.
 *
 * Each season's album has two pages of 12 (the two versions, in an order that
 * swaps every year), so 24 daily-mission stickers per season. Once both pages
 * are full, extra stickers come from the vehicle set, so nothing earned is
 * lost. Patch Pal's daily-goal stickers are pirates and go in their own chest.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Album {
  season: Season;
  title: string;
  cover: string;
  stickers: string[];
}

const ALBUMS: Record<Season, [Album, Album]> = {
  autumn: [
    { season: 'autumn', title: 'Autumn Forest', cover: '🍂', stickers: ['🍁', '🍂', '🍄', '🌰', '🦔', '🐿️', '🦉', '🍎', '🎃', '☂️', '🌧️', '🧣'] },
    { season: 'autumn', title: 'Harvest Farm', cover: '🚜', stickers: ['🚜', '🌽', '🍐', '🍇', '🥕', '🐓', '🐄', '🐖', '🐑', '🌻', '🧺', '🪁'] },
  ],
  winter: [
    { season: 'winter', title: 'Snowy Days', cover: '⛄', stickers: ['⛄', '❄️', '🛷', '⛸️', '🧤', '🎿', '🐧', '🦌', '🦊', '🧊', '🌟', '🎁'] },
    { season: 'winter', title: 'North Pole Express', cover: '🚂', stickers: ['🚂', '🐻‍❄️', '🦭', '🏔️', '🌨️', '🔥', '☕', '🧦', '🕯️', '🔔', '🌌', '🛸'] },
  ],
  spring: [
    { season: 'spring', title: 'Spring Garden', cover: '🌷', stickers: ['🌷', '🌸', '🌼', '🐣', '🐝', '🦋', '🐞', '🐌', '🐸', '🌱', '🌈', '☔'] },
    { season: 'spring', title: 'Windy Skies', cover: '🪁', stickers: ['🪁', '🎈', '🛩️', '🚁', '🦅', '🕊️', '☁️', '🌤️', '🪂', '🛰️', '🚀', '🌙'] },
  ],
  summer: [
    { season: 'summer', title: 'Beach Holiday', cover: '🏖️', stickers: ['☀️', '🏖️', '⛱️', '🍉', '🍦', '🐚', '🦀', '🐬', '🐠', '🌊', '🏄', '⛵'] },
    { season: 'summer', title: 'Summer Road Trip', cover: '🚐', stickers: ['🚐', '🏕️', '🗺️', '🧭', '🚲', '🛶', '🦒', '🦁', '🐘', '🍓', '🌋', '🎡'] },
  ],
};

export const seasonOf = (date = new Date()): Season => {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
};

/**
 * Winter spans the new year, so December belongs with the following January
 * and February: the album is keyed by the year its winter ends in.
 */
const albumYear = (date: Date, season: Season) =>
  season === 'winter' && date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();

/** Stable key for one album instance, e.g. "2026-autumn". */
export const albumKey = (date = new Date()) => {
  const season = seasonOf(date);
  return `${albumYear(date, season)}-${season}`;
};

/** One season's album: two pages of 12, in an order that swaps every year. */
export interface SeasonAlbum {
  season: Season;
  year: number;
  pages: [Album, Album];
  /** Every sticker in the album, page one then page two. */
  stickers: string[];
}

export const albumForKey = (key: string): SeasonAlbum => {
  const [year, season] = key.split('-') as [string, Season];
  const [a, b] = ALBUMS[season];
  const pages: [Album, Album] = Number(year) % 2 === 0 ? [a, b] : [b, a];
  return { season, year: Number(year), pages, stickers: [...pages[0].stickers, ...pages[1].stickers] };
};

export const currentAlbum = (date = new Date()) => albumForKey(albumKey(date));

/**
 * The next mission sticker for the current season, and whether it finishes a
 * page. Falls back to the vehicle set once both pages are full.
 */
export const nextSticker = (user: UserProfile, date = new Date()) => {
  const key = albumKey(date);
  const album = albumForKey(key);
  const have = user.albums[key] ?? [];
  if (have.length < album.stickers.length) {
    const n = have.length + 1;
    return { sticker: album.stickers[have.length], key, completesPage: n % 12 === 0 };
  }
  return { sticker: STICKERS[user.stickers.length % STICKERS.length], key: null, completesPage: false };
};

/** Adds an earned sticker to the shelf and, when it belongs to one, its album. */
export const withSticker = (user: UserProfile, sticker: string, key: string | null): Pick<UserProfile, 'stickers' | 'albums'> => ({
  stickers: [...user.stickers, sticker],
  albums: key ? { ...user.albums, [key]: [...(user.albums[key] ?? []), sticker] } : user.albums,
});
