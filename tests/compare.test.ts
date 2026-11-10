import { describe, expect, it } from "vitest";
import { compareDecrees, compareEditions, similarity } from "../src/lib/compare";
import { content, decree } from "./fixture";

describe("similarity", () => {
  it("is 1 for identical text and 0 for disjoint text", () => {
    expect(similarity("Cut fossil subsidies", "cut fossil subsidies")).toBe(1);
    expect(similarity("Cut fossil subsidies", "Vaccinate children")).toBe(0);
  });

  it("ignores punctuation and stop words", () => {
    expect(similarity("End the war, now!", "end war now")).toBe(1);
  });
});

describe("compareDecrees", () => {
  it("marks identical titles as kept, with rank and cost changes", () => {
    const [c] = compareDecrees([decree(1, "Cut fossil subsidies", "x", 10)], [decree(3, "Cut Fossil Subsidies", "y", 25)]);
    expect(c.kind).toBe("kept");
    if (c.kind === "kept") {
      expect(c.rankDelta).toBe(2);
      expect(c.costDelta).toBe(15);
    }
  });

  it("detects rewording", () => {
    const out = compareDecrees(
      [decree(1, "Phase out fossil fuel subsidies worldwide")],
      [decree(1, "Phase out all fossil fuel subsidies by day 365")],
    );
    expect(out.map((c) => c.kind)).toEqual(["reworded"]);
  });

  it("reports added and dropped decrees", () => {
    const out = compareDecrees([decree(1, "Vaccinate every child")], [decree(1, "Tax carbon at the border")]);
    expect(out.map((c) => c.kind).sort()).toEqual(["added", "dropped"]);
  });

  it("matches each decree at most once", () => {
    const a = [decree(1, "Expand school meals"), decree(2, "Expand school meals in Africa")];
    const b = [decree(1, "Expand school meals programmes")];
    const out = compareDecrees(a, b);
    expect(out.filter((c) => c.kind !== "dropped")).toHaveLength(1);
    expect(out.filter((c) => c.kind === "dropped")).toHaveLength(1);
  });

  it("gives a null cost delta when either cost is unknown", () => {
    const [c] = compareDecrees([decree(1, "A plan", "x", null)], [decree(1, "A plan", "x", 5)]);
    expect(c.kind === "kept" && c.costDelta).toBeNull();
  });
});

describe("compareEditions", () => {
  it("compares budgets and indicators", () => {
    const a = content();
    const b = content({ budget: { total_annual_cost_usd_billion: 35, funded_from: "", arithmetic: "" } });
    b.indicators[4] = { ...b.indicators[4], value: "999", verified: false };
    const r = compareEditions(a, b);
    expect(r.budget).toEqual({ before: 20, after: 35, delta: 15 });
    expect(r.indicators).toHaveLength(10);
    expect(r.indicators.filter((i) => i.changed).map((i) => i.id)).toEqual([5]);
  });

  it("gives a null budget delta when a total is unknown", () => {
    const b = content({ budget: { total_annual_cost_usd_billion: null, funded_from: "", arithmetic: "" } });
    expect(compareEditions(content(), b).budget.delta).toBeNull();
  });
});
