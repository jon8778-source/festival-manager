import type { GameEvent } from '../core/content';
import type { OptionKey } from '../core/events';
import { formatPounds } from '../core/format';
import styles from './ui.module.css';

interface Props {
  event: GameEvent;
  /** Full-scale ticket revenue, to turn cost shares into pounds. */
  r: number;
  chosen: OptionKey | null;
  onChoose: (key: OptionKey) => void;
}

function effects(option: GameEvent['options'][number], r: number): string {
  const parts: string[] = [];
  const cost = option.costShareR * r;
  parts.push(cost > 0 ? `Costs ${formatPounds(cost)}` : 'Free');
  if (option.customers) parts.push(`crowd ${option.customers > 0 ? '+' : ''}${option.customers}`);
  if (option.bands) parts.push(`bands ${option.bands > 0 ? '+' : ''}${option.bands}`);
  if (option.reputation) parts.push(`reputation ${option.reputation > 0 ? '+' : ''}${option.reputation}`);
  return `${parts.join(', ')}. ${option.effect}`;
}

/** Three stacked options with their cost and effects; shared with the festival day. */
export function DecisionCard({ event, r, chosen, onChoose }: Props) {
  return (
    <div className={styles.options} role="group" aria-label={event.title}>
      {event.options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`${styles.option} ${chosen === o.key ? styles.chosen : ''}`}
          disabled={chosen !== null}
          onClick={() => onChoose(o.key)}
        >
          <span>
            {o.key}. {o.label}
            {chosen === o.key ? ' ✓ chosen' : ''}
          </span>
          <span className={styles.optionEffect}>{effects(o, r)}</span>
        </button>
      ))}
    </div>
  );
}
