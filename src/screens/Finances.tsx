import { useGame } from '../app/store';
import { CompactForecast } from '../components/ForecastPanel';
import { Screen } from '../components/Screen';
import ui from '../components/ui.module.css';
import { budgetOf, cashOf, festivalOf, forecastOf, spendSoFar } from '../core/game';
import { formatPercent, formatPounds } from '../core/format';

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr>
      <th scope="row" style={{ textAlign: 'left', fontWeight: strong ? 700 : 400, padding: '4px 0' }}>
        {label}
      </th>
      <td style={{ textAlign: 'right', fontWeight: strong ? 700 : 400 }} className={value < 0 ? ui.bad : undefined}>
        {formatPounds(value)}
      </td>
    </tr>
  );
}

export function Finances() {
  const { game } = useGame();
  const f = festivalOf(game);
  const spent = spendSoFar(game);
  const fc = forecastOf(game);
  const onTarget = fc.profitPct >= f.targets.profit;

  return (
    <Screen title="Finances">
      <section className={ui.card} aria-label="Budget">
        <h2 className={ui.cardTitle}>Budget and spend so far</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Line label="Budget" value={budgetOf(game)} strong />
            <Line label="Field, staff and stage (fixed)" value={-spent.overhead} />
            <Line label="Bands" value={-spent.lineup} />
            <Line label="Facilities" value={-spent.facilities} />
            <Line label="Decisions" value={-spent.decisions} />
            <Line label="Cash left" value={cashOf(game)} strong />
          </tbody>
        </table>
      </section>
      <section className={ui.card} aria-label="Forecast profit">
        <h2 className={ui.cardTitle}>Forecast before events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Line label="Tickets" value={fc.ticketIncome} />
            <Line label="Food, drink and merch" value={fc.foodDrinkMerchIncome} />
            <Line label="Bands' merch cut" value={-fc.merchPayout} />
            <Line label="Spend (above)" value={-(fc.spend - fc.merchPayout)} />
            <Line label="Profit" value={fc.profit} strong />
          </tbody>
        </table>
        <p className={onTarget ? ui.ok : ui.bad} style={{ marginBottom: 0 }}>
          {onTarget ? '✓' : '✗'} Profit {formatPercent(fc.profitPct)} of spend; the target is {formatPercent(f.targets.profit)}.
        </p>
      </section>
      <CompactForecast />
    </Screen>
  );
}
