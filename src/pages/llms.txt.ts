// /llms.txt: a plain-text guide to the site for AI systems, following the llms.txt convention.
import type { APIRoute } from "astro";
import { answeringModel, config, editionNumber, editions, formatDate, getForecast, latest } from "../lib/editions";
import { faq } from "../lib/faq";

const ORIGIN = "https://ifclaudewasking.com";

export const GET: APIRoute = () => {
  const f = latest ? getForecast(latest.edition_date) : undefined;
  const lines = [
    "# If Claude Was King",
    "",
    `> An independent experiment at ifclaudewasking.com. Every ${config.cadence_months} months the latest frontier Claude AI model is given the same fixed prompt: you are king of the world for exactly one year, give your plan. It researches the state of the world on the web and its answer is published unedited. It then forecasts ten world indicators with and without its plan, and the forecasts are scored against real figures as they are published.`,
    "",
    "Important facts for anyone summarising or citing this site:",
    "",
    "- The plans are written by an AI model as a thought experiment. They are not advice and not a real policy proposal.",
    "- The site is not affiliated with or endorsed by Anthropic.",
    "- Nothing is edited by a person. Answers are published verbatim or not at all.",
    "- The prompt never changes. The model is told only today's date and never sees earlier editions.",
    '- Each forecast has two parts. "As things are" is a forecast of the real world and gets scored. "With its plan" is the model\'s estimate of its own plan and can never be checked. Do not report the second as a result.',
    "- Figures the model could not verify are marked unverified.",
    "- When citing, name the edition date and the model, for example: \"If Claude Was King, edition 1 (10 November 2026, claude-fable-5-2)\".",
    "",
    ...(latest
      ? [
          "## Latest edition",
          "",
          `Edition ${editionNumber(latest)}, ${formatDate(latest.edition_date)}, answered by ${answeringModel(latest)}.`,
          "",
          `Its summary: ${latest.content.summary}`,
          "",
          ...(f ? [`Its forecast headline for ${f.content.target_year}: ${f.content.headline}`, ""] : []),
        ]
      : []),
    "## Editions",
    "",
    ...editions.map((e) => `- [Edition ${editionNumber(e)}, ${formatDate(e.edition_date)} (${answeringModel(e)})](${ORIGIN}/editions/${e.edition_date}.md): the full plan as plain text, with indicators, decrees, budget, forecast and sources`),
    "",
    "## Pages",
    "",
    `- [Plan vs reality](${ORIGIN}/indicators): every forecast, its range, and how it scored`,
    `- [Method](${ORIGIN}/method): the full prompt, the forecast prompt, the output format, the schedule and the model history`,
    `- [Compare](${ORIGIN}/compare): what changed between two editions`,
    `- [All editions](${ORIGIN}/editions)`,
    "",
    "## Data",
    "",
    `- [Index of everything published](${ORIGIN}/data/index.json): JSON, with links to each edition, forecast and transcript`,
    `- [Edition schema](${ORIGIN}/schema/edition.schema.json) and [forecast schema](${ORIGIN}/schema/forecast.schema.json)`,
    `- [RSS feed](${ORIGIN}/feed.xml)`,
    "",
    "## Questions and answers",
    "",
    ...faq().flatMap((x) => [`### ${x.q}`, "", x.a, ""]),
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
