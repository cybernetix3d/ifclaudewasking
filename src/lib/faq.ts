import { answeringModel, config, editionNumber, formatDate, latest } from "./editions";

/** The questions on the landing page. Also published as FAQPage structured data and in llms.txt. */
export function faq(): { q: string; a: string }[] {
  return [
    {
      q: "What is If Claude Was King?",
      a: `An experiment that asks the same question every ${config.cadence_months} months: if the newest Claude AI model were king of the world for exactly one year, what would it do? The model researches the state of the world on the web, writes a costed plan, and the answer is published exactly as it wrote it.`,
    },
    {
      q: "Does anyone edit the answers?",
      a: "No. Each answer is checked against a fixed format and then published word for word, or not published at all. Nobody trims, corrects or rewrites it. The full transcript of every run is public.",
    },
    {
      q: "Which AI model answers?",
      a: latest
        ? `The latest frontier Claude model from Anthropic at the time of each edition. Edition ${editionNumber(latest)}, on ${formatDate(latest.edition_date)}, was answered by ${answeringModel(latest)}. When a newer model is released, the next edition uses it, so the series shows how the plan changes as the models change.`
        : "The latest frontier Claude model from Anthropic at the time of each edition.",
    },
    {
      q: "Is the prompt the same every time?",
      a: "Yes. The prompt is fixed, sent byte for byte, and its fingerprint is recorded on every edition. The model is told only today's date. It never sees earlier editions.",
    },
    {
      q: "Can the plan's results be checked?",
      a: "Partly. After each edition the model forecasts ten world indicators for the following year, twice: for the world as it is, and for a world that carried out its plan. The first forecast is scored when the real figure is published. The second can never be checked, because nobody will carry the plan out. A wrong forecast stays up, marked wrong.",
    },
    {
      q: "Is this affiliated with Anthropic?",
      a: "No. It is an independent experiment, not affiliated with or endorsed by Anthropic. The plans are a thought experiment written by an AI model. They are not advice.",
    },
    {
      q: "Can I use the data?",
      a: "Every edition and forecast is a JSON file in a public repository, and each edition is also published as plain text. The code that runs the experiment is public too.",
    },
  ];
}
