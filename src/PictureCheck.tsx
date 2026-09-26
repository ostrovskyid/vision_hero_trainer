import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, CreditCard, Minus, Plus, Glasses } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShapeIcon, ShapeKind, SHAPE_NAMES } from './shapes';
import { VisionCheck } from './types';

/**
 * The monthly picture check: a parent-run home test with picture symbols
 * (circle, square, house, apple, as on the LEA Symbols chart used for
 * children), sized in real millimetres for a fixed viewing distance.
 *
 * It is a TREND check, not a clinical measurement: screens, lighting and
 * distances at home are not an eye clinic. Its value is repeating it the same
 * way every month and bringing the history to checkups.
 *
 * Procedure: lines from logMAR 1.3 (decimal 0.05) down to 0.0 (1.0); five
 * pictures per line, a line is passed with three right and failed with three
 * wrong. It starts a little easier than last time and stops at the first
 * failed line below a passed one.
 */

const SYMBOLS: ShapeKind[] = ['circle', 'square', 'house', 'apple'];
const LARGEST = 1.3;
const SMALLEST = 0.0;
const STEP = 0.1;
/** Smaller than this and the screen's pixels, not the eye, decide the answer. */
const MIN_SYMBOL_PX = 8;
/** A standard bank card is 85.6 mm wide (ISO/IEC 7810 ID-1). */
const CARD_MM = 85.6;

export const EYE_LABEL: Record<VisionCheck['eye'], string> = {
  left: 'Left eye',
  right: 'Right eye',
  both: 'Both eyes',
};

export const toDecimal = (logMAR: number) => {
  const d = Math.pow(10, -logMAR);
  return d >= 0.995 ? '1.0' : d.toFixed(2).replace(/0$/, '');
};

