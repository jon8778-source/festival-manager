import { useState } from 'react';
import { useGame } from '../app/store';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import ui from '../components/ui.module.css';
import { defaultContent, getBand } from '../core/content';
import { festivalOf, hintFor, offerBlocked, openSlots, profileOf, talksFor } from '../core/game';
import { formatNumber, formatPounds } from '../core/format';
import { expectedSlot, gateOpen, termVerdicts, type Slot, type Verdict } from '../core/negotiation';
import { defaultTuning } from '../core/tuning';
import { statusChip } from './Lineup';
import styles from './Negotiation.module.css';

const VERDICT: Record<Verdict, { label: string; className: string | undefined }> = {
  ok: { label: '✓ OK', className: ui.ok },
  close: { label: '≈ Close', className: ui.close },
  low: { label: '✗ Low', className: ui.bad },
};

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className={ui.meter}>
      <div className={ui.meterHead}>
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className={ui.meterTrack} aria-hidden="true">
        <div className={ui.meterFill} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Stepper({ value, onChange, step, min, max, format, label }: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format: (v: number) => string;
  label: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className={styles.stepper}>
      <Button aria-label={`Lower ${label}`} onClick={() => set(value - step)} disabled={value <= min}>
        −
      </Button>
      <output className={styles.value} aria-live="polite">
        {format(value)}
      </output>
      <Button aria-label={`Raise ${label}`} onClick={() => set(value + step)} disabled={value >= max}>
        +
      </Button>
    </div>
  );
}

const RESPONSE: Record<string, string> = {
  accept: 'Deal! They have signed.',
  counter: 'They want the gig, but not on those terms. Here is their counter.',
  reject: "Too low. They won't take that, and their patience is wearing thin.",
  walkedAway: "That's it: they've walked away from talks.",
  refused: 'Not at this festival yet.',
};

