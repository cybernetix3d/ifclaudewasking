// Draws the share image (public/og.png, 1200x630) shown when the site is linked on social
// media and in chat apps. Run `npm run og` after changing it; the PNG is committed.
import sharp from "sharp";

const W = 1200;
const H = 630;
const INK = "#e4edf7";
const INK2 = "#a9bdd4";
const MARK = "#9cc8f2";
const GRID = "#1d3f6b";

const grid = [];
for (let x = 0; x <= W; x += 40) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID}" stroke-width="1"/>`);
for (let y = 0; y <= H; y += 40) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);

// the dimension line: day 1 to day 365 in phases, then the dashed run-out to day 366
const L = 80;
const R = 1000;
const Y = 452;
const phases = [30, 61, 91, 92, 91];
let acc = 0;
const ticks = phases.slice(0, -1).map((d) => {
  acc += d;
  const x = L + (acc / 365) * (R - L);
  return `<line x1="${x}" y1="${Y - 12}" x2="${x}" y2="${Y + 12}" stroke="${INK}" stroke-width="3"/>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0f2a4d"/>
  ${grid.join("")}
  <text x="${L}" y="118" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30" fill="${INK2}">ifclaudewasking.com</text>
  <text x="${L}" y="232" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="92" fill="${INK}" letter-spacing="-2">If Claude was king</text>
  <text x="${L}" y="332" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="92" fill="${INK}" letter-spacing="-2">for a year</text>
  <text x="${L}" y="${Y - 34}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="24" fill="${INK}">Day 1</text>
  <text x="${R}" y="${Y - 34}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="24" fill="${INK}">Day 365</text>
  <line x1="${L}" y1="${Y}" x2="${R}" y2="${Y}" stroke="${INK}" stroke-width="5"/>
  <line x1="${L}" y1="${Y - 26}" x2="${L}" y2="${Y + 26}" stroke="${INK}" stroke-width="4"/>
  <line x1="${R}" y1="${Y - 26}" x2="${R}" y2="${Y + 26}" stroke="${INK}" stroke-width="4"/>
  ${ticks.join("")}
  <line x1="${R + 6}" y1="${Y}" x2="${W - 80}" y2="${Y}" stroke="${MARK}" stroke-width="5" stroke-dasharray="12 10"/>
  <text x="${W - 80}" y="${Y - 34}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="24" fill="${MARK}">Day 366</text>
  <text x="${L}" y="548" font-family="Georgia, 'Times New Roman', serif" font-size="31" fill="${INK}">Every three months we ask the newest Claude what it would do</text>
  <text x="${L}" y="590" font-family="Georgia, 'Times New Roman', serif" font-size="31" fill="${INK}">with the world. We publish every word, then keep score.</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile("public/og.png");
console.log("Wrote public/og.png");
