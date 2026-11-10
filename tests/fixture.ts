// Synthetic test data only. Never copy into editions/.
import type { Decree, Edition, EditionContent } from "../src/lib/types";

export function decree(rank: number, title: string, order = `Order text for ${title}`, cost: number | null = 10): Decree {
  return {
    rank,
    title,
    order,
    delivered_by: "Test agency",
    annual_cost_usd_billion: cost,
    cost_basis: "test",
    expected_result_day_365: "test",
    how_to_check: "test",
    basis: "evidence",
    strongest_objection: "test",
    source_ids: [1],
  };
}

export function content(overrides: Partial<EditionContent> = {}): EditionContent {
  return {
    premise: "p",
    summary: "s",
    indicators: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Indicator ${i + 1}`,
      value: `${i * 10}`,
      data_year: "2025",
      source_ids: [1],
      verified: true,
      note: "",
    })),
    decrees: [decree(1, "Fund child vaccination everywhere"), decree(2, "Cut fossil fuel subsidies")],
    timeline: { first_30_days: ["a"], q1: ["b"], q2: ["c"], q3: ["d"], q4: ["e"] },
    budget: { total_annual_cost_usd_billion: 20, funded_from: "test", arithmetic: "10 + 10" },
    will_not_touch: [{ area: "a", reason: "r" }],
    risks: ["r"],
    day_366: ["d"],
    confidence: [{ claim: "c", basis: "b" }],
    sources: [{ id: 1, title: "t", publisher: "p", url: "https://example.org", published: "2025" }],
    ...overrides,
  };
}

export function edition(c: EditionContent = content()): Edition {
  return {
    edition_date: "2027-01-01",
    meta: {
      run_date: "2027-01-01",
      model_requested: "claude-fable-5-2",
      model_returned: ["claude-fable-5-2"],
      effort: "high",
      prompt_sha256: "a".repeat(64),
      usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      searches: 3,
      fetches: 1,
      attempts: 1,
      runner: "test",
    },
    content: c,
  };
}
