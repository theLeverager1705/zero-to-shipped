import { useEffect, useRef, useState } from 'react';
import { shortDate, weekday } from '../../../shared/dates';
import type { DayPoint } from '../../../shared/stats';
import { MOOD_LABELS } from '../../../shared/types';

// Diverging mood scale: coral arm (low) -> neutral sand (okay) -> teal arm (good). Validated with the dataviz ramp checks.
export const MOOD_COLORS = ['#b8432a', '#f09a82', '#e6e3dd', '#6fbdbb', '#0f7c86'];
const MOOD_INK = ['#ffffff', '#13233a', '#13233a', '#13233a', '#ffffff'];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function roundedTopBar(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function describeDay(d: DayPoint, today: string): string {
  const mood = d.mood === null ? 'no check-in' : `mood ${d.mood}/5 ${MOOD_LABELS[d.mood - 1]}, energy ${d.energy}`;
  const screen = d.screen === null ? 'no screen time logged' : `${d.screen} of ${d.allowance} screen minutes${d.screen > d.allowance ? ', over allowance' : ''}`;
  return `${d.date === today ? 'Today' : `${weekday(d.date)} ${shortDate(d.date)}`}: ${mood}; ${screen}`;
}

const LABEL_H = 20;
const MOOD_H = 96;
const SCREEN_H = 110;
const GAP = 18;
const AXIS_H = 24;
const LEFT = 48;
const RIGHT = 8;

export function TrendChart({ days, today, kidName }: { days: DayPoint[]; today: string; kidName: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const plotW = Math.max(0, width - LEFT - RIGHT);
  const band = plotW / days.length;
  const cx = (i: number) => LEFT + band * i + band / 2;

  const moodTop = LABEL_H;
  const moodBottom = moodTop + MOOD_H;
  const moodY = (m: number) => moodTop + ((5 - m) / 4) * MOOD_H;

  const screenTop = moodBottom + GAP + LABEL_H;
  const screenBottom = screenTop + SCREEN_H;
  const maxMinutes = Math.max(60, ...days.map((d) => Math.max(d.screen ?? 0, d.allowance)));
  const yMax = Math.ceil(maxMinutes / 60) * 60;
  const screenY = (m: number) => screenBottom - (m / yMax) * SCREEN_H;
  const height = screenBottom + AXIS_H;

  const barW = Math.min(24, band * 0.56);
  const wide = width >= 560;

  const segments: { x: number; y: number }[][] = [];
  days.forEach((d, i) => {
    if (d.mood === null) return;
    const point = { x: cx(i), y: moodY(d.mood) };
    const prev = days[i - 1];
    if (i > 0 && prev.mood !== null && segments.length) segments[segments.length - 1].push(point);
    else segments.push([point]);
  });

  const activeDay = active === null ? null : days[active];
  const tooltipLeft = active === null ? 0 : Math.min(Math.max(cx(active) - 110, 0), Math.max(0, width - 220));

  return (
    <div className="trend">
      <div className="trend-toolbar">
        <div className="chart-legend" aria-label="Legend">
          <span>
            <i className="legend-swatch" style={{ background: 'var(--teal)' }} /> Within allowance
          </span>
          <span>
            <i className="legend-swatch" style={{ background: 'var(--coral)' }} /> Over allowance
          </span>
          <span>
            <i className="legend-line" /> Daily allowance
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {asTable ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">{kidName}’s last 14 days</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Mood</th>
                <th scope="col">Energy</th>
                <th scope="col">Screen (min)</th>
                <th scope="col">Allowance</th>
                <th scope="col">Quests done</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{d.date === today ? 'Today' : `${weekday(d.date)} ${shortDate(d.date)}`}</th>
                  <td>{d.mood === null ? '–' : `${d.mood}/5 ${MOOD_LABELS[d.mood - 1]}`}</td>
                  <td>{d.energy ?? '–'}</td>
                  <td className="num">{d.screen ?? '–'}</td>
                  <td className="num">{d.allowance}</td>
                  <td>{d.questsDone.length ? d.questsDone.join(', ') : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-wrap" ref={ref}>
          {width > 0 && (
            <svg width={width} height={height} role="group" aria-label={`${kidName}’s mood and screen time over the last 14 days`}>
              <rect x={cx(7) - band / 2} y={0} width={band * 7} height={screenBottom} className="week-band" />
              <text x={cx(13) + band / 2 - 4} y={12} textAnchor="end" className="axis-label">
                This week
              </text>

              <text x={LEFT} y={12} className="panel-label">
                Mood
              </text>
              {[1, 3, 5].map((m) => (
                <g key={m}>
                  <line x1={LEFT} x2={width - RIGHT} y1={moodY(m)} y2={moodY(m)} className="gridline" />
                  <text x={LEFT - 8} y={moodY(m) + 4} textAnchor="end" className="axis-label">
                    {MOOD_LABELS[m - 1]}
                  </text>
                </g>
              ))}
              {segments.map((seg, i) =>
                seg.length > 1 ? (
                  <polyline key={i} points={seg.map((p) => `${p.x},${p.y}`).join(' ')} className="mood-line" />
                ) : null,
              )}
              {days.map((d, i) =>
                d.mood === null ? null : <circle key={d.date} cx={cx(i)} cy={moodY(d.mood)} r={active === i ? 5.5 : 4} className="mood-dot" />,
              )}

              <text x={LEFT} y={screenTop - 8} className="panel-label">
                Screen time (min)
              </text>
              {[0, yMax / 2, yMax].map((m) => (
                <g key={m}>
                  <line x1={LEFT} x2={width - RIGHT} y1={screenY(m)} y2={screenY(m)} className={m === 0 ? 'baseline' : 'gridline'} />
                  <text x={LEFT - 8} y={screenY(m) + 4} textAnchor="end" className="axis-label num">
                    {m}
                  </text>
                </g>
              ))}
              {days.map((d, i) => {
                if (d.screen === null) return null;
                const over = d.screen > d.allowance;
                const top = screenY(d.screen);
                return (
                  <path
                    key={d.date}
                    d={roundedTopBar(cx(i) - barW / 2, top, barW, screenBottom - top)}
                    className={`${over ? 'bar-over' : 'bar-within'}${d.date === today ? ' bar-partial' : ''}`}
                  />
                );
              })}
              {days.map((d, i) => (
                <line
                  key={d.date}
                  x1={cx(i) - barW / 2 - 3}
                  x2={cx(i) + barW / 2 + 3}
                  y1={screenY(d.allowance)}
                  y2={screenY(d.allowance)}
                  className="allowance-tick"
                />
              ))}

              {days.map((d, i) => (
                <text key={d.date} x={cx(i)} y={height - 6} textAnchor="middle" className={`axis-label${d.date === today ? ' axis-today' : ''}`}>
                  {d.date === today ? (wide ? 'Today' : '•') : weekday(d.date).slice(0, wide ? 3 : 1)}
                </text>
              ))}

              {active !== null && <line x1={cx(active)} x2={cx(active)} y1={moodTop - 6} y2={screenBottom} className="crosshair" />}
              {days.map((d, i) => (
                <rect
                  key={d.date}
                  x={LEFT + band * i}
                  y={0}
                  width={band}
                  height={height}
                  className="hit-area"
                  tabIndex={0}
                  aria-label={describeDay(d, today)}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              ))}
            </svg>
          )}
          {activeDay && (
            <div className="chart-tooltip" style={{ left: tooltipLeft, top: moodTop }} role="presentation">
              <strong>{activeDay.date === today ? 'Today' : `${weekday(activeDay.date)} · ${shortDate(activeDay.date)}`}</strong>
              <span>
                Mood:{' '}
                {activeDay.mood === null ? 'no check-in' : `${activeDay.mood}/5 ${MOOD_LABELS[activeDay.mood - 1]} · energy ${activeDay.energy}`}
              </span>
              {activeDay.tags.length > 0 && <span>Tags: {activeDay.tags.join(', ')}</span>}
              <span>
                Screen:{' '}
                {activeDay.screen === null
                  ? 'not logged'
                  : `${activeDay.screen} of ${activeDay.allowance} min${activeDay.screen > activeDay.allowance ? ' (over)' : ''}${activeDay.date === today ? ' so far' : ''}`}
              </span>
              {activeDay.questsDone.length > 0 && <span>Quests: {activeDay.questsDone.join(', ')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MoodStrip({ moods, dates }: { moods: (number | null)[]; dates: string[] }) {
  return (
    <div className="strip" role="list">
      {moods.map((m, i) => {
        const label = `${weekday(dates[i])}: ${m === null ? 'no check-in' : `${m}/5 ${MOOD_LABELS[m - 1]}`}`;
        return (
          <span
            key={dates[i]}
            role="listitem"
            className={m === null ? 'strip-cell strip-empty' : 'strip-cell'}
            style={m === null ? undefined : { background: MOOD_COLORS[m - 1], color: MOOD_INK[m - 1] }}
            title={label}
            aria-label={label}
          >
            {m ?? ''}
          </span>
        );
      })}
    </div>
  );
}

export function MoodLegend() {
  return (
    <div className="chart-legend mood-legend" aria-label="Mood scale">
      {MOOD_LABELS.map((label, i) => (
        <span key={label}>
          <i className="legend-swatch" style={{ background: MOOD_COLORS[i] }} />
          {i + 1} {label}
        </span>
      ))}
      <span>
        <i className="legend-swatch legend-empty" /> No check-in
      </span>
    </div>
  );
}

export function ScreenRing({ used, allowance }: { used: number; allowance: number }) {
  const size = 136;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const over = used > allowance;
  const ratio = allowance > 0 ? Math.min(used / allowance, 1) : 1;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${used} of ${allowance} screen minutes used today`}>
      <circle cx={center} cy={center} r={r} fill="none" strokeWidth={stroke} className={over ? 'ring-track-over' : 'ring-track'} />
      {used > 0 && (
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          className={over ? 'ring-fill-over' : 'ring-fill'}
        />
      )}
      <text x={center} y={center - 2} textAnchor="middle" className="ring-value">
        {used}
      </text>
      <text x={center} y={center + 18} textAnchor="middle" className="ring-label">
        of {allowance} min
      </text>
    </svg>
  );
}
