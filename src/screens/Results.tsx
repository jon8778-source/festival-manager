import { useStore, useGame } from '../app/store';
import { Button } from '../components/Button';
import ui from '../components/ui.module.css';
import { defaultContent, getEvent } from '../core/content';
import { clockLabel } from '../core/festivalDay';
import { festivalOf, liveOutcome, liveStars } from '../core/game';
import { formatNumber, formatPercent, formatPounds } from '../core/format';

/** Placeholder until the newspaper review is built: the day's outcome and the choices made. */
export function Results() {
  const { game } = useGame();
  const { go, startNewGame } = useStore();
  const f = festivalOf(game);
  const outcome = liveOutcome(game);
  const stars = liveStars(game);
  const day = game.day;
  return (
    <main className={ui.screen} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <div className={ui.content}>
        <h1 style={{ margin: 0 }}>🌙 Midnight at the {f.name}</h1>
        <p style={{ margin: 0 }}>The newspaper review arrives in the next build. Here's how the day went.</p>
        <section className={ui.card} aria-label="Stars">
          <h2 className={ui.cardTitle}>
            {'★'.repeat(stars.count)}
            {'☆'.repeat(3 - stars.count)} {stars.count} of 3 stars
          </h2>
          <dl className={ui.statGrid}>
            <div>
              <dt>Profit {stars.profit ? '✓' : '✗'}</dt>
              <dd>
                {formatPounds(outcome.profit)} ({formatPercent(outcome.profitPct)})
              </dd>
            </div>
            <div>
              <dt>Crowd</dt>
              <dd>{formatNumber(outcome.attendees)} people</dd>
            </div>
            <div>
              <dt>Crowd happiness {stars.customers ? '✓' : '✗'}</dt>
              <dd>{formatPercent(outcome.customerSatisfaction)}</dd>
            </div>
            <div>
              <dt>Band happiness {stars.bands ? '✓' : '✗'}</dt>
              <dd>{formatPercent(outcome.bandSatisfaction)}</dd>
            </div>
          </dl>
        </section>
        {day && (
          <section className={ui.card} aria-label="Decisions on the day">
            <h2 className={ui.cardTitle}>On the day</h2>
            <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
              {day.choices.map((ch) => {
                const event = getEvent(defaultContent, ch.eventId);
                const option = event.options.find((o) => o.key === ch.option);
                return (
                  <li key={ch.eventId}>
                    {clockLabel(ch.at)} {event.title}: {option?.label} ({ch.seconds.toFixed(1)}s to decide)
                    {ch.effect.fined ? `, fined ${formatPounds(ch.effect.fine)}` : ''}
                  </li>
                );
              })}
              {day.prevented.map((id) => (
                <li key={id} className={ui.ok}>
                  ✓ {getEvent(defaultContent, id).title}: avoided thanks to your planning
                </li>
              ))}
            </ul>
          </section>
        )}
        <Button variant="primary" wide onClick={startNewGame}>
          New game
        </Button>
        <Button wide onClick={() => go({ name: 'menu' })}>
          Main menu
        </Button>
      </div>
    </main>
  );
}
