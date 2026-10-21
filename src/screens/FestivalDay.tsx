import { useStore, useGame } from '../app/store';
import { useFestivalClock } from '../app/useFestivalClock';
import { Button } from '../components/Button';
import { DecisionCard } from '../components/DecisionCard';
import { RandyBubble } from '../components/RandyBubble';
import ui from '../components/ui.module.css';
import { defaultContent, festivalTimeline, getBand, getEvent } from '../core/content';
import { clockLabel, dayLength, minutesAfterGates } from '../core/festivalDay';
import { festivalOf, liveOutcome, liveStars, revenueAtScale, type GameState } from '../core/game';
import { formatNumber, formatPercent, formatPounds } from '../core/format';
import type { Slot } from '../core/negotiation';
import { defaultTuning } from '../core/tuning';
import styles from './FestivalDay.module.css';

/** A meter drawn relative to its target: the target marker sits two-thirds of the way along. */
function StarMeter({ icon, label, value, target, met }: { icon: string; label: string; value: number; target: number; met: boolean }) {
  const fill = Math.max(0, Math.min(1, value / (target * 1.5)));
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>
          {icon} {label}
        </span>
        <span className={met ? ui.ok : ui.bad}>
          {met ? '★' : '☆'} {formatPercent(value)}
        </span>
      </div>
      <div className={ui.meterTrack} aria-hidden="true">
        <div className={`${ui.meterFill} ${met ? ui.meterFillOk : ''}`} style={{ width: `${fill * 100}%` }} />
        <div className={ui.meterTarget} style={{ left: `${(2 / 3) * 100}%` }} />
      </div>
      <span className={ui.muted}>target {formatPercent(target)}</span>
    </div>
  );
}

/** Which act is on stage: the opener, then the support, then the headliner, as the timeline says. */
function actOnStage(game: GameState): { slot: Slot; name: string } | null {
  const day = game.day;
  if (!day) return null;
  const supportOn = minutesAfterGates(festivalTimeline(defaultContent, festivalOf(game)).day.supportOn);
  const slot: Slot = day.headlinerStarted ? 'headliner' : day.minutes >= supportOn ? 'support' : 'opener';
  const booking = game.lineup[slot];
  return booking ? { slot, name: getBand(defaultContent, booking.bandId).name } : null;
}

/** Sky colour through the day: blue afternoon, orange evening, dark night. */
function skyColour(minutes: number): string {
  const share = minutes / dayLength();
  if (share < 0.55) return '#7ec8e3';
  if (share < 0.7) return '#f4a259';
  if (share < 0.8) return '#6d597a';
  return '#14213d';
}

function Scene({ game, paused }: { game: GameState; paused: boolean }) {
  const outcome = liveOutcome(game);
  const act = actOnStage(game);
  const dots = Math.min(48, Math.round(outcome.attendees / 10));
  const queueing = game.day?.active?.eventId === 'food-queue';
  return (
    <div
      className={`${styles.scene} ${paused ? styles.paused : ''}`}
      style={{ background: `linear-gradient(${skyColour(game.day?.minutes ?? 0)} 0 35%, var(--colour-grass) 35%)` }}
      role="img"
      aria-label={`${act ? `${act.name} on stage` : 'An empty stage'}, ${formatNumber(outcome.attendees)} people in the field`}
    >
      <div className={styles.stage}>
        <span className={styles.lights} aria-hidden="true">
          💡💡💡
        </span>
        <span className={styles.act}>{act ? `🎸 ${act.name}` : 'Stage empty'}</span>
      </div>
      <div className={styles.crowd} aria-hidden="true">
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={styles.person} style={{ animationDelay: `${(i % 7) * 0.12}s` }} />
        ))}
      </div>
      <div className={styles.stalls} aria-hidden="true">
        <span>🍔{queueing ? ' 🧍🧍🧍🧍🧍' : ''}</span>
        <span>🚻</span>
      </div>
    </div>
  );
}

