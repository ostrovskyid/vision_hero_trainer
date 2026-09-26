import { RU } from './locales/ru';

/**
 * Interface language. Text is written in English in the code and looked up
 * in a dictionary for the other languages, so a missing translation shows
 * the English text instead of breaking. The language lives in module state
 * (set by App from the config on every render) so any component or game can
 * call `t()` without the language being passed down to it.
 */

import type { Lang } from './types';
export type { Lang };

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' },
];

/** The device language, for a first start. */
export const detectLang = (): Lang => {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    return langs.some(l => l?.toLowerCase().startsWith('ru')) ? 'ru' : 'en';
  } catch {
    return 'en';
  }
};

let current: Lang = 'en';

export const setLang = (lang: Lang) => {
  current = lang === 'ru' ? 'ru' : 'en';
  try { document.documentElement.lang = current; } catch { /* no document */ }
};

export const getLang = () => current;

/** Locale for dates and numbers: the browser's own for English, Russian otherwise. */
export const locale = () => (current === 'ru' ? 'ru-RU' : undefined);

/** BCP 47 tag for the speech voice. */
export const speechLang = () => (current === 'ru' ? 'ru-RU' : 'en');

/**
 * Translates an English text, then fills `{name}` placeholders from `vars`.
 * Placeholders not in `vars` are left alone (the pup names are filled later).
 */
export const t = (text: string, vars?: Record<string, string | number>) => {
  const s = current === 'ru' ? RU[text] ?? text : text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
};

/**
 * Picks the plural form for a count: English [one, other], Russian
 * [one, few, many] (1 день, 2 дня, 5 дней). `{n}` in the form is the count.
 */
export const plural = (n: number, en: [string, string], ru: [string, string, string]) => {
  let form: string;
  if (current === 'ru') {
    const a = Math.abs(n) % 100, b = a % 10;
    form = a > 10 && a < 20 ? ru[2] : b === 1 ? ru[0] : b >= 2 && b <= 4 ? ru[1] : ru[2];
  } else {
    form = n === 1 ? en[0] : en[1];
  }
  return form.replace(/\{n\}/g, String(n));
};
