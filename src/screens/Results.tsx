import { useMemo } from 'react';
import { useGame } from '../app/store';
import { Button } from '../components/Button';
import ui from '../components/ui.module.css';
import { festivalOf } from '../core/game';
import { formatNumber, formatPercent, formatPounds } from '../core/format';
import { festivalResults } from '../core/results';
import styles from './Results.module.css';

function starText(count: number): string {
  return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;
}

/** The newspaper review, forecast against actual, the causes and Randy's verdict. */
export function Results() {
  const { game, dispatch, go } = useGame();
  const r = useMemo(() => festivalResults(game), [game]);
  const f = festivalOf(game);
  const paper = r.newspaper;
  const fc = r.forecast;
  const rows: [string, string, string][] = [
    ['Attendance', fc ? formatNumber(fc.attendees) : '–', formatNumber(r.outcome.attendees)],
    ['Income', fc ? formatPounds(fc.income) : '–', formatPounds(r.outcome.income)],
    ['Profit', fc ? formatPounds(fc.profit) : '–', formatPounds(r.outcome.profit)],
  ];

  return (
    <main className={ui.screen} style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <div className={ui.content}>
        <article className={styles.paper} aria-label={`${paper.paper} review`}>
          <header className={styles.masthead}>
            <span className={styles.paperName}>{paper.paper}</span>
            <span className={styles.edition}>Festival review</span>
          </header>
          <h1 className={styles.headline}>{paper.headline}</h1>
          <p className={styles.stars} aria-label={`${paper.stats.stars} of 3 stars`}>
            {starText(paper.stats.stars)}
          </p>
          <div className={styles.columns}>
            {paper.opening && <p>{paper.opening}</p>}
            {paper.successLine && <p>{paper.successLine}</p>}
            {paper.eventLine && <p>{paper.eventLine}</p>}
            <p>{paper.closing}</p>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>Profit</dt>
              <dd>{formatPounds(paper.stats.profit)}</dd>
            </div>
            <div>
              <dt>Crowd</dt>
              <dd>{formatNumber(paper.stats.attendance)} people</dd>
            </div>
            <div>
              <dt>Band mood</dt>
              <dd>{paper.stats.bandMood}</dd>
            </div>
            <div>
              <dt>Stars</dt>
              <dd>{paper.stats.stars} of 3</dd>
            </div>
          </dl>
        </article>

        <section className={ui.randy} aria-label="Randy Popping says">
          <div className={ui.randyFace} aria-hidden="true">
            🧓
          </div>
          <div className={ui.randyBody}>
            <div className={ui.randyName}>Randy Popping</div>
            {r.randy.map((line) => (
              <p key={line} className={ui.randyText}>
                {line}
              </p>
            ))}
            {r.tip && (
              <p className={ui.randyText}>
                <strong>Tip:</strong> {r.tip}
              </p>
            )}
          </div>
        </section>

        <section className={ui.card} aria-label="Your stars">
          <h2 className={ui.cardTitle}>Targets</h2>
          <ul className={styles.list}>
            <li className={r.stars.profit ? ui.ok : ui.bad}>
              {r.stars.profit ? '★' : '☆'} Profit {formatPercent(r.outcome.profitPct)} of spend (target {formatPercent(f.targets.profit)})
            </li>
            <li className={r.stars.customers ? ui.ok : ui.bad}>
              {r.stars.customers ? '★' : '☆'} Crowd {formatPercent(r.outcome.customerSatisfaction)} (target {formatPercent(f.targets.customers)})
            </li>
            <li className={r.stars.bands ? ui.ok : ui.bad}>
              {r.stars.bands ? '★' : '☆'} Bands {formatPercent(r.outcome.bandSatisfaction)} (target {formatPercent(f.targets.bands)})
            </li>
          </ul>
        </section>

        <section className={ui.card} aria-label="Forecast against actual">
          <h2 className={ui.cardTitle}>Forecast against actual</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">Forecast</th>
                <th scope="col">Actual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, forecast, actual]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{forecast}</td>
                  <td>{actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={ui.muted} style={{ marginBottom: 0 }}>
            The forecast was made before the gates opened, before any events.
          </p>
        </section>

        <section className={ui.card} aria-label="Why it went this way">
          <h2 className={ui.cardTitle}>Why it went this way</h2>
          {r.causes.length > 0 ? (
            <ul className={styles.list}>
              {r.causes.map((cause) => (
                <li key={cause}>✗ {cause}</li>
              ))}
            </ul>
          ) : (
            <p style={{ marginTop: 0 }}>Nothing held you back.</p>
          )}
          <p className={ui.ok} style={{ marginBottom: 0 }}>
            ✓ Went well: {r.wentWell}
          </p>
        </section>

        <section className={ui.card} aria-label="Money and reputation">
          <h2 className={ui.cardTitle}>Money and reputation</h2>
          <p style={{ margin: 0 }} className={r.cashAfter < 0 ? ui.bad : undefined}>
            {r.cashAfter < 0 ? `Shortfall: ${formatPounds(-r.cashAfter)}` : `Cash after the festival: ${formatPounds(r.cashAfter)}`}
          </p>
          <p style={{ margin: '4px 0 0' }}>
            Festival reputation {Math.round(r.reputationBefore)} → {Math.round(r.reputationAfter)}
          </p>
        </section>

        <div className={styles.buttons}>
          <Button variant="primary" wide disabled={!r.passed} title="Festival 2 arrives in a later milestone">
            {r.passed ? 'Next festival: coming soon' : 'Next festival: needs 2 stars'}
          </Button>
          <Button variant={r.passed ? 'secondary' : 'primary'} wide onClick={() => {
            dispatch({ type: 'replay' });
            go({ name: 'hub' });
          }}>
            Replay {f.name}
          </Button>
          <Button variant="ghost" wide onClick={() => go({ name: 'menu' })}>
            Main menu
          </Button>
        </div>
      </div>
    </main>
  );
}
