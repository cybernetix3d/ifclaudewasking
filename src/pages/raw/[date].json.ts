// Serves each edition's published (sanitised) raw transcript at /raw/<date>.json.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { editions } from "../../lib/editions";

export function getStaticPaths() {
  return editions.map((e) => ({ params: { date: e.edition_date } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(readFileSync(path.join(process.cwd(), "editions", "raw", `${params.date}.json`)), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