/** Picture height in CSS px for a line: a symbol is 5 × the minimum angle of resolution. */
const symbolPx = (logMAR: number, distanceCm: number, pxPerMm: number) => {
  const marArcmin = Math.pow(10, logMAR);
  const heightMm = distanceCm * 10 * Math.tan(((5 * marArcmin) / 60) * (Math.PI / 180));
  return heightMm * pxPerMm;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

type Step = 'setup' | 'calibrate' | 'test' | 'result' | 'history';

interface TestState {
  line: number;
  right: number;
  wrong: number;
  /** Best (smallest) line passed so far, or null. */
  best: number | null;
  symbol: ShapeKind;
  shown: number;
  done: boolean;
  belowChart: boolean;
  atLimit: boolean;
}

export const PictureCheckScreen = ({ checks, pxPerMm, onCalibrate, onSave, onClose }: {
  checks: VisionCheck[];
  pxPerMm: number;
  onCalibrate: (pxPerMm: number) => void;
  onSave: (check: VisionCheck) => void;
  onClose: () => void;
}) => {
  const [step, setStep] = useState<Step>(pxPerMm > 0 ? 'setup' : 'calibrate');
  const [eye, setEye] = useState<VisionCheck['eye']>('left');
  const [distanceCm, setDistanceCm] = useState(100);
  const [glasses, setGlasses] = useState(true);
  const [crowded, setCrowded] = useState(true);
  const [cardPx, setCardPx] = useState(pxPerMm > 0 ? pxPerMm : 96 / 25.4);
  const [test, setTest] = useState<TestState | null>(null);
  const [result, setResult] = useState<VisionCheck | null>(null);
  const lastSymbol = useRef<ShapeKind | null>(null);

  const nextSymbol = () => {
    const options = SYMBOLS.filter(s => s !== lastSymbol.current);
    const s = options[Math.floor(Math.random() * options.length)];
    lastSymbol.current = s;
    return s;
  };

  // The smallest line this screen can draw sharply at this distance.
  const limitLine = useMemo(() => {
    let line = SMALLEST;
    while (line < LARGEST && symbolPx(line, distanceCm, pxPerMm || cardPx) < MIN_SYMBOL_PX) line = round1(line + STEP);
    return line;
  }, [distanceCm, pxPerMm, cardPx]);

  const start = () => {
    const previous = [...checks].reverse().find(c => c.eye === eye && c.distanceCm === distanceCm);
    // Start two lines easier than last time, so the first pictures are a sure win.
    const startLine = Math.min(LARGEST, Math.max(limitLine, previous ? round1(previous.logMAR + 0.2) : 1.0));
    setTest({ line: startLine, right: 0, wrong: 0, best: null, symbol: nextSymbol(), shown: 1, done: false, belowChart: false, atLimit: false });
    setStep('test');
  };

  const finish = (t: TestState) => {
    const check: VisionCheck = {
      date: new Date().toISOString(),
      eye,
      distanceCm,
      glasses,
      crowded,
      logMAR: t.best ?? LARGEST,
      ...(t.belowChart ? { belowChart: true } : {}),
      ...(t.atLimit ? { atLimit: true } : {}),
    };
    setResult(check);
    setStep('result');
  };

  const answer = (choice: ShapeKind | null) => {
    if (!test) return;
    const correct = choice === test.symbol;
    const t = { ...test, right: test.right + (correct ? 1 : 0), wrong: test.wrong + (correct ? 0 : 1) };
    if (t.right >= 3) {
      // Line passed: go one line smaller, unless this is as small as the screen allows.
      t.best = t.line;
      if (t.line <= limitLine) {
        finish({ ...t, atLimit: true });
        return;
      }
      setTest({ ...t, line: round1(t.line - STEP), right: 0, wrong: 0, symbol: nextSymbol(), shown: 1 });
      return;
    }
    if (t.wrong >= 3) {
      if (t.best !== null) {
        finish(t);
        return;
      }
      // Nothing passed yet: try a bigger line.
      if (t.line >= LARGEST) {
        finish({ ...t, belowChart: true });
        return;
      }
      setTest({ ...t, line: round1(t.line + STEP), right: 0, wrong: 0, symbol: nextSymbol(), shown: 1 });
      return;
    }
    setTest({ ...t, symbol: nextSymbol(), shown: t.shown + 1 });
  };

  const header = (title: string, back: () => void) => (
    <div className="flex w-full items-center justify-between">
      <Button variant="ghost" onClick={back}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
      <h2 className="text-xl font-bold md:text-2xl">{title}</h2>
      <div className="w-20" />
    </div>
  );

  if (step === 'calibrate') {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-4">
        {header('Screen size', () => (pxPerMm > 0 ? setStep('setup') : onClose()))}
        <p className="max-w-lg text-center text-slate-300">
          Pictures must be a real size in millimetres, and every screen is different. Hold a bank card
          (or any ID-size card) flat against the screen and make the box exactly as wide as the card.
        </p>
        <div className="w-full overflow-x-auto">
          <div
            className="mx-auto flex items-center justify-center rounded-lg border-2 border-dashed border-sky-400 bg-sky-400/10"
            style={{ width: CARD_MM * cardPx, height: 53.98 * cardPx }}
          >
            <CreditCard className="h-10 w-10 text-sky-300" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="lg" onClick={() => setCardPx(p => Math.max(2, p - 0.02))} aria-label="Smaller"><Minus className="h-5 w-5" /></Button>
          <input
            type="range" min={2} max={9} step={0.01} value={cardPx}
            onChange={e => setCardPx(Number(e.target.value))}
            className="w-56 accent-sky-400"
            aria-label="Card box width"
          />
          <Button variant="outline" size="lg" onClick={() => setCardPx(p => Math.min(9, p + 0.02))} aria-label="Bigger"><Plus className="h-5 w-5" /></Button>
        </div>
        <Button size="lg" onClick={() => { onCalibrate(cardPx); setStep('setup'); }}>The box matches the card</Button>
        <p className="text-sm text-slate-500">Done once per device. Page zoom must stay at 100%.</p>
      </div>
    );
  }

  if (step === 'test' && test) {
    const size = symbolPx(test.line, distanceCm, pxPerMm);
    const near = distanceCm <= 50;
    return (
      // A white page with black pictures, like a printed chart.
      <div className="fixed inset-0 z-[80] flex flex-col bg-white text-slate-900">
        <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-500">
          <button onClick={() => { setTest(null); setStep('setup'); }} className="rounded px-3 py-2 hover:bg-slate-100">Stop</button>
          {/* Parent-only progress, small and grey so it does not distract. */}
          <span className="tabular-nums">{EYE_LABEL[eye]} · {distanceCm} cm · line {toDecimal(test.line)} · {test.shown}/5</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            key={`${test.line}-${test.shown}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center"
            style={crowded ? {
              // Crowding box: a surrounding bar half a symbol away, one stroke thick.
              padding: size * 0.5,
              border: `${Math.max(1, size / 5)}px solid #0f172a`,
            } : undefined}
          >
            <ShapeIcon kind={test.symbol} size={size} color="#0f172a" />
          </motion.div>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 pb-6 pt-3">
          <p className="mb-3 text-center text-sm text-slate-500">
            {near ? 'Tap the same picture.' : 'Parent: tap the picture your child names or points to.'}
          </p>
          <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-3">
            {SYMBOLS.map(s => (
              <button
                key={s}
                onClick={() => answer(s)}
                aria-label={SHAPE_NAMES[s]}
                className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-slate-300 bg-white hover:border-slate-500 active:scale-95"
              >
                <ShapeIcon kind={s} size={36} color="#0f172a" />
              </button>
            ))}
            <button
              onClick={() => answer(null)}
              className="h-16 rounded-xl border-2 border-slate-300 bg-white px-4 text-base font-medium text-slate-600 hover:border-slate-500"
            >
              Not sure
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'result' && result) {
    const previous = [...checks].reverse().find(c => c.eye === result.eye && c.distanceCm === result.distanceCm);
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-4 text-center">
        {header('Picture check', () => setStep('setup'))}
        <div className="text-6xl">⭐</div>
        <div>
          <div className="text-sm uppercase tracking-wider text-slate-400">{EYE_LABEL[result.eye]} · {result.distanceCm} cm{result.glasses ? ' · with glasses' : ''}</div>
          <div className="mt-1 text-5xl font-bold tabular-nums">
            {result.belowChart ? `< ${toDecimal(LARGEST)}` : `${result.atLimit ? '≥ ' : ''}${toDecimal(result.logMAR)}`}
          </div>
          <div className="text-slate-400">logMAR {result.belowChart ? `> ${LARGEST.toFixed(1)}` : result.logMAR.toFixed(1)}</div>
        </div>
        {previous && (
          <p className="text-slate-300">
            Last time ({new Date(previous.date).toLocaleDateString()}): {toDecimal(previous.logMAR)}
          </p>
        )}
        {result.atLimit && (
          <p className="max-w-md text-sm text-amber-300">This is the smallest picture this screen can draw at {result.distanceCm} cm. Test from further away to see smaller lines.</p>
        )}
        <p className="max-w-md text-sm text-slate-500">
          A home trend check, not a medical test. Compare it with earlier checks done the same way, and bring the history to checkups.
        </p>
        <div className="flex gap-3">
          <Button size="lg" onClick={() => { onSave(result); setStep('history'); }}>Save result</Button>
          <Button size="lg" variant="outline" onClick={() => setStep('setup')}>Discard</Button>
        </div>
      </div>
    );
  }

  if (step === 'history') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4">
        {header('Picture check history', () => setStep('setup'))}
        <HistoryChart checks={checks} />
        <HistoryTable checks={checks} />
      </div>
    );
  }

  // Setup.
  const choice = (active: boolean) =>
    `rounded-lg border px-4 py-3 text-left transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 hover:border-slate-600'}`;
  const lastCheck = checks[checks.length - 1];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      {header('Monthly picture check', onClose)}
      <p className="text-slate-300">
        Do it the same way each month: same room, good light, glasses on as usual. Cover the other eye
        with the patch. For 1 m, measure the distance from the screen to your child's eyes.
      </p>

      <section className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-slate-400">Eye</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['left', 'right', 'both'] as const).map(e => (
            <button key={e} className={choice(eye === e)} onClick={() => setEye(e)} aria-pressed={eye === e}>
              <div className="font-medium">{EYE_LABEL[e]}</div>
              <div className="text-sm text-slate-400">{e === 'left' ? 'Patch on the right eye' : e === 'right' ? 'Patch on the left eye' : 'No patch'}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wider text-slate-400">Distance</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className={choice(distanceCm === 100)} onClick={() => setDistanceCm(100)} aria-pressed={distanceCm === 100}>
            <div className="font-medium">1 metre (recommended)</div>
            <div className="text-sm text-slate-400">Tablet on a table or stand; your child names or points, you tap.</div>
          </button>
          <button className={choice(distanceCm === 40)} onClick={() => setDistanceCm(40)} aria-pressed={distanceCm === 40}>
            <div className="font-medium">40 cm (near)</div>
            <div className="text-sm text-slate-400">Your child holds the tablet and taps. Smallest lines may not fit the screen.</div>
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Button variant={glasses ? 'default' : 'outline'} onClick={() => setGlasses(g => !g)}>
          <Glasses className="mr-2 h-4 w-4" /> {glasses ? 'With glasses' : 'Without glasses'}
        </Button>
        <Button variant={crowded ? 'default' : 'outline'} onClick={() => setCrowded(c => !c)}>
          {crowded ? 'Crowding box on' : 'Crowding box off'}
        </Button>
        <Button variant="ghost" onClick={() => setStep('calibrate')}>Screen size…</Button>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={start} className="px-8">Start check</Button>
        <Button size="lg" variant="outline" onClick={() => setStep('history')} disabled={checks.length === 0}>History ({checks.length})</Button>
      </div>
      {lastCheck && (
        <p className="text-sm text-slate-500">
          Last check: {new Date(lastCheck.date).toLocaleDateString()}, {EYE_LABEL[lastCheck.eye].toLowerCase()} {toDecimal(lastCheck.logMAR)}.
        </p>
      )}
    </div>
  );
};

