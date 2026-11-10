// Each edition as plain Markdown: /editions/<date>.md
import type { APIRoute } from "astro";
import { editions } from "../../lib/editions";
import { editionMarkdown } from "../../lib/markdown";
import type { Edition } from "../../lib/types";

export function getStaticPaths() {
  return editions.map((edition) => ({ params: { date: edition.edition_date }, props: { edition } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(editionMarkdown(props.edition as Edition), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
