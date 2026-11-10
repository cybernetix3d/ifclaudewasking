import type { Decree, EditionContent, Indicator } from "./types";

export type DecreeChange =
  | { kind: "kept"; before: Decree; after: Decree; rankDelta: number; costDelta: number | null }
  | { kind: "reworded"; before: Decree; after: Decree; similarity: number; rankDelta: number; costDelta: number | null }
  | { kind: "added"; after: Decree }
  | { kind: "dropped"; before: Decree };

export interface IndicatorPair {
  id: number;
  before: Indicator | null;
  after: Indicator | null;
  changed: boolean;
}

export interface Comparison {
  decrees: DecreeChange[];
  budget: { before: number | null; after: number | null; delta: number | null };
  indicators: IndicatorPair[];
}

const STOP = new Set(["a", "an", "and", "the", "of", "to", "for", "in", "on", "by", "with", "all", "every"]);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w)),
  );
}

/** Jaccard similarity of the content words of two strings, 0..1. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Title similarity counts double; the order text breaks ties for short titles. */
function decreeSimilarity(a: Decree, b: Decree): number {
  return (2 * similarity(a.title, b.title) + similarity(a.order, b.order)) / 3;
}

export const REWORD_THRESHOLD = 0.3;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function costDelta(a: Decree, b: Decree): number | null {
  if (a.annual_cost_usd_billion === null || b.annual_cost_usd_billion === null) return null;
  return b.annual_cost_usd_billion - a.annual_cost_usd_billion;
}

/**
 * Match decrees between two editions. Identical titles are "kept"; otherwise the most similar
 * remaining pair above REWORD_THRESHOLD is "reworded" (greedy, best pair first). Leftovers are
 * "dropped" (only in A) or "added" (only in B).
 */
export function compareDecrees(a: Decree[], b: Decree[]): DecreeChange[] {
  const out: DecreeChange[] = [];
  const restA = new Set(a);
  const restB = new Set(b);

  for (const da of a) {
    const db = [...restB].find((x) => norm(x.title) === norm(da.title));
    if (db) {
      out.push({ kind: "kept", before: da, after: db, rankDelta: db.rank - da.rank, costDelta: costDelta(da, db) });
      restA.delete(da);
      restB.delete(db);
    }
  }

  const pairs: { da: Decree; db: Decree; s: number }[] = [];
  for (const da of restA) for (const db of restB) pairs.push({ da, db, s: decreeSimilarity(da, db) });
  pairs.sort((x, y) => y.s - x.s);
  for (const { da, db, s } of pairs) {
    if (s < REWORD_THRESHOLD) break;
    if (!restA.has(da) || !restB.has(db)) continue;
    out.push({ kind: "reworded", before: da, after: db, similarity: s, rankDelta: db.rank - da.rank, costDelta: costDelta(da, db) });
    restA.delete(da);
    restB.delete(db);
  }

  for (const da of restA) out.push({ kind: "dropped", before: da });
  for (const db of restB) out.push({ kind: "added", after: db });

  const rankOf = (c: DecreeChange) => ("after" in c ? c.after.rank : 100 + c.before.rank);
  return out.sort((x, y) => rankOf(x) - rankOf(y));
}

export function compareIndicators(a: Indicator[], b: Indicator[]): IndicatorPair[] {
  const ids = [...new Set([...a, ...b].map((i) => i.id))].sort((x, y) => x - y);
  return ids.map((id) => {
    const before = a.find((i) => i.id === id) ?? null;
    const after = b.find((i) => i.id === id) ?? null;
    const changed =
      !before || !after || before.value !== after.value || before.data_year !== after.data_year || before.verified !== after.verified;
    return { id, before, after, changed };
  });
}

export function compareEditions(a: EditionContent, b: EditionContent): Comparison {
  const before = a.budget.total_annual_cost_usd_billion;
  const after = b.budget.total_annual_cost_usd_billion;
  return {
    decrees: compareDecrees(a.decrees, b.decrees),
    budget: { before, after, delta: before === null || after === null ? null : after - before },
    indicators: compareIndicators(a.indicators, b.indicators),
  };
}
