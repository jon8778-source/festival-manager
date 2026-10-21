import { useGame } from '../app/store';
import { Button } from '../components/Button';
import { ForecastPanel } from '../components/ForecastPanel';
import { MenuRow } from '../components/MenuRow';
import { Screen } from '../components/Screen';
import styles from '../components/ui.module.css';
import { defaultContent } from '../core/content';
import {
  emailText,
  festivalOf,
  isLineupLocked,
  openSlots,
  pendingDecisionEmail,
  planTicketPrice,
  unreadCount,
  unitsOf,
} from '../core/game';
import { formatPercent, formatPounds } from '../core/format';
import { lineText } from '../core/tutorial';

/** Preparation hub: Randy's latest message, the menu list, the forecast and Continue. */
export function PrepHub() {
  const { game, dispatch, go } = useGame();
  const f = festivalOf(game);
  const filled = f.slots.length - openSlots(game).length;
  const inTalks = Object.values(game.talks).filter((t) => t.status === 'open' && t.rounds.length > 0).length;
  const pending = pendingDecisionEmail(game);
  const latestRandy = [...game.inbox].reverse().find((e) => emailText(e).from === 'Randy Popping');
  const last = game.tutorial.last;
  const units = f.facilityTypes.map((id) => unitsOf(game, id)).reduce((a, b) => a + b, 0);

  const footer = pending ? (
    <Button variant="primary" wide onClick={() => go({ name: 'inbox', emailId: pending.id })}>
      Decision waiting: {emailText(pending).subject}
    </Button>
  ) : (
    <Button variant="primary" wide onClick={() => dispatch({ type: 'continue' })}>
      Continue ▶ {game.daysToGates === 1 ? 'Open the gates' : ''}
    </Button>
  );

  return (
    <Screen title={f.name} back={false} footer={footer}>
      {game.tutorial.queue.length === 0 && (last || latestRandy) && (
        <section className={styles.card} aria-label="Randy's latest message">
          <div className={styles.randyName}>🧓 Randy Popping</div>
          <p style={{ margin: '4px 0 0' }}>
            {last ? lineText(defaultContent.lines, last) : latestRandy ? emailText(latestRandy).body : ''}
          </p>
        </section>
      )}
      <section className={styles.card} aria-label="Targets">
        <h2 className={styles.cardTitle}>Targets: two stars to pass</h2>
        <p style={{ margin: 0 }}>
          💷 Profit {formatPercent(f.targets.profit)} of spend · 😀 Crowd {formatPercent(f.targets.customers)} · 🎸 Bands{' '}
          {formatPercent(f.targets.bands)}
        </p>
      </section>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MenuRow icon="📥" label="Inbox" badge={unreadCount(game)} onClick={() => go({ name: 'inbox' })} />
        <MenuRow
          icon="🎤"
          label="Lineup"
          detail={`${filled} of ${f.slots.length} slots${isLineupLocked(game) ? ' · locked' : ''}`}
          onClick={() => go({ name: 'lineup' })}
        />
        <MenuRow icon="🤝" label="Negotiations" detail={`${inTalks} open`} onClick={() => go({ name: 'negotiations' })} />
        <MenuRow icon="🗺️" label="Site" detail={`${units} units`} onClick={() => go({ name: 'site' })} />
        <MenuRow icon="🎟️" label="Tickets" detail={formatPounds(planTicketPrice(game))} onClick={() => go({ name: 'tickets' })} />
        <MenuRow icon="💷" label="Finances" onClick={() => go({ name: 'finances' })} />
        <MenuRow icon="🏠" label="Main menu" onClick={() => go({ name: 'menu' })} />
      </nav>
      <ForecastPanel />
    </Screen>
  );
}
