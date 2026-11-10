export interface Indicator {
  id: number;
  name: string;
  value: string;
  data_year: string;
  source_ids: number[];
  verified: boolean;
  note: string;
}

export interface Decree {
  rank: number;
  title: string;
  order: string;
  delivered_by: string;
  annual_cost_usd_billion: number | null;
  cost_basis: string;
  expected_result_day_365: string;
  how_to_check: string;
  basis: "evidence" | "judgement" | "contested";
  strongest_objection: string;
  source_ids: number[];
}

export interface Source {
  id: number;
  title: string;
  publisher: string;
  url: string;
  published: string;
}

export interface EditionContent {
  premise: string;
  summary: string;
  indicators: Indicator[];
  decrees: Decree[];
  timeline: { first_30_days: string[]; q1: string[]; q2: string[]; q3: string[]; q4: string[] };
  budget: { total_annual_cost_usd_billion: number | null; funded_from: string; arithmetic: string };
  will_not_touch: { area: string; reason: string }[];
  risks: string[];
  day_366: string[];
  confidence: { claim: string; basis: string }[];
  sources: Source[];
}

export interface EditionMeta {
  run_date: string;
  model_requested: string;
  model_returned: string[];
  effort: string;
  prompt_sha256: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  searches: number;
  fetches: number;
  attempts: number;
  runner: string;
  cli_version?: string;
}

export interface Edition {
  edition_date: string;
  meta: EditionMeta;
  content: EditionContent;
}
