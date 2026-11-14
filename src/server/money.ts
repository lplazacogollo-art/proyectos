export function toCents(amount: number | string): number {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(num)) {
    throw new Error('Valor monetario inválido');
  }
  return Math.round(num * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function calcPercentageCents(baseCents: number, pct: number): number {
  const pctScaled = Math.round(pct * 100);
  return Math.round((baseCents * pctScaled) / 10000);
}

export function formatCOP(value: number | string): string {
  const num = Math.round(Number(value) || 0);
  const abs = Math.abs(num);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}
