// Serves each published (sanitised) raw transcript: /raw/<date>.json for the edition and
// /raw/<date>-forecast.json for its forecast.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { editions, forecasts } from "../../lib/editions";

export function getStaticPaths() {
  return [
    ...editions.map((e) => ({ params: { date: e.edition_date }, props: { file: path.join("editions", "raw", `${e.edition_date}.json`) } })),
    ...forecasts.map((f) => ({ params: { date: `${f.edition_date}-forecast` }, props: { file: path.join("forecasts", "raw", `${f.edition_date}.json`) } })),
  ];
}

export const GET: APIRoute = ({ props }) =>
  new Response(readFileSync(path.join(process.cwd(), props.file as string)), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
