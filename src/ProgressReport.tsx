import { useMemo, useState } from 'react';
import { ChevronLeft, Copy, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameConfig, GameMode, UserProfile } from './types';
import { dayKey, formatMinutes, phaseInfo } from './therapy';
import { EYE_LABEL, HistoryChart, HistoryTable, toDecimal } from './PictureCheck';
import { t, locale, plural } from './i18n';

/**
 * A progress report for checkups: everything the app recorded over a chosen
 * period, on one page a parent can show the orthoptist, print (or save as
 * PDF from the print dialog) or copy as text into a message.
 *
 * All of it is home data: the parent's patch log, home picture checks and game
 * practice. It says so on the page. The clinic's measurements are the real ones.
 */

type Range = '28' | '91' | '182' | 'all' | 'custom';

const RANGES: { id: Range; label: string }[] = [
  { id: '28', label: '4 weeks' },
  { id: '91', label: '3 months' },
  { id: '182', label: '6 months' },
  { id: 'all', label: 'Everything' },
  { id: 'custom', label: 'Since…' },
];

const DAY = 86400000;
const startOfDay = (time: number) => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtDate = (time: number | string) => new Date(time).toLocaleDateString(locale());

// Categorical slot 3 of the reference palette (dark step), validated on the card surface.
const BAR = '#199e70';

