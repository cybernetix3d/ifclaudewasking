// Validates every editions/*.json against the schema. Used by CI.
import { readdirSync, readFileSync } from "node:fs";
import { validateEdition } from "../src/lib/schema";

const files = readdirSync("editions").filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
let bad = 0;
for (const f of files) {
  const r = validateEdition(JSON.parse(readFileSync(`editions/${f}`, "utf8")));
  if (!r.ok) { bad++; console.error(`${f}:\n  ${r.errors.join("\n  ")}`); }
}
console.log(`${files.length - bad}/${files.length} editions valid`);
if (bad) process.exit(1);