export function Negotiation({ bandId }: { bandId: string }) {
  const { game, dispatch, go } = useGame();
  const t = defaultTuning;
  const band = getBand(defaultContent, bandId);
  const profile = profileOf(band);
  const f = festivalOf(game);
  const talks = talksFor(game, bandId);
  const hint = hintFor(game, band);
  const expected = expectedSlot(profile);
  const open = openSlots(game);
  const feeStep = t.prep.feeStep;

  const [fee, setFee] = useState(() => talks.counter?.offer.fee ?? Math.round(hint.low / feeStep) * feeStep);
  const [slot, setSlot] = useState<Slot>(() => talks.counter?.offer.slot ?? (open.includes(expected) ? expected : (open[0] ?? expected)));
  const [merch, setMerch] = useState(() => talks.counter?.offer.merchPct ?? band.merchAsk);

  const offer = { fee, slot, merchPct: merch };
  const verdicts = termVerdicts(profile, game.reputation, offer);
  const blocked = talks.status === 'open' ? offerBlocked(game, bandId, offer) : null;
  const lastRound = talks.rounds[talks.rounds.length - 1];
  // Accepting a counter or walking away ends talks without a new round, so status decides first.
  const responseText =
    talks.status === 'signed'
      ? RESPONSE.accept
      : talks.status === 'closed' && lastRound?.result !== 'walkedAway'
        ? 'You walked away from talks.'
        : lastRound && RESPONSE[lastRound.result];
  const whoIsOn = (s: Slot) => {
    const b = game.lineup[s];
    return b ? getBand(defaultContent, b.bandId).name : null;
  };

  return (
    <Screen title={band.name}>
      <section className={ui.card} aria-label="Band">
        <h2 className={ui.cardTitle}>
          {band.name} {statusChip(game, band)}
        </h2>
        <p style={{ margin: 0 }}>
          Tier {band.tier} · {band.genre} · 🎧 {formatNumber(band.monthlyListeners)} monthly listeners
        </p>
        <Bar label={`${f.name} reputation`} value={game.reputation} />
        <Bar label={`${band.name} reputation`} value={band.reputation} />
        <Bar label="Hype" value={band.hype} />
        <Bar label="Mood" value={talks.mood} />
        <p className={ui.muted} style={{ margin: '8px 0 0' }}>
          Rounds of patience left: {talks.patience} of {t.negotiation.patience}
        </p>
      </section>

      {!gateOpen(band.tier, game.reputation) && <p className={ui.notice}>Not at this festival yet.</p>}

      {lastRound && (
        <section className={ui.card} aria-live="polite" aria-label="Their response">
          <h2 className={ui.cardTitle}>Their response</h2>
          <p style={{ margin: 0 }}>{responseText}</p>
          {talks.counter && (
            <p style={{ margin: '8px 0 0' }}>
              <strong>
                {formatPounds(talks.counter.offer.fee)}, the {talks.counter.offer.slot} slot and {talks.counter.offer.merchPct}% of the merch
              </strong>{' '}
              (open until {talks.counter.expiresDay} days to go).
            </p>
          )}
        </section>
      )}

      {talks.status === 'open' && (
        <section className={ui.card} aria-label="Your offer">
          <h2 className={ui.cardTitle}>Your offer</h2>
          <div className={styles.row}>
            <div className={styles.rowHead}>
              <strong>Fee</strong>
              <span className={VERDICT[verdicts.fee].className}>{VERDICT[verdicts.fee].label}</span>
            </div>
            <p className={ui.muted}>
              🧓 Market rate {formatPounds(hint.low)} to {formatPounds(hint.high)}
            </p>
            <Stepper label="fee" value={fee} onChange={setFee} step={feeStep * 5} min={feeStep} max={Math.max(hint.high * 2, fee)} format={formatPounds} />
            <input
              className={styles.slider}
              type="range"
              aria-label="Fee"
              min={feeStep}
              max={Math.round((hint.high * 2) / feeStep) * feeStep}
              step={feeStep}
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.rowHead}>
              <strong>Bill position</strong>
              <span className={VERDICT[verdicts.slot].className}>{VERDICT[verdicts.slot].label}</span>
            </div>
            <p className={ui.muted}>🧓 They expect the {expected} slot</p>
            <div className={styles.slots} role="radiogroup" aria-label="Bill position">
              {f.slots.map((s) => {
                const on = whoIsOn(s);
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={slot === s}
                    className={`${ui.button} ${styles.slotButton} ${slot === s ? ui.chosen : ''}`}
                    disabled={!!on}
                    onClick={() => setSlot(s)}
                  >
                    <span>{s}</span>
                    <span className={ui.muted}>{on ?? (slot === s ? '✓ chosen' : 'free')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.rowHead}>
              <strong>Merch split</strong>
              <span className={VERDICT[verdicts.merch].className}>{VERDICT[verdicts.merch].label}</span>
            </div>
            <p className={ui.muted}>🧓 They usually ask {band.merchAsk}%; their cut comes out of what you sell</p>
            <Stepper
              label="merch split"
              value={merch}
              onChange={setMerch}
              step={1}
              min={t.negotiation.merchMin}
              max={t.negotiation.merchMax}
              format={(v) => `${v}%`}
            />
          </div>
          {blocked && <p className={ui.bad}>⚠️ {blocked}</p>}
        </section>
      )}

      {talks.status === 'signed' && (
        <Button variant="primary" wide onClick={() => go({ name: 'lineup' })}>
          Back to the lineup
        </Button>
      )}
      {talks.status === 'closed' && (
        <Button variant="primary" wide onClick={() => go({ name: 'lineup' })}>
          Find another act
        </Button>
      )}
      {talks.status === 'open' && (
        <div className={ui.buttonRow}>
          <Button variant="primary" disabled={!!blocked} onClick={() => dispatch({ type: 'submitOffer', bandId, offer })}>
            Submit offer
          </Button>
          <Button disabled={!talks.counter} onClick={() => dispatch({ type: 'acceptCounter', bandId })}>
            Accept counter
          </Button>
          <Button variant="danger" onClick={() => dispatch({ type: 'walkAway', bandId })}>
            Walk away
          </Button>
        </div>
      )}
    </Screen>
  );
}

/** Talks in progress, from the hub's Negotiations row. */
export function NegotiationList() {
  const { game, go } = useGame();
  const active = Object.entries(game.talks).filter(([, t]) => t.rounds.length > 0);
  return (
    <Screen title="Negotiations">
      {active.length === 0 && <p className={ui.muted}>No talks yet. Pick a band on the lineup and make them an offer.</p>}
      <ul className={styles.list}>
        {active.map(([bandId, talks]) => {
          const band = getBand(defaultContent, bandId);
          return (
            <li key={bandId}>
              <button type="button" className={ui.menuRow} onClick={() => go({ name: 'negotiation', bandId })}>
                <span className={ui.menuLabel}>
                  {band.name} {statusChip(game, band)}
                </span>
                <span className={ui.menuDetail}>{talks.status === 'open' ? `${talks.patience} rounds left` : ''}</span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button variant="primary" wide onClick={() => go({ name: 'lineup' })}>
        Open the lineup
      </Button>
    </Screen>
  );
}