function alertChips(game: GameState): { text: string; tone: 'ok' | 'bad' | 'close' }[] {
  const day = game.day;
  if (!day) return [];
  const chips: { text: string; tone: 'ok' | 'bad' | 'close' }[] = [];
  if (day.active) chips.push({ text: `⚠️ ${getEvent(defaultContent, day.active.eventId).title}`, tone: 'bad' });
  for (const id of day.prevented) chips.push({ text: `✓ ${getEvent(defaultContent, id).title}: avoided`, tone: 'ok' });
  for (const ch of day.choices) if (ch.effect.fined) chips.push({ text: `💷 Fined ${formatPounds(ch.effect.fine)}`, tone: 'bad' });
  if (liveOutcome(game).queueRatio < 1) chips.push({ text: '🚻 Queues on site', tone: 'close' });
  if (day.headlinerStarted && !day.finished) chips.push({ text: '🎤 Headliner on', tone: 'ok' });
  return chips;
}

export function FestivalDay() {
  const { game, dispatch } = useGame();
  const { go } = useStore();
  const day = game.day;
  const running = !!day?.started && !day.finished && !day.active;
  // Ticks keep flowing while a card is open: the core holds the clock and counts the response time.
  useFestivalClock(!!day?.started && !day.finished, dispatch);
  if (!day) return null;

  const f = festivalOf(game);
  const outcome = liveOutcome(game);
  const stars = liveStars(game);
  const paused = !running;
  const fast = defaultTuning.festivalDay.fastSpeed;
  const active = day.active ? getEvent(defaultContent, day.active.eventId) : null;

  return (
    <main className={ui.screen}>
      <header className={ui.topBar}>
        <span className={styles.clock} aria-label={`Time ${clockLabel(day.minutes)}`}>
          🕒 {clockLabel(day.minutes)}
        </span>
        {paused && day.started && <span className={`${ui.chip} ${ui.close}`}>⏸ Paused</span>}
        <span style={{ flex: 1 }} />
        <Button
          aria-label={`Speed ${day.speed}x, tap to change`}
          onClick={() => dispatch({ type: 'setSpeed', speed: day.speed === 1 ? fast : 1 })}
        >
          {day.speed === 1 ? '▶ 1x' : `⏩ ${fast}x`}
        </Button>
        <Button variant="ghost" aria-label="Main menu" onClick={() => go({ name: 'menu' })}>
          ☰
        </Button>
      </header>
      <div className={ui.content}>
        <section className={styles.meters} aria-label="Star meters">
          <StarMeter icon="💷" label="Profit" value={outcome.profitPct} target={f.targets.profit} met={stars.profit} />
          <StarMeter icon="😀" label="Crowd" value={outcome.customerSatisfaction} target={f.targets.customers} met={stars.customers} />
          <StarMeter icon="🎸" label="Bands" value={outcome.bandSatisfaction} target={f.targets.bands} met={stars.bands} />
        </section>
        <ul className={styles.chips} aria-label="Alerts">
          {alertChips(game).map((chip) => (
            <li key={chip.text} className={`${ui.chip} ${ui[chip.tone]}`}>
              {chip.text}
            </li>
          ))}
        </ul>
        <Scene game={game} paused={paused} />
        {!active && <RandyBubble />}
        {!day.started && (
          <section className={ui.card}>
            <h1 className={ui.cardTitle}>🎪 {f.name}: festival day</h1>
            <p style={{ marginTop: 0 }}>
              Gates open at noon. {formatNumber(outcome.attendees)} people are expected. Time runs until something needs you, then
              stops until you choose.
            </p>
            <Button variant="primary" wide onClick={() => dispatch({ type: 'openGates' })}>
              Open the gates
            </Button>
          </section>
        )}
      </div>
      {active && day.active && (
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="event-title">
          <div className={styles.sheetInner}>
            <p className={ui.muted} style={{ margin: 0 }}>
              {clockLabel(day.active.at)}
              {active.from ? ` · ${active.from}` : ''}
            </p>
            <h2 id="event-title" className={ui.cardTitle} style={{ marginTop: 4 }}>
              {active.title}
            </h2>
            {active.body && <p style={{ margin: '0 0 8px' }}>{active.body}</p>}
            <RandyBubble />
            <DecisionCard event={active} r={revenueAtScale(game)} chosen={null} onChoose={(option) => dispatch({ type: 'chooseOption', option })} />
          </div>
        </div>
      )}
    </main>
  );
}
