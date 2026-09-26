import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserProfile } from './types';
import { albumForKey, albumKey } from './stickers';
import { PATCH_STICKERS } from './constants';

const SEASON_BG: Record<string, string> = {
  autumn: 'from-orange-500/20 to-amber-900/10',
  winter: 'from-sky-400/20 to-indigo-900/10',
  spring: 'from-emerald-400/20 to-pink-500/10',
  summer: 'from-yellow-400/20 to-cyan-500/10',
};

/**
 * The sticker album: this season's page first, earlier albums as tabs. Slots
 * not yet earned show the sticker's shape as a faint shadow, so a child can
 * see what is still to come.
 */
export const StickerAlbum = ({ user, onClose }: { user: UserProfile; onClose: () => void }) => {
  const current = albumKey();
  // Current album first, then any earlier album that has stickers, newest first.
  const keys = [current, ...Object.keys(user.albums).filter(k => k !== current && (user.albums[k]?.length ?? 0) > 0).sort().reverse()];
  const [open, setOpen] = useState(current);
  const album = albumForKey(open);
  const have = user.albums[open] ?? [];
  const seasonName = album.season[0].toUpperCase() + album.season.slice(1);
  const pirates = user.stickers.filter(s => PATCH_STICKERS.includes(s));

  return (
    <motion.div
      key="album"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-4"
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
        <h2 className="text-2xl font-bold">Sticker Album</h2>
        <div className="w-20" />
      </div>

      {keys.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {keys.map(k => {
            const a = albumForKey(k);
            return (
              <Button key={k} size="sm" variant={open === k ? 'default' : 'outline'} onClick={() => setOpen(k)} aria-pressed={open === k}>
                <span className="mr-1.5">{a.pages[0].cover}</span> {a.season[0].toUpperCase() + a.season.slice(1)} {a.year}
              </Button>
            );
          })}
        </div>
      )}

      <p className="text-slate-300">
        {seasonName} {album.year} · {have.length} of {album.stickers.length} stickers
        {open === current && have.length < album.stickers.length ? ` · ${album.stickers.length - have.length} to go` : ''}
      </p>

      {album.pages.map((page, p) => {
        const offset = p * page.stickers.length;
        const pageHave = Math.max(0, Math.min(page.stickers.length, have.length - offset));
        const done = pageHave === page.stickers.length;
        return (
          <section key={`${open}-${p}`} className={`rounded-2xl border border-slate-800 bg-gradient-to-br ${SEASON_BG[album.season] ?? ''} p-5`}>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-5xl leading-none">{page.cover}</span>
              <div>
                <h3 className="text-2xl font-bold">{page.title}</h3>
                <p className="text-slate-300">Page {p + 1} · {pageHave} of {page.stickers.length}{done ? ' · Complete!' : ''}</p>
              </div>
              {done && <span className="ml-auto text-5xl" aria-label="Page complete">🏆</span>}
            </div>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {page.stickers.map((s, i) => {
                const earned = i < pageHave;
                return (
                  <motion.div
                    key={`${open}-${p}-${i}`}
                    initial={earned ? { scale: 0.5, rotate: -15 } : false}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: earned ? i * 0.04 : 0 }}
                    className={`flex aspect-square items-center justify-center rounded-2xl border-2 ${earned ? 'border-yellow-400/70 bg-slate-950/60' : 'border-dashed border-slate-700 bg-slate-950/30'}`}
                  >
                    <span
                      className="text-4xl leading-none sm:text-5xl"
                      // Not earned yet: a faint shadow of the shape to look forward to.
                      style={earned ? undefined : { filter: 'brightness(0) invert(1)', opacity: 0.12 }}
                      aria-label={earned ? s : 'Sticker to win'}
                    >
                      {s}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}

      {pirates.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xl font-bold"><span className="text-3xl">🏴‍☠️</span> Pirate Chest</h3>
          <p className="mb-3 text-sm text-slate-400">One for every day the patch goal was reached.</p>
          <div className="flex flex-wrap gap-2 text-3xl leading-none">
            {pirates.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </section>
      )}

      <p className="text-center text-sm text-slate-400">
        Finish Today's Mission to win the next album sticker. A new album starts every season.
      </p>
    </motion.div>
  );
};
