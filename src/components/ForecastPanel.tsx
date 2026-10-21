import { useGame } from '../app/store';
import { festivalOf, forecastOf, forecastStars, unitsOf } from '../core/game';
import { formatNumber, formatPercent, formatPounds } from '../core/format';
import { foodQueuePeakDemand } from '../core/economy';
import { defaultTuning } from '../core/tuning';
import styles from './ui.module.css';

export function Meter({ label, value, target }: { label: string; value: number; target: number }) {
  const met = value >= target;
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <span className={met ? styles.ok : styles.bad}>
          {formatPercent(value)} {met ? '✓' : '✗'} target {formatPercent(target)}
        </span>
      </div>
      <div className={styles.meterTrack} aria-hidden="true">
        <div className={`${styles.meterFill} ${met ? styles.meterFillOk : ''}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
        <div className={styles.meterTarget} style={{ left: `${target * 100}%` }} />
      </div>
    </div>
  );
}

function useForecast() {
  const { game } = useGame();
  const f = festivalOf(game);
  const fc = forecastOf(game);
  const stars = forecastStars(game);
  const foodServed = unitsOf(game, 'food') * defaultTuning.economy.unitServes;
  const queueRisk = fc.foodQueueRisk;
  return { f, fc, stars, queueRisk, foodServed };
}

function starText(count: number): string {
  return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;
}

/** "Forecast before events": the live plan through the core formulas (spec section 9). */
export function ForecastPanel() {
  const { f, fc, stars, queueRisk, foodServed } = useForecast();
  return (
    <section className={styles.card} aria-labelledby="forecast-title">
      <h2 id="forecast-title" className={styles.cardTitle}>
        Forecast before events <span aria-label={`${stars.count} of 3 stars`}>{starText(stars.count)}</span>
      </h2>
      <dl className={styles.statGrid}>
        <div>
          <dt>Attendance</dt>
          <dd>
            {formatNumber(fc.attendees)} ({formatPercent(fc.attendance)})
          </dd>
        </div>
        <div>
          <dt>Income</dt>
          <dd>{formatPounds(fc.income)}</dd>
        </div>
        <div>
          <dt>Spend</dt>
          <dd>{formatPounds(fc.spend)}</dd>
        </div>
        <div>
          <dt>Profit</dt>
          <dd className={stars.profit ? styles.ok : styles.bad}>
            {formatPounds(fc.profit)} ({formatPercent(fc.profitPct)}) {stars.profit ? '✓' : '✗'}
          </dd>
        </div>
      </dl>
      <Meter label="Profit vs spend" value={Math.max(0, fc.profitPct)} target={f.targets.profit} />
      <Meter label="Crowd" value={fc.customerSatisfaction} target={f.targets.customers} />
      <Meter label="Bands" value={fc.bandSatisfaction} target={f.targets.bands} />
      <p className={queueRisk ? styles.bad : styles.ok} style={{ marginBottom: 0 }}>
        {queueRisk ? '⚠️ Food queue risk' : '✓ No food queue'}: food for {formatNumber(foodServed)}, lunchtime peak{' '}
        {formatNumber(foodQueuePeakDemand(fc.attendees))}
      </p>
    </section>
  );
}

/** One-line forecast for Lineup, Site, Tickets and Finances. */
export function CompactForecast() {
  const { fc, stars, queueRisk } = useForecast();
  return (
    <section className={styles.compact} aria-label="Forecast before events">
      <strong>Forecast</strong>
      <span>👥 {formatNumber(fc.attendees)}</span>
      <span className={stars.profit ? styles.ok : styles.bad}>
        💷 {formatPounds(fc.profit)} {stars.profit ? '✓' : '✗'}
      </span>
      <span>
        Crowd {formatPercent(fc.customerSatisfaction)} {stars.customers ? '✓' : '✗'}
      </span>
      <span>
        Bands {formatPercent(fc.bandSatisfaction)} {stars.bands ? '✓' : '✗'}
      </span>
      <span aria-label={`${stars.count} of 3 stars`}>{starText(stars.count)}</span>
      {queueRisk && <span className={styles.bad}>⚠️ Food queue</span>}
    </section>
  );
}
