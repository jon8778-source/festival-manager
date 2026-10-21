import { useStore } from '../app/store';
import { Button } from '../components/Button';
import ui from '../components/ui.module.css';
import { festivalOf } from '../core/game';
import { formatNumber, formatPercent, formatPounds } from '../core/format';

/** Placeholder until the festival day is built: shows the forecast stored when the gates opened. */
export function FestivalDay() {
  const { game, go, startNewGame } = useStore();
  if (!game) return null;
  const f = festivalOf(game);
  const fc = game.forecastAtGates;
  return (
    <main className={ui.screen} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <div className={ui.content}>
        <h1 style={{ margin: 0 }}>🎪 Gates are open at the {f.name}</h1>
        <p>The live festival day arrives in the next build. Here's where your preparation landed.</p>
        {fc && (
          <section className={ui.card} aria-label="Forecast at gates">
            <h2 className={ui.cardTitle}>Forecast before events</h2>
            <dl className={ui.statGrid}>
              <div>
                <dt>Attendance</dt>
                <dd>{formatNumber(fc.attendees)}</dd>
              </div>
              <div>
                <dt>Profit</dt>
                <dd>
                  {formatPounds(fc.profit)} ({formatPercent(fc.profitPct)})
                </dd>
              </div>
              <div>
                <dt>Crowd</dt>
                <dd>{formatPercent(fc.customerSatisfaction)}</dd>
              </div>
              <div>
                <dt>Bands</dt>
                <dd>{formatPercent(fc.bandSatisfaction)}</dd>
              </div>
            </dl>
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
