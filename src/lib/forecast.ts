import Ajv from "ajv";
import schema from "../../schema/forecast.schema.json" with { type: "json" };
import { stripForModel, type ValidationResult } from "./schema";

export interface Range {
  value: number;
  low: number;
  high: number;
}

export interface ForecastIndicator {
  id: number;
  unit: string;
  latest: { value: number; data_year: string };
  baseline: Range;
  with_plan: Range;
  resolves: string;
  reasoning: string;
}

export interface ForecastContent {
  target_year: string;
  headline: string;
  caveat: string;
  indicators: ForecastIndicator[];
}

export interface Forecast {
  edition_date: string;
  meta: {
    run_date: string;
    model_requested: string;
    model_returned: string[];
    effort: string;
    prompt_sha256: string;
    edition_sha256: string;
    searches: number;
    fetches: number;
    attempts: number;
    cli_version?: string;
  };
  content: ForecastContent;
}

/** Fixed display facts for the ten indicators. `better` says which direction is good news. */
export const INDICATORS: { id: number; short: string; unit: string; better: "lower" | "higher"; decimals: number }[] = [
  { id: 1, short: "People in extreme poverty", unit: "million people", better: "lower", decimals: 0 },
  { id: 2, short: "Deaths of children under five", unit: "million deaths a year", better: "lower", decimals: 2 },
  { id: 3, short: "People undernourished", unit: "million people", better: "lower", decimals: 0 },
  { id: 4, short: "People forcibly displaced", unit: "million people", better: "lower", decimals: 1 },
  { id: 5, short: "Armed conflicts involving a state", unit: "conflicts", better: "lower", decimals: 0 },
  { id: 6, short: "Official development assistance", unit: "US$ billion", better: "higher", decimals: 1 },
  { id: 7, short: "World military expenditure", unit: "US$ billion", better: "lower", decimals: 0 },
  { id: 8, short: "Clean versus fossil energy investment", unit: "clean ÷ fossil", better: "higher", decimals: 2 },
  { id: 9, short: "Projected warming under current policies", unit: "°C this century", better: "lower", decimals: 1 },
  { id: 10, short: "Nuclear warheads", unit: "warheads", better: "lower", decimals: 0 },
];

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFile = ajv.compile(schema);
const validateBody = ajv.compile({ ...schema.definitions.content, definitions: schema.definitions });

function semanticErrors(c: ForecastContent, editionDate?: string): string[] {
  const errors: string[] = [];
  if (editionDate && Number(c.target_year) !== Number(editionDate.slice(0, 4)) + 1) {
    errors.push(`/target_year: expected ${Number(editionDate.slice(0, 4)) + 1}, got ${c.target_year}`);
  }
  c.indicators.forEach((ind, i) => {
    if (ind.id !== i + 1) errors.push(`/indicators/${i}: expected id ${i + 1}, got ${ind.id}`);
    for (const key of ["baseline", "with_plan"] as const) {
      const r = ind[key];
      if (!(r.low <= r.value && r.value <= r.high)) errors.push(`/indicators/${i}/${key}: need low <= value <= high, got ${r.low}, ${r.value}, ${r.high}`);
    }
    // Catch unit slips such as 811000000 instead of 811: a forecast 20x away from the latest figure is not a forecast.
    const ref = Math.abs(ind.latest.value);
    if (ref > 0) {
      for (const v of [ind.baseline.value, ind.with_plan.value]) {
        if (Math.abs(v) > ref * 20 || (v !== 0 && Math.abs(v) < ref / 20)) errors.push(`/indicators/${i}: forecast ${v} is implausibly far from latest ${ind.latest.value}; check the unit`);
      }
    }
  });
  return errors;
}

const fmt = (errs: typeof validateFile.errors) => (errs ?? []).map((e) => `${e.instancePath || "/"}: ${e.message}`);

export function validateForecastContent(content: unknown, editionDate?: string): ValidationResult {
  if (!validateBody(content)) return { ok: false, errors: fmt(validateBody.errors) };
  const errors = semanticErrors(content as unknown as ForecastContent, editionDate);
  return { ok: errors.length === 0, errors };
}

export function validateForecast(file: unknown): ValidationResult {
  if (!validateFile(file)) return { ok: false, errors: fmt(validateFile.errors) };
  const f = file as unknown as Forecast;
  const errors = semanticErrors(f.content, f.edition_date);
  return { ok: errors.length === 0, errors };
}

/** The forecast content schema with $refs inlined and unsupported constraints removed. */
export function forecastModelSchema(): Record<string, unknown> {
  const inline = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(inline);
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (o.$ref === "#/definitions/range") return inline(schema.definitions.range);
      return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, inline(v)]));
    }
    return node;
  };
  return stripForModel(inline(schema.definitions.content)) as Record<string, unknown>;
}

/** The data year that settles a forecast: warheads are counted the January after the target year. */
export function resolutionYear(id: number, targetYear: string): string {
  return id === 10 ? String(Number(targetYear) + 1) : targetYear;
}

function lastYearIn(text: string): string | null {
  const m = text.match(/\b(19|20)\d{2}\b/g);
  return m ? m[m.length - 1] : null;
}

export interface Scored {
  id: number;
  forecast: ForecastIndicator;
  /** The real figure, once a later edition reports one for the resolution year. */
  actual: { value: number; data_year: string; from_edition: string } | null;
  inside: boolean | null;
  /** actual minus the baseline forecast. */
  error: number | null;
  /** with_plan minus baseline: what the model says its plan would change. */
  planGap: number;
  /** True when the plan would move the figure in the good direction. */
  planHelps: boolean | null;
}

/**
 * Score one forecast against everything published after it. A baseline forecast is settled by
 * the "latest" figure of the most recent later forecast whose data year is the resolution year.
 * The with_plan forecast is never scored: the plan does not happen.
 */
export function scoreForecast(f: Forecast, all: Forecast[]): Scored[] {
  const later = all.filter((g) => g.edition_date > f.edition_date).sort((a, b) => b.edition_date.localeCompare(a.edition_date));
  return f.content.indicators.map((ind) => {
    const want = resolutionYear(ind.id, f.content.target_year);
    let actual: Scored["actual"] = null;
    for (const g of later) {
      const cand = g.content.indicators.find((x) => x.id === ind.id);
      if (cand && lastYearIn(cand.latest.data_year) === want) {
        actual = { value: cand.latest.value, data_year: cand.latest.data_year, from_edition: g.edition_date };
        break;
      }
    }
    const planGap = ind.with_plan.value - ind.baseline.value;
    const better = INDICATORS[ind.id - 1].better;
    return {
      id: ind.id,
      forecast: ind,
      actual,
      inside: actual ? ind.baseline.low <= actual.value && actual.value <= ind.baseline.high : null,
      error: actual ? actual.value - ind.baseline.value : null,
      planGap,
      planHelps: planGap === 0 ? null : better === "lower" ? planGap < 0 : planGap > 0,
    };
  });
}

/** Share of settled 80% ranges that contained the real figure, across every forecast so far. */
export function calibration(all: Forecast[]): { settled: number; inside: number } {
  let settled = 0;
  let inside = 0;
  for (const f of all) {
    for (const s of scoreForecast(f, all)) {
      if (s.inside === null) continue;
      settled++;
      if (s.inside) inside++;
    }
  }
  return { settled, inside };
}

export function formatFigure(id: number, n: number): string {
  const d = INDICATORS[id - 1].decimals;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
