// Each forecast as JSON: /data/forecasts/<date>.json
import type { APIRoute } from "astro";
import { forecasts } from "../../../lib/editions";

export function getStaticPaths() {
  return forecasts.map((forecast) => ({ params: { date: forecast.edition_date }, props: { forecast } }));
}

export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.forecast, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
