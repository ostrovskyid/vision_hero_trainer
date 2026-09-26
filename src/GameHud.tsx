import { Trophy, Car, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * The in-game heads-up display. A five-year-old cannot read "37s" and a
 * ticking number only adds pressure, so time is shown as a little car driving
 * along a road towards the finish flag instead of a countdown.
 */
export const GameHud = ({ score, timeLeft, duration }: { score: number; timeLeft: number; duration: number }) => {
  const progress = duration > 0 ? Math.min(1, Math.max(0, 1 - timeLeft / duration)) : 0;
  return (
    <>
      <div className="absolute top-4 left-4 flex gap-4 z-20 pointer-events-none">
        <Badge variant="secondary" className="text-lg px-3 py-1"><Trophy className="mr-2 h-4 w-4 text-yellow-500" /> {score}</Badge>
      </div>
      <div
        className="absolute bottom-1.5 left-4 right-10 z-20 h-6 pointer-events-none"
        role="progressbar"
        aria-label="Time"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="absolute left-0 right-0 bottom-1 h-1.5 rounded-full bg-slate-800/80" />
        <div className="absolute left-0 bottom-1 h-1.5 rounded-full bg-slate-500/70" style={{ width: `${progress * 100}%` }} />
        <Car className="absolute bottom-1.5 h-5 w-5 -translate-x-1/2 text-slate-300" style={{ left: `${progress * 100}%` }} />
        <Flag className="absolute -right-6 bottom-1 h-5 w-5 text-slate-400" />
      </div>
    </>
  );
};
