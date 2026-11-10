// Validates every editions/*.json and forecasts/*.json against its schema. Used by CI.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { validateForecast } from "../src/lib/forecast";
import { validateEdition } from "../src/lib/schema";

let bad = 0;
for (const [dir, validate] of [["editions", validateEdition], ["forecasts", validateForecast]] as const) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : [];
  let ok = 0;
  for (const f of files) {
    const r = validate(JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
    if (r.ok) ok++;
    else {
      bad++;
      console.error(`${dir}/${f}:\n  ${r.errors.join("\n  ")}`);
    }
  }
  console.log(`${ok}/${files.length} ${dir} valid`);
}
if (bad) process.exit(1);
