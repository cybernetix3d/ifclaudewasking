// Fails if anything tracked by git (or, outside git, any file in the repo) looks like an API key.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const PATTERNS = [
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI-style key", re: /\bsk-(proj-)?[A-Za-z0-9]{32,}/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".astro"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

let files;
try {
  files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
} catch {
  files = walk(".");
}

let hits = 0;
for (const f of files) {
  if (f.endsWith("check-secrets.mjs")) continue;
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) { console.error(`SECRET PATTERN (${name}) in ${f}`); hits++; }
  }
}
if (hits) { console.error(`${hits} possible secret(s) found. Remove them before committing.`); process.exit(1); }
console.log(`check-secrets: ${files.length} files clean`);
