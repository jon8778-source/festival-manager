import { useState } from 'react';
import { useGame } from '../app/store';
import { Button } from '../components/Button';
import { CompactForecast } from '../components/ForecastPanel';
import { Screen } from '../components/Screen';
import ui from '../components/ui.module.css';
import { bandPool, defaultContent, getBand, type Band } from '../core/content';
import {
  bookingSlot,
  festivalOf,
  forecastOf,
  hintFor,
  isLineupLocked,
  planTicketPrice,
  profileOf,
  talksFor,
  type GameState,
} from '../core/game';
import { formatNumber, formatPounds } from '../core/format';
import { expectedSlot, gateOpen } from '../core/negotiation';
import styles from './Lineup.module.css';

const SLOT_LABEL = { headliner: 'Headliner', support: 'Support', opener: 'Opener' } as const;

export function statusChip(game: GameState, band: Band) {
  if (!gateOpen(band.tier, game.reputation)) return <span className={`${ui.chip} ${ui.bad}`}>🔒 Not yet</span>;
  const slot = bookingSlot(game, band.id);
  if (slot) return <span className={`${ui.chip} ${ui.ok}`}>✓ {SLOT_LABEL[slot]}</span>;
  const talks = talksFor(game, band.id);
  if (talks.status === 'closed') return <span className={`${ui.chip} ${ui.bad}`}>✗ Talks closed</span>;
  if (talks.counter) return <span className={`${ui.chip} ${ui.close}`}>↔ Counter</span>;
  if (talks.rounds.length > 0) return <span className={`${ui.chip} ${ui.close}`}>… In talks</span>;
  return null;
}

export function Lineup() {
  const { game, go } = useGame();
  const f = festivalOf(game);
  const pool = bandPool(defaultContent, f);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? getBand(defaultContent, selectedId) : null;
  const fc = forecastOf(game);
  const locked = isLineupLocked(game);

  return (
    <Screen title="Lineup">
      <section aria-label="Bill" className={styles.bill}>
        {f.slots.map((slot) => {
          const booking = game.lineup[slot];
          const band = booking ? getBand(defaultContent, booking.bandId) : null;
          return (
            <div key={slot} className={`${styles.slot} ${slot === 'headliner' ? styles.headlinerSlot : ''}`}>
              <span className={styles.slotLabel}>{SLOT_LABEL[slot]}</span>
              <span className={styles.slotBand}>{band ? band.name : 'Empty'}</span>
              {booking && (
                <span className={ui.muted}>
                  {formatPounds(booking.fee)} · {booking.merchPct}% merch
                </span>
              )}
            </div>
          );
        })}
      </section>
      <p className={ui.muted} style={{ margin: 0 }}>
        Ticket {formatPounds(planTicketPrice(game))} · forecast {formatNumber(fc.attendees)} people · profit{' '}
        {formatPounds(fc.profit)}
        {locked ? ' · Lineup locked' : ''}
      </p>

      <ul className={styles.bands} aria-label="Bands">
        {pool.map((band) => (
          <li key={band.id}>
            <button
              type="button"
              className={`${styles.band} ${band.id === selectedId ? styles.selected : ''}`}
              aria-pressed={band.id === selectedId}
              onClick={() => setSelectedId(band.id)}
            >
              <span className={styles.bandHead}>
                <strong>{band.name}</strong> {statusChip(game, band)}
              </span>
              <span className={ui.muted}>
                Tier {band.tier} · {band.genre} · 🎧 {formatNumber(band.monthlyListeners)} · 🔥 {band.hype}
              </span>
            </button>
            {selected && band.id === selected.id && (
        <section className={ui.card} aria-label={`${selected.name} details`}>
          <h2 className={ui.cardTitle}>
            {selected.name} {statusChip(game, selected)}
          </h2>
          <p style={{ margin: '0 0 8px' }}>
            Tier {selected.tier} · {selected.genre} · {formatNumber(selected.monthlyListeners)} monthly listeners ({selected.trend}) · hype{' '}
            {selected.hype} · reputation {selected.reputation}
          </p>
          <p className={ui.muted} style={{ margin: '0 0 8px' }}>
            {selected.notes}
            {selected.emerging ? ' · Emerging act' : ''}
          </p>
          {gateOpen(selected.tier, game.reputation) ? (
            <p style={{ margin: '0 0 8px' }}>
              🧓 Randy: acts like this go for {formatPounds(hintFor(game, selected).low)} to {formatPounds(hintFor(game, selected).high)}
              , expecting the {expectedSlot(profileOf(selected))} slot and {selected.merchAsk}% of the merch.
            </p>
          ) : (
            <p className={ui.bad}>Not at this festival yet.</p>
          )}
          <div className={ui.buttonRow}>
            <Button
              variant="primary"
              disabled={locked || !gateOpen(selected.tier, game.reputation) || talksFor(game, selected.id).status !== 'open'}
              onClick={() => go({ name: 'negotiation', bandId: selected.id })}
            >
              {talksFor(game, selected.id).counter ? 'See their counter' : 'Make an offer'}
            </Button>
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </div>
        </section>
            )}
          </li>
        ))}
      </ul>
      <CompactForecast />
    </Screen>
  );
}