// --- History ---

// Categorical slots 1-3 of the reference palette, dark steps (validated on the card surface).
const SERIES: Record<VisionCheck['eye'], string> = { left: '#3987e5', right: '#d95926', both: '#199e70' };
// Decimal acuity ticks and their logMAR.
const TICKS: [string, number][] = [['1.0', 0], ['0.63', 0.2], ['0.5', 0.3], ['0.32', 0.5], ['0.2', 0.7], ['0.1', 1.0], ['0.05', 1.3]];

export const HistoryChart = ({ checks }: { checks: VisionCheck[] }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (checks.length === 0) return null;
  const W = 640, H = 260, L = 48, R = 72, T = 16, B = 32;
  const times = checks.map(c => new Date(c.date).getTime());
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const x = (t: number) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
  // Better vision (smaller logMAR) is higher on the chart.
  const y = (logMAR: number) => T + (Math.min(1.4, Math.max(0, logMAR)) / 1.4) * (H - T - B);
  const eyes = (['left', 'right', 'both'] as const).filter(e => checks.some(c => c.eye === e));
  const points = checks.map((c, i) => ({ c, i, px: x(times[i]), py: y(c.belowChart ? 1.4 : c.logMAR) }));
  const hovered = hover !== null ? points[hover] : null;

  return (
    <figure className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-50">Vision over time</span>
        {/* Legend: always shown for two or more eyes; colour is never the only cue (direct labels too). */}
        <span className="flex gap-4 text-sm text-slate-300">
          {eyes.map(e => (
            <span key={e} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES[e] }} /> {EYE_LABEL[e]}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="Picture check results over time">
          {TICKS.map(([label, v]) => (
            <g key={label}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#1e293b" strokeWidth={1} />
              <text x={L - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#94a3b8">{label}</text>
            </g>
          ))}
          <text x={L} y={H - 8} fontSize="11" fill="#94a3b8">{new Date(t0).toLocaleDateString()}</text>
          {t1 !== t0 && <text x={W - R} y={H - 8} textAnchor="end" fontSize="11" fill="#94a3b8">{new Date(t1).toLocaleDateString()}</text>}
          {eyes.map(e => {
            const series = points.filter(p => p.c.eye === e);
            const last = series[series.length - 1];
            return (
              <g key={e}>
                {series.length > 1 && (
                  <polyline points={series.map(p => `${p.px},${p.py}`).join(' ')} fill="none" stroke={SERIES[e]} strokeWidth={2} strokeLinejoin="round" />
                )}
                {series.map(p => (
                  <circle key={p.i} cx={p.px} cy={p.py} r={5} fill={SERIES[e]} stroke="#0f172a" strokeWidth={2} />
                ))}
                {/* Direct label on the latest point. */}
                <text x={last.px + 10} y={last.py} dominantBaseline="middle" fontSize="12" fill="#e2e8f0">
                  {e === 'both' ? 'Both' : e === 'left' ? 'Left' : 'Right'} {toDecimal(last.c.logMAR)}
                </text>
              </g>
            );
          })}
          {/* Generous invisible hit targets for hover and touch. */}
          {points.map(p => (
            <circle
              key={`hit-${p.i}`} cx={p.px} cy={p.py} r={14} fill="transparent"
              onPointerEnter={() => setHover(p.i)} onPointerLeave={() => setHover(null)} onClick={() => setHover(p.i)}
            />
          ))}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 shadow-lg"
            style={{ left: `${(hovered.px / W) * 100}%`, top: `${(hovered.py / H) * 100}%`, transform: 'translate(-50%, -130%)' }}
          >
            {new Date(hovered.c.date).toLocaleDateString()} · {EYE_LABEL[hovered.c.eye]} · <strong>{toDecimal(hovered.c.logMAR)}</strong> · {hovered.c.distanceCm} cm
          </div>
        )}
      </div>
    </figure>
  );
};

export const HistoryTable = ({ checks }: { checks: VisionCheck[] }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-800">
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-900 text-slate-400">
        <tr>
          <th className="px-3 py-2 font-medium">Date</th>
          <th className="px-3 py-2 font-medium">Eye</th>
          <th className="px-3 py-2 text-right font-medium">Vision</th>
          <th className="px-3 py-2 text-right font-medium">logMAR</th>
          <th className="px-3 py-2 font-medium">How</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {[...checks].reverse().map((c, i) => (
          <tr key={i} className="border-t border-slate-800">
            <td className="px-3 py-2">{new Date(c.date).toLocaleDateString()}</td>
            <td className="px-3 py-2">{EYE_LABEL[c.eye]}</td>
            <td className="px-3 py-2 text-right font-semibold">{c.belowChart ? `< ${toDecimal(LARGEST)}` : `${c.atLimit ? '≥ ' : ''}${toDecimal(c.logMAR)}`}</td>
            <td className="px-3 py-2 text-right">{c.logMAR.toFixed(1)}</td>
            <td className="px-3 py-2 text-slate-400">{c.distanceCm} cm · {c.glasses ? 'glasses' : 'no glasses'} · {c.crowded ? 'crowded' : 'single'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