export const ProgressReport = ({ user, config, skillLabels, gameTitles, onClose }: {
  user: UserProfile;
  config: GameConfig;
  skillLabels: Record<GameMode, string>;
  gameTitles: Record<GameMode, string>;
  onClose: () => void;
}) => {
  const [range, setRange] = useState<Range>('91');
  const [since, setSince] = useState(() => dayKey(Date.now() - 30 * DAY));
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const now = Date.now();

  // Earliest date anything was recorded, for "Everything".
  const firstRecord = useMemo(() => {
    const times: number[] = [
      ...Object.keys(user.patch.log).map(k => new Date(`${k}T00:00:00`).getTime()),
      ...user.checks.map(c => new Date(c.date).getTime()),
      ...Object.values(user.stats).flat().map(s => new Date(s.date).getTime()),
    ].filter(time => !Number.isNaN(time));
    return times.length ? Math.min(...times) : now;
  }, [user, now]);

  const requested = startOfDay(
    range === 'all' ? firstRecord
      : range === 'custom' ? new Date(`${since}T00:00:00`).getTime()
      : now - (Number(range) - 1) * DAY,
  );
  // Days before anything was recorded would only drag the averages down.
  const from = Math.max(requested, startOfDay(firstRecord));
  const clipped = from > requested;
  const days = Math.max(1, Math.round((startOfDay(now) - from) / DAY) + 1);

  // --- Patch time ---
  const patchDays = Array.from({ length: days }, (_, i) => {
    const key = dayKey(from + i * DAY);
    return { key, minutes: user.patch.log[key] ?? 0 };
  });
  const patchTotal = patchDays.reduce((a, d) => a + d.minutes, 0);
  const daysPatched = patchDays.filter(d => d.minutes > 0).length;
  const daysGoalMet = patchDays.filter(d => d.minutes >= config.patchGoalMinutes).length;
  // Weekly buckets up to about four months; monthly beyond that, so the chart stays readable.
  const bucketDays = days > 120 ? 30 : 7;
  const buckets: { label: string; minutes: number; days: number }[] = [];
  for (let i = 0; i < patchDays.length; i += bucketDays) {
    const slice = patchDays.slice(i, i + bucketDays);
    buckets.push({
      label: new Date(`${slice[0].key}T00:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }),
      minutes: slice.reduce((a, d) => a + d.minutes, 0),
      days: slice.length,
    });
  }

  // --- Picture checks ---
  const checks = user.checks.filter(c => new Date(c.date).getTime() >= from);

  // --- Games ---
  const sessions = (Object.entries(user.stats) as [GameMode, UserProfile['stats'][GameMode]][])
    .flatMap(([mode, list]) => list.map(s => ({ mode, ...s })))
    .filter(s => new Date(s.date).getTime() >= from);
  const practiceDays = new Set(sessions.map(s => dayKey(new Date(s.date).getTime()))).size;
  const practiceMinutes = sessions.reduce((a, s) => a + (s.timeSpent || 0), 0) / 60;
  const bySkill = new Map<string, { sessions: number; games: Set<string> }>();
  for (const s of sessions) {
    const skill = t(skillLabels[s.mode] ?? s.mode);
    const entry = bySkill.get(skill) ?? { sessions: 0, games: new Set<string>() };
    entry.sessions += 1;
    entry.games.add(t(gameTitles[s.mode] ?? s.mode));
    bySkill.set(skill, entry);
  }
  const skills = [...bySkill.entries()].sort((a, b) => b[1].sessions - a[1].sessions);
  const alignments = sessions.filter(s => typeof s.alignedPD === 'number').sort((a, b) => a.date.localeCompare(b.date));

  const daysText = (n: number) => plural(n, ['{n} day', '{n} days'], ['{n} день', '{n} дня', '{n} дней']);
  const periodText = `${fmtDate(from)} – ${fmtDate(now)} (${daysText(days)}${clipped ? t(', since records began') : ''})`;

  const sessionsText = (n: number) => plural(n, ['{n} session', '{n} sessions'], ['{n} занятие', '{n} занятия', '{n} занятий']);

  const summaryText = () => {
    const lines = [
      `${t('Vision Hero home report')} — ${periodText}`,
      `${t('Stage')}: ${t(phaseInfo(config.therapyPhase).label)}`,
      '',
      t('Patch time: {total} in total, {average} a day on average. Goal {goal} met on {met} of {days}; patch worn on {worn}.', {
        total: formatMinutes(patchTotal), average: formatMinutes(patchTotal / days), goal: formatMinutes(config.patchGoalMinutes),
        met: daysGoalMet, days: daysText(days), n: days, worn: daysText(daysPatched),
      }),
      '',
      t('Home picture checks:'),
      ...(checks.length
        ? checks.map(c => `  ${fmtDate(c.date)}  ${t(EYE_LABEL[c.eye])}: ${c.belowChart ? '< 0.05' : `${c.atLimit ? '≥ ' : ''}${toDecimal(c.logMAR)}`} (${t('{n} cm', { n: c.distanceCm })}, ${t(c.glasses ? 'glasses' : 'no glasses')}, ${t(c.crowded ? 'crowded' : 'single')})`)
        : [`  ${t('none in this period')}`]),
      '',
      t('Game practice: {sessions} on {days}, about {minutes} minutes.', { sessions: sessionsText(sessions.length), days: daysText(practiceDays), minutes: Math.round(practiceMinutes) }),
      ...skills.map(([skill, v]) => `  ${skill}: ${v.sessions}`),
      ...(alignments.length
        ? ['', t('Lion in the Cage (home reading, prism dioptres, + = in):'), ...alignments.map(a => `  ${fmtDate(a.date)}: ${a.alignedPD}`)]
        : []),
      '',
      t('Home data from the Vision Hero app, not clinical measurements.'),
    ];
    return lines.join('\n');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText());
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  const maxBucket = Math.max(config.patchGoalMinutes * bucketDays, ...buckets.map(b => b.minutes), 1);
  const W = 640, H = 200, L = 44, R = 12, T = 12, B = 28;
  const bw = (W - L - R) / Math.max(1, buckets.length);
  const y = (m: number) => T + (1 - m / maxBucket) * (H - T - B);
  const goalLine = config.patchGoalMinutes * bucketDays;

  return (
    <div className="progress-report mx-auto flex w-full max-w-3xl flex-col gap-6 py-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={onClose}><ChevronLeft className="mr-2 h-4 w-4" /> {t('Back')}</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copy}><Copy className="mr-2 h-4 w-4" /> {t('Copy as text')}</Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> {t('Print / PDF')}</Button>
        </div>
      </div>
      {copied && (
        <p className={`text-sm print:hidden ${copied === 'ok' ? 'text-emerald-300' : 'text-red-300'}`} role="status">
          {copied === 'ok' ? t('Summary copied. Paste it into an email or message.') : t("Couldn't copy on this device. Use Print / PDF instead.")}
        </p>
      )}

      <header>
        <h2 className="text-2xl font-bold [text-wrap:balance]">{t('Vision training report')}</h2>
        <p className="text-slate-400">{periodText} · {t('Stage')}: {t(phaseInfo(config.therapyPhase).label)}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {RANGES.map(r => (
          <Button key={r.id} size="sm" variant={range === r.id ? 'default' : 'outline'} onClick={() => setRange(r.id)} aria-pressed={range === r.id}>
            {t(r.label)}
          </Button>
        ))}
        {range === 'custom' && (
          <input
            id="report-since"
            type="date"
            value={since}
            max={dayKey(now)}
            onChange={e => e.target.value && setSince(e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm"
            aria-label={t('Report start date')}
          />
        )}
      </div>

      {/* Patch time */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 font-semibold">{t('Patch time')}</h3>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t('Total'), formatMinutes(patchTotal)],
            [t('Average a day'), formatMinutes(patchTotal / days)],
            [t('Goal met'), t('{met} of {days}', { met: daysGoalMet, days: daysText(days), n: days })],
            [t('Patch worn'), daysText(daysPatched)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <figure>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t(bucketDays === 7 ? 'Patch time per week' : 'Patch time per month')}>
            {[0, 0.5, 1].map(f => (
              <g key={f}>
                <line x1={L} x2={W - R} y1={y(maxBucket * f)} y2={y(maxBucket * f)} stroke="#1e293b" />
                <text x={L - 6} y={y(maxBucket * f)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#94a3b8">
                  {t('{h} h', { h: Math.round((maxBucket * f) / 60) })}
                </text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const h = (b.minutes / maxBucket) * (H - T - B);
              return (
                <g key={i}>
                  <rect x={L + i * bw + 2} y={H - B - h} width={Math.max(2, bw - 4)} height={h} rx={3} fill={BAR} fillOpacity={b.days < bucketDays ? 0.5 : 1}>
                    <title>{`${b.label}: ${formatMinutes(b.minutes)}${b.days < bucketDays ? ` (${t('{days} so far', { days: daysText(b.days) })})` : ''}`}</title>
                  </rect>
                  {(buckets.length <= 14 || i % Math.ceil(buckets.length / 14) === 0) && (
                    <text x={L + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#94a3b8">{b.label}</text>
                  )}
                </g>
              );
            })}
            {/* The goal for a full week (or month), as a dashed reference line. */}
            <line x1={L} x2={W - R} y1={y(goalLine)} y2={y(goalLine)} stroke="#facc15" strokeDasharray="6 5" strokeWidth={1.5} />
            <text x={W - R} y={y(goalLine) - 5} textAnchor="end" fontSize="11" fill="#facc15">{t('goal')}</text>
          </svg>
          <figcaption className="mt-1 text-xs text-slate-500">{t(bucketDays === 7 ? "Patch time per week. Dashed line: the daily goal for a full week. A lighter bar is a period that isn't complete yet." : "Patch time per 30 days. Dashed line: the daily goal for a full 30 days. A lighter bar is a period that isn't complete yet.")}</figcaption>
        </figure>
      </section>

      {/* Picture checks */}
      <section className="space-y-3">
        <h3 className="font-semibold">{t('Home picture checks')}</h3>
        {checks.length ? (
          <>
            <HistoryChart checks={checks} />
            <HistoryTable checks={checks} />
          </>
        ) : (
          <p className="text-slate-400">{t('No picture checks in this period.')}</p>
        )}
      </section>

      {/* Games */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 font-semibold">{t('Game practice')}</h3>
        <p className="mb-3 text-slate-300">
          {t('{sessions} on {days}, about {minutes} minutes.', { sessions: sessionsText(sessions.length), days: daysText(practiceDays), minutes: Math.round(practiceMinutes) })}
        </p>
        {skills.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr><th className="py-1 pr-3 font-medium">{t('Skill')}</th><th className="py-1 pr-3 text-right font-medium">{t('Sessions')}</th><th className="py-1 font-medium">{t('Games')}</th></tr>
              </thead>
              <tbody className="tabular-nums">
                {skills.map(([skill, v]) => (
                  <tr key={skill} className="border-t border-slate-800">
                    <td className="py-1.5 pr-3">{skill}</td>
                    <td className="py-1.5 pr-3 text-right">{v.sessions}</td>
                    <td className="py-1.5 text-slate-400">{[...v.games].join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {alignments.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <h4 className="mb-1 text-sm font-semibold">{t('Lion in the Cage readings')}</h4>
            <p className="mb-2 text-xs text-slate-500">{t('Where the pictures were lined up, in prism dioptres (+ = eyes in). A home game reading, not a measurement.')}</p>
            <p className="text-sm tabular-nums">{alignments.map(a => `${fmtDate(a.date)}: ${a.alignedPD}`).join(' · ')}</p>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        {t("Home data from the Vision Hero app: patch times entered at home, home picture checks and game practice. These are not clinical measurements; the eye clinic's results are the ones that count.")}{' '}
        {t('Generated {date}.', { date: new Date(now).toLocaleString(locale()) })}
      </p>
    </div>
  );
};
