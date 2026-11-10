// Plain-text (Markdown) renderings of an edition and its forecast, for readers and AI systems
// that do better with text than with a styled page. The model's words are copied, never changed.
import { answeringModel, editionNumber, formatBillions, formatDate, getForecast } from "./editions";
import { formatFigure, INDICATORS } from "./forecast";
import type { Edition } from "./types";

const ORIGIN = "https://ifclaudewasking.com";

export function editionMarkdown(e: Edition): string {
  const c = e.content;
  const f = getForecast(e.edition_date);
  const cite = (ids: number[]) => (ids.length ? ` [${ids.join(", ")}]` : "");
  const out: string[] = [];
  out.push(`# If Claude Was King: edition ${editionNumber(e)}, ${formatDate(e.edition_date)}`, "");
  out.push(
    `> The AI model ${answeringModel(e)} was asked what it would do as king of the world for exactly one year, starting ${formatDate(e.edition_date)}. This is its answer, published unedited. It made ${e.meta.searches} web searches and read ${e.meta.fetches} pages. An independent experiment, not affiliated with or endorsed by Anthropic. A thought experiment, not advice.`,
    "",
    `Web page: ${ORIGIN}/editions/${e.edition_date}`,
    "",
  );
  out.push("## Summary", "", c.summary, "");
  out.push("## Its view of the premise", "", c.premise, "");
  out.push("## The ten indicators it reported", "");
  for (const i of c.indicators) {
    out.push(`${i.id}. **${i.name}**: ${i.value} (data year: ${i.data_year})${i.verified ? "" : " UNVERIFIED BY THE MODEL"}${cite(i.source_ids)}${i.note ? `. ${i.note}` : ""}`);
  }
  out.push("", "## Decrees, most important first", "");
  for (const d of [...c.decrees].sort((a, b) => a.rank - b.rank)) {
    out.push(
      `### ${d.rank}. ${d.title}`,
      "",
      d.order,
      "",
      `- Basis: ${d.basis}`,
      `- Carried out by: ${d.delivered_by}`,
      `- Cost per year: ${d.annual_cost_usd_billion === null ? "no verified cost" : formatBillions(d.annual_cost_usd_billion)}${d.cost_basis ? `. ${d.cost_basis}` : ""}`,
      `- Expected by day 365: ${d.expected_result_day_365}`,
      `- How to check: ${d.how_to_check}`,
      `- Strongest objection: ${d.strongest_objection}`,
      ...(d.source_ids.length ? [`- Sources:${cite(d.source_ids)}`] : []),
      "",
    );
  }
  out.push("## Timeline", "");
  for (const [key, label] of [["first_30_days", "First 30 days"], ["q1", "Quarter 1"], ["q2", "Quarter 2"], ["q3", "Quarter 3"], ["q4", "Quarter 4"]] as const) {
    out.push(`### ${label}`, "", ...c.timeline[key].map((x) => `- ${x}`), "");
  }
  out.push("## Budget", "", `Total per year: ${formatBillions(c.budget.total_annual_cost_usd_billion)}`, "", `Funded from: ${c.budget.funded_from}`, "", `Arithmetic: ${c.budget.arithmetic}`, "");
  out.push("## What it will not touch", "", ...c.will_not_touch.map((w) => `- **${w.area}**: ${w.reason}`), "");
  out.push("## Risks", "", ...c.risks.map((x) => `- ${x}`), "");
  out.push("## Day 366: what must be true when its power ends", "", ...c.day_366.map((x) => `- ${x}`), "");
  out.push("## Confidence", "", ...c.confidence.map((x) => `- **${x.claim}** ${x.basis}`), "");
  if (f) {
    out.push(
      `## Its forecast for ${f.content.target_year}`,
      "",
      `Made straight after the plan. "As things are" is the model's forecast for the real world and will be scored against the published figure. "With its plan" is its estimate of a world that carried out the plan; it can never be checked.`,
      "",
      f.content.headline,
      "",
      `Its caveat: ${f.content.caveat}`,
      "",
      "| Indicator | Unit | Latest | As things are (80% range) | With its plan (80% range) |",
      "| --- | --- | --- | --- | --- |",
      ...f.content.indicators.map((i) => {
        const n = (v: number) => formatFigure(i.id, v);
        return `| ${INDICATORS[i.id - 1].short} | ${INDICATORS[i.id - 1].unit} | ${n(i.latest.value)} (${i.latest.data_year}) | ${n(i.baseline.value)} (${n(i.baseline.low)} to ${n(i.baseline.high)}) | ${n(i.with_plan.value)} (${n(i.with_plan.low)} to ${n(i.with_plan.high)}) |`;
      }),
      "",
    );
  }
  out.push("## Sources", "", ...[...c.sources].sort((a, b) => a.id - b.id).map((s) => `${s.id}. ${s.title}. ${s.publisher}${s.published ? `, ${s.published}` : ""}. ${s.url}`), "");
  return out.join("\n");
}
