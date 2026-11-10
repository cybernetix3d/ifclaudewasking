import { describe, expect, it } from "vitest";
import { modelSchema, validateContent, validateEdition } from "../src/lib/schema";
import { content, decree, edition } from "./fixture";

describe("validateContent", () => {
  it("accepts a well-formed answer", () => {
    expect(validateContent(content())).toEqual({ ok: true, errors: [] });
  });

  it("rejects missing fields", () => {
    const c: any = content();
    delete c.premise;
    const r = validateContent(c);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/premise/);
  });

  it("rejects extra fields", () => {
    expect(validateContent({ ...content(), extra: 1 }).ok).toBe(false);
  });

  it("requires exactly ten indicators", () => {
    const c = content();
    c.indicators = c.indicators.slice(0, 9);
    expect(validateContent(c).ok).toBe(false);
  });

  it("requires indicators in order 1..10", () => {
    const c = content();
    [c.indicators[0], c.indicators[1]] = [c.indicators[1], c.indicators[0]];
    const r = validateContent(c);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/expected id 1/);
  });

  it("allows at most twelve decrees", () => {
    const c = content({ decrees: Array.from({ length: 13 }, (_, i) => decree(i + 1, `D${i}`)) });
    expect(validateContent(c).ok).toBe(false);
  });

  it("rejects an unknown basis label", () => {
    const c: any = content();
    c.decrees[0].basis = "vibes";
    expect(validateContent(c).ok).toBe(false);
  });

  it("accepts null costs but not strings", () => {
    const c: any = content();
    c.decrees[0].annual_cost_usd_billion = null;
    c.budget.total_annual_cost_usd_billion = null;
    expect(validateContent(c).ok).toBe(true);
    c.decrees[0].annual_cost_usd_billion = "about 10";
    expect(validateContent(c).ok).toBe(false);
  });

  it("rejects references to sources that do not exist", () => {
    const c = content();
    c.decrees[0].source_ids = [99];
    const r = validateContent(c);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/source_id 99/);
  });

  it("rejects duplicate decree ranks and source ids", () => {
    const c = content();
    c.decrees[1].rank = 1;
    c.sources.push({ ...c.sources[0] });
    const r = validateContent(c);
    expect(r.errors.join()).toMatch(/duplicate rank/);
    expect(r.errors.join()).toMatch(/duplicate id/);
  });
});

describe("validateEdition", () => {
  it("accepts a full edition", () => {
    expect(validateEdition(edition()).ok).toBe(true);
  });

  it("rejects a bad prompt hash", () => {
    const e = edition();
    e.meta.prompt_sha256 = "nothex";
    expect(validateEdition(e).ok).toBe(false);
  });
});

describe("modelSchema", () => {
  it("drops constraints structured output does not support", () => {
    const text = JSON.stringify(modelSchema());
    for (const k of ["maxItems", "minimum", "maximum", "pattern"]) expect(text).not.toContain(`"${k}"`);
    expect(text).not.toMatch(/"minItems":(?![01][,}])/);
    expect(text).toContain('"additionalProperties":false');
  });
});
