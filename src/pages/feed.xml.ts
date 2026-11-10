import type { APIRoute } from "astro";
import { answeringModel, editionNumber, editions } from "../lib/editions";

const ORIGIN = "https://ifclaudewasking.com";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = () => {
  const items = editions
    .map(
      (e) => `    <item>
      <title>${esc(`Edition ${editionNumber(e)}: what ${answeringModel(e)} would do as king for a year`)}</title>
      <link>${ORIGIN}/editions/${e.edition_date}</link>
      <guid isPermaLink="true">${ORIGIN}/editions/${e.edition_date}</guid>
      <pubDate>${new Date(`${e.edition_date}T09:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(e.content.summary)}</description>
    </item>`,
    )
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>If Claude Was King</title>
    <link>${ORIGIN}/</link>
    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Every three months the latest Claude AI model is asked what it would do as king of the world for a year. Published unedited.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
