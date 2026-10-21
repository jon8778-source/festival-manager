import { useGame } from '../app/store';
import { CompactForecast } from '../components/ForecastPanel';
import { Screen } from '../components/Screen';
import ui from '../components/ui.module.css';
import { defaultContent, festivalTimeline } from '../core/content';
import { festivalOf, forecastOf, planTicketPrice } from '../core/game';
import { formatNumber, formatPercent, formatPounds } from '../core/format';
import { defaultTuning } from '../core/tuning';
import styles from './Negotiation.module.css';

export function Tickets() {
  const { game, dispatch } = useGame();
  const f = festivalOf(game);
  const p = defaultTuning.prep;
  const price = planTicketPrice(game);
  const fc = forecastOf(game);
  let running = 0;
  const curve = defaultContent.timeline.salesCurve.map((w) => ({ toDay: w.toDay, total: (running += w.share) }));
  const onSale = game.daysToGates <= festivalTimeline(defaultContent, f).onSaleDay;

  return (
    <Screen title="Tickets">
      <section className={ui.card} aria-label="Ticket price">
        <h2 className={ui.cardTitle}>Ticket price</h2>
        <output className={styles.value} style={{ display: 'block', fontSize: '2rem' }} aria-live="polite">
          {formatPounds(price)}
        </output>
        <input
          className={styles.slider}
          type="range"
          aria-label="Ticket price"
          min={p.ticketPriceMin}
          max={p.ticketPriceMax}
          step={p.ticketPriceStep}
          value={price}
          onChange={(e) => dispatch({ type: 'setTicketPrice', price: Number(e.target.value) })}
        />
        <div className={ui.meterHead}>
          <span>{formatPounds(p.ticketPriceMin)}</span>
          <span>{formatPounds(p.ticketPriceMax)}</span>
        </div>
        <p>🧓 Randy: a fair price is {formatPounds(f.fairPrice)}. Above it, fewer come; below it, the profit gets thin.</p>
        {game.pendingTicketPrice !== null && (
          <p className={ui.close}>
            ⏳ The new price takes effect tomorrow. Tickets sell at {formatPounds(game.ticketPrice)} until then.
          </p>
        )}
      </section>
      <section className={ui.card} aria-label="Sales">
        <h2 className={ui.cardTitle}>Sales</h2>
        <dl className={ui.statGrid}>
          <div>
            <dt>Forecast attendance</dt>
            <dd>
              {formatNumber(fc.attendees)} ({formatPercent(fc.attendance)})
            </dd>
          </div>
          <div>
            <dt>Sold so far</dt>
            <dd>
              {onSale ? `${formatNumber(game.ticketsSold)} of ${formatNumber(f.capacity)}` : 'Not on sale yet'}
            </dd>
          </div>
        </dl>
        <p className={ui.muted} style={{ marginBottom: 0 }}>
          Sales build towards the gates:{' '}
          {curve.map((w) => `${formatPercent(w.total)} by ${w.toDay === 0 ? 'the gates' : `${w.toDay} days to go`}`).join(', ')}, then
          walk-ups on the day.
        </p>
      </section>
      <CompactForecast />
    </Screen>
  );
}
