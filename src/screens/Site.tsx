import { useState } from 'react';
import { useGame } from '../app/store';
import { CompactForecast } from '../components/ForecastPanel';
import { Screen } from '../components/Screen';
import ui from '../components/ui.module.css';
import { defaultContent, festivalTimeline, getFacility } from '../core/content';
import { festivalOf, forecastOf, isEmergencyPricing, nextUnitCost, unitsOf } from '../core/game';
import { formatNumber, formatPercent, formatPounds } from '../core/format';
import styles from './Site.module.css';

/** Where each plot sits on the fixed map (CSS grid row and column), in plot order. */
const PLOT_CELLS: [number, number][] = [
  [2, 1], [3, 1], [4, 1],
  [2, 4], [3, 4], [4, 4],
  [5, 1], [5, 2], [5, 3], [5, 4],
  [6, 1], [6, 4],
];

type Tool = string | 'remove';

export function Site() {
  const { game, dispatch } = useGame();
  const f = festivalOf(game);
  const facilities = f.facilityTypes.map((id) => getFacility(defaultContent, id));
  const [tool, setTool] = useState<Tool | null>(null);
  const fc = forecastOf(game);
  const emergency = isEmergencyPricing(game);
  const price = nextUnitCost(game);
  const deadline = festivalTimeline(defaultContent, f).facilityDeadline;

  const tapPlot = (plot: number) => {
    if (!tool) return;
    const current = game.plots[plot];
    if (tool === 'remove') {
      if (current) dispatch({ type: 'removeFacility', plot });
    } else if (!current) {
      dispatch({ type: 'placeFacility', plot, facilityId: tool });
    }
  };

  return (
    <Screen title="Site">
      <div className={styles.map} role="group" aria-label="Site map">
        <div className={styles.stage}>🎤 Main stage</div>
        <div className={styles.crowd}>
          <span aria-hidden="true">🧍🧍‍♀️🧍🧍‍♂️</span>
          <span>Crowd area · {formatNumber(f.capacity)} capacity</span>
        </div>
        <div className={styles.gate}>🚪 Gate</div>
        {game.plots.map((p, i) => {
          const cell = PLOT_CELLS[i] ?? [7, 1 + (i % 4)];
          const facility = p ? getFacility(defaultContent, p.facilityId) : null;
          const label = facility ? `${facility.name}${p?.emergency ? ' (emergency)' : ''}` : 'Empty plot';
          return (
            <button
              key={i}
              type="button"
              className={`${styles.plot} ${facility ? styles.filled : ''}`}
              style={{ gridRow: cell[0], gridColumn: cell[1] }}
              aria-label={`Plot ${i + 1}: ${label}`}
              onClick={() => tapPlot(i)}
            >
              {facility ? facility.emoji : '＋'}
              {p?.emergency && <span className={styles.flag}>!</span>}
            </button>
          );
        })}
      </div>

      <section className={ui.card} aria-label="Build tray">
        <h2 className={ui.cardTitle}>Build tray</h2>
        <p className={ui.muted} style={{ marginTop: 0 }}>
          {tool ? (tool === 'remove' ? 'Tap a unit to cancel it.' : 'Now tap an empty plot.') : 'Tap an item, then tap a plot.'}{' '}
          {emergency
            ? 'The normal booking deadline has passed: emergency units cost 1.5 times, and bookings can no longer be cancelled.'
            : `Normal price until ${deadline} days to go; cancel for a full refund until then.`}
        </p>
        <div className={styles.tray} role="radiogroup" aria-label="Build item">
          {facilities.map((fac) => (
            <button
              key={fac.id}
              type="button"
              role="radio"
              aria-checked={tool === fac.id}
              className={`${ui.button} ${styles.trayItem} ${tool === fac.id ? ui.chosen : ''}`}
              onClick={() => setTool(tool === fac.id ? null : fac.id)}
            >
              <span className={styles.trayEmoji} aria-hidden="true">
                {fac.emoji}
              </span>
              <span>{fac.name}</span>
              <span className={ui.muted}>{formatPounds(price)}</span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={tool === 'remove'}
            className={`${ui.button} ${styles.trayItem} ${tool === 'remove' ? ui.chosen : ''}`}
            disabled={emergency}
            onClick={() => setTool(tool === 'remove' ? null : 'remove')}
          >
            <span className={styles.trayEmoji} aria-hidden="true">
              ✖️
            </span>
            <span>Cancel a unit</span>
            <span className={ui.muted}>Refund</span>
          </button>
        </div>
      </section>

      <section className={ui.card} aria-label="Capacity">
        <h2 className={ui.cardTitle}>Capacity and queues</h2>
        <ul className={styles.capacity}>
          {facilities.map((fac) => (
            <li key={fac.id}>
              {fac.emoji} {fac.name}: {unitsOf(game, fac.id)} units, serve {formatNumber(unitsOf(game, fac.id) * fac.servesPerUnit)}
            </li>
          ))}
          <li>
            Site serves <strong>{formatNumber(fc.capacityServed)}</strong> of a forecast {formatNumber(fc.attendees)} people (
            {formatPercent(fc.queueRatio)} served)
          </li>
          <li className={fc.queueRatio < 1 ? ui.bad : ui.ok}>{fc.queueRatio < 1 ? '⚠️ Expect queues' : '✓ No queues expected'}</li>
          <li className={fc.foodQueueRisk ? ui.bad : ui.ok}>
            {fc.foodQueueRisk ? '⚠️ Food queue likely at lunchtime' : '✓ Enough food for the lunchtime rush'}
          </li>
        </ul>
      </section>
      <CompactForecast />
    </Screen>
  );
}
