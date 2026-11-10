const SCALE: Record<string, number> = {
  thousand: 1e3, k: 1e3,
  million: 1e6, mn: 1e6, m: 1e6,
  billion: 1e9, bn: 1e9, b: 1e9,
  trillion: 1e12, tn: 1e12, t: 1e12,
};

/**
 * Reads the first figure from an indicator value such as "831 million", "US$2.7 trillion",
 * "12,121 warheads" or "2.7°C", scaled to base units so different phrasings compare.
 * Returns null when there is no number. Only used for charts; the text is always shown as given.
 */
export function parseFigure(value: string): number | null {
  const m = value.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/(-?\d+(?:\.\d+)?)\s*(thousand|million|billion|trillion|mn|bn|tn|k|m|b|t)?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]?.toLowerCase();
  return unit ? n * SCALE[unit] : n;
}

export function compact(n: number): string {
  const abs = Math.abs(n);
  const fmt = (x: number, s: string) => `${x.toLocaleString("en-US", { maximumFractionDigits: 2 })}${s}`;
  if (abs >= 1e12) return fmt(n / 1e12, "T");
  if (abs >= 1e9) return fmt(n / 1e9, "B");
  if (abs >= 1e6) return fmt(n / 1e6, "M");
  if (abs >= 1e4) return fmt(n / 1e3, "K");
  return fmt(n, "");
}
