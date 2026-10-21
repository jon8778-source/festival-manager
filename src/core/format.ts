// Text helpers for player-facing numbers and templates. Money is whole pounds.

/** 20000 → "20,000". Rounds to the whole number. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 20000 → "£20,000"; -150 → "-£150". */
export function formatPounds(value: number): string {
  const text = formatNumber(value);
  return text.startsWith('-') ? `-£${text.slice(1)}` : `£${text}`;
}

/** 0.734 → "73%". */
export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export type TemplateVars = Record<string, string>;

/** Fill {placeholders}; unknown ones are left as they are so missing data shows up in testing. */
export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
