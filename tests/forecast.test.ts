import { describe, expect, it } from "vitest";
import { calibration, forecastModelSchema, resolutionYear, scoreForecast, validateForecast, validateForecastContent, type Forecast, type ForecastContent } from "../src/lib/forecast";

// Synthetic test data only. Never copy into forecasts/.
function body(targetYear = "2028", latestYear = "2026"): ForecastContent {
  return {
    target_year: targetYear,
    headline: "h",
    caveat: "c",
    indicators: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      unit: "u",
      latest: { value: 100, data_year: latestYear },
      baseline: { value: 100, low: 90, high: 110 },
      with_plan: { value: 80, low: 70, high: 95 },
      resolves: "r",
      reasoning: "x",
    })),
  };
}

function file(date: string, c: ForecastContent = body(String(Number(date.slice(0, 4)) + 1))): Forecast {
  return {
    edition_date: date,
    meta: { run_date: date, model_requested: "m", model_returned: ["m"], effort: "high", prompt_sha256: "a".repeat(64), edition_sha256: "b".repeat(64), searches: 1, fetches: 0, attempts: 1 },
    content: c,
  };
}

describe("validateForecastContent", () => {
  it("accepts a well-formed forecast", () => {
    expect(validateForecastContent(body("2028"), "2027-01-01")).toEqual({ ok: true, errors: [] });
  });

  it("requires the target year to be the year after the edition", () => {
    expect(validateForecastContent(body("2029"), "2027-01-01").ok).toBe(false);
  });

  it("requires low <= value <= high", () => {
    const c = body();
    c.indicators[2].baseline = { value: 120, low: 90, high: 110 };
    const r = validateForecastContent(c);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/low <= value <= high/);
  });

  it("catches a unit slip", () => {
    const c = body();
    c.indicators[0].baseline = { value: 100_000_000, low: 90_000_000, high: 110_000_000 };
    expect(validateForecastContent(c).errors.join()).toMatch(/check the unit/);
  });

  it("requires ten indicators in order", () => {
    const c = body();
    c.indicators.reverse();
    expect(validateForecastContent(c).ok).toBe(false);
  });

  it("rejects text in numeric fields", () => {
    const c: any = body();
    c.indicators[0].latest.value = "811 million";
    expect(validateForecastContent(c).ok).toBe(false);
  });
});

describe("validateForecast", () => {
  it("accepts a full file and rejects a bad hash", () => {
    expect(validateForecast(file("2027-01-01")).ok).toBe(true);
    const f = file("2027-01-01");
    f.meta.edition_sha256 = "nope";
    expect(validateForecast(f).ok).toBe(false);
  });
});

describe("forecastModelSchema", () => {
  it("has no $ref and no unsupported constraints", () => {
    const text = JSON.stringify(forecastModelSchema());
    for (const k of ["$ref", "maxItems", "pattern", "minimum"]) expect(text).not.toContain(`"${k}"`);
    expect(text).toContain('"with_plan"');
  });
});

describe("scoring", () => {
  it("counts warheads the January after the target year", () => {
    expect(resolutionYear(10, "2027")).toBe("2028");
    expect(resolutionYear(2, "2027")).toBe("2027");
  });

  it("leaves a forecast unsettled until a later edition reports the target year", () => {
    const f = file("2027-01-01");
    const later = file("2027-04-01", body("2028", "2026"));
    expect(scoreForecast(f, [f, later]).every((s) => s.actual === null && s.inside === null)).toBe(true);
  });

  it("settles against the most recent later figure for the target year", () => {
    const f = file("2027-01-01");
    const first = file("2029-01-01", body("2030", "2028 (preliminary)"));
    first.content.indicators[0].latest.value = 105;
    const revised = file("2029-04-01", body("2030", "2028"));
    revised.content.indicators[0].latest.value = 115;
    const s = scoreForecast(f, [f, first, revised])[0];
    expect(s.actual).toEqual({ value: 115, data_year: "2028", from_edition: "2029-04-01" });
    expect(s.inside).toBe(false);
    expect(s.error).toBe(15);
  });

  it("never uses an earlier edition to settle a forecast", () => {
    const earlier = file("2026-01-01", body("2027", "2028"));
    const f = file("2027-01-01");
    expect(scoreForecast(f, [earlier, f])[0].actual).toBeNull();
  });

  it("reports what the plan would change and whether that is good", () => {
    const f = file("2027-01-01");
    const s = scoreForecast(f, [f]);
    expect(s[0].planGap).toBe(-20);
    expect(s[0].planHelps).toBe(true); // fewer people in poverty
    expect(s[5].planHelps).toBe(false); // less aid is worse
  });

  it("computes calibration over settled forecasts only", () => {
    const f = file("2027-01-01");
    const later = file("2029-01-01", body("2030", "2028"));
    later.content.indicators[0].latest.value = 200; // outside
    const c = calibration([f, later]);
    expect(c.settled).toBe(9); // indicator 10 needs a 2029 figure
    expect(c.inside).toBe(8);
  });
});
