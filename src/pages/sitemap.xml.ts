import type { APIRoute } from "astro";
import { editions } from "../lib/editions";

const ORIGIN = "https://ifclaudewasking.com";

export const GET: APIRoute = () => {
  const newest = editions[0]?.edition_date;
  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: "/", lastmod: newest, priority: "1.0" },
    ...editions.map((e) => ({ loc: `/editions/${e.edition_date}`, lastmod: e.edition_date, priority: "0.9" })),
    { loc: "/indicators", lastmod: newest, priority: "0.8" },
    { loc: "/editions", lastmod: newest, priority: "0.7" },
    { loc: "/compare", lastmod: newest, priority: "0.6" },
    { loc: "/method", priority: "0.6" },
    { loc: "/edition-zero/seven-weeks-as-king", priority: "0.3" },
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${ORIGIN}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
