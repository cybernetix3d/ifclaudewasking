// Each edition as JSON: /data/editions/<date>.json
import type { APIRoute } from "astro";
import { editions } from "../../../lib/editions";

export function getStaticPaths() {
  return editions.map((edition) => ({ params: { date: edition.edition_date }, props: { edition } }));
}

export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.edition, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
