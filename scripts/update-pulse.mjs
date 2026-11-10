// Fetches three monthly public measurements and writes data/pulse.json.
// Run weekly by .github/workflows/pulse.yml. No keys needed. These are measurements, not
// model output: they are the only numbers on the site that no model has touched.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const SINCE = 2015;

const SOURCES = [
  {
    id: "co2",
    name: "Carbon dioxide in the air",
    unit: "parts per million",
    note: "Monthly mean at Mauna Loa, seasonal cycle removed.",
    publisher: "NOAA Global Monitoring Laboratory",
    page: "https://gml.noaa.gov/ccgg/trends/",
    url: "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv",
    // year,month,decimal date,average,deseasonalized,...
    parse: (text) =>
      rows(text)
        .map((c) => ({ t: `${c[0]}-${pad(c[1])}`, v: Number(c[4]) }))
        .filter((p) => p.v > 0),
  },
  {
    id: "ch4",
    name: "Methane in the air",
    unit: "parts per billion",
    note: "Global monthly mean, trend with the seasonal cycle removed.",
    publisher: "NOAA Global Monitoring Laboratory",
    page: "https://gml.noaa.gov/ccgg/trends_ch4/",
    url: "https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.csv",
    // year,month,decimal,average,average_unc,trend,trend_unc
    parse: (text) =>
      rows(text)
        .map((c) => ({ t: `${c[0]}-${pad(c[1])}`, v: Number(c[5]) }))
        .filter((p) => p.v > 0),
  },
  {
    id: "temp",
    name: "Global surface temperature",
    unit: "°C above the 1951 to 1980 average",
    note: "Monthly land and ocean anomaly, shown as a 12-month running mean.",
    publisher: "NASA GISS (GISTEMP v4)",
    page: "https://data.giss.nasa.gov/gistemp/",
    url: "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
    // Year,Jan..Dec,J-D,... with *** for missing months
    parse: (text) => {
      const monthly = [];
      for (const c of rows(text)) {
        if (!/^\d{4}$/.test(c[0])) continue;
        for (let m = 1; m <= 12; m++) {
          const v = Number(c[m]);
          if (Number.isFinite(v)) monthly.push({ t: `${c[0]}-${pad(m)}`, v });
        }
      }
      // 12-month running mean, so the line shows the trend rather than the weather.
      return monthly.slice(11).map((p, i) => ({ t: p.t, v: round(mean(monthly.slice(i, i + 12).map((x) => x.v)), 3) }));
    },
  },
];

const pad = (n) => String(Number(n)).padStart(2, "0");
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const rows = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split(",").map((x) => x.trim()));

const previous = existsSync("data/pulse.json") ? JSON.parse(readFileSync("data/pulse.json", "utf8")) : { series: [] };
const series = [];
let failed = 0;

for (const s of SOURCES) {
  try {
    const res = await fetch(s.url, { headers: { "User-Agent": "pulse-fetch" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const points = s.parse(await res.text()).filter((p) => Number(p.t.slice(0, 4)) >= SINCE);
    if (points.length < 24) throw new Error(`only ${points.length} points parsed`);
    const { parse, url, ...info } = s;
    series.push({ ...info, points });
    console.log(`${s.id}: ${points.length} months, latest ${points.at(-1).t} = ${points.at(-1).v}`);
  } catch (e) {
    failed++;
    console.error(`${s.id}: fetch failed (${e.message}); keeping the previous data`);
    const old = previous.series.find((x) => x.id === s.id);
    if (old) series.push(old);
  }
}

if (series.length === 0) {
  console.error("No data at all; not writing.");
  process.exit(1);
}

// Only the data decides whether the file changes, so an unchanged week makes no commit.
const next = { series };
if (JSON.stringify(next) === JSON.stringify({ series: previous.series })) {
  console.log("No change.");
} else {
  mkdirSync("data", { recursive: true });
  writeFileSync("data/pulse.json", JSON.stringify(next, null, 1) + "\n");
  console.log("Wrote data/pulse.json");
}
if (failed === SOURCES.length) process.exit(1);
