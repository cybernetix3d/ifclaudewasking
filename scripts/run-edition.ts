/**
 * Runs one edition: sends prompt/king.md to Claude through a clean, headless Claude Code
 * session, validates the answer, and saves + commits it. See README.md.
 *
 *   npm run edition               real run: writes editions/, commits and pushes
 *   npm run edition -- --dry-run  writes to a temp folder, commits nothing
 *   --date YYYY-MM-DD             override the run date (default: today, local time)
 *   --force                       overwrite an existing edition for that date
 */
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modelSchema, validateContent, validateEdition } from "../src/lib/schema";
import { findLeaks, homeVariants, sanitizeTranscript } from "../src/lib/sanitize";
import type { Edition } from "../src/lib/types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Config {
  model: string;
  effort: string;
  max_turns: number;
  cadence_months: number;
}

interface Attempt {
  raw: unknown[];
  content: unknown;
  errors: string[];
  result: Record<string, any> | null;
  searches: number;
  fetches: number;
}

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
const dateArg = args[args.indexOf("--date") + 1];
const runDate = args.includes("--date") ? dateArg : localDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate ?? "")) die(`Bad --date: ${dateArg}`);

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function log(msg: string) {
  console.log(`[run-edition] ${msg}`);
}

/** The Claude Code binary. CLAUDE_BIN wins; on Windows use the real .exe so arguments need no shell quoting. */
function claudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === "win32" && process.env.APPDATA) {
    const exe = path.join(process.env.APPDATA, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(exe)) return exe;
  }
  return "claude";
}

/**
 * Everything the model sees: the system prompt (one line, the date), the user message
 * (king.md, byte for byte, on stdin), the WebSearch and WebFetch tool definitions, and the
 * output schema. CLAUDE.md files, auto-memory, hooks, plugins, skills, slash commands, MCP
 * servers and settings files are all switched off, and it runs in an empty temp folder.
 */
export function claudeArgs(config: Config, date: string): string[] {
  return [
    "-p",
    "--model", config.model,
    "--effort", config.effort,
    "--system-prompt", `Today's date is ${date}.`,
    "--restricted",
    "--tools", "WebSearch,WebFetch",
    // Without this, headless mode refuses every tool call (no one is there to approve it).
    "--allowedTools", "WebSearch,WebFetch",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--mcp-config", JSON.stringify({ mcpServers: {} }),
    "--settings", JSON.stringify({ disableAllHooks: true }),
    "--no-session-persistence",
    "--max-turns", String(config.max_turns),
    "--json-schema", JSON.stringify(modelSchema()),
    "--output-format", "stream-json",
    "--verbose",
  ];
}

function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" };
  // No API key: the run uses the signed-in Claude subscription, never API billing.
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function runClaude(config: Config, prompt: Buffer): Promise<Attempt> {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "ifcwk-run-"));
  return new Promise((resolve) => {
    const child = spawn(claudeBin(), claudeArgs(config, runDate), { cwd, env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.stdin.end(prompt);
    child.on("close", (code) => {
      const raw: unknown[] = [];
      for (const line of out.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          raw.push(JSON.parse(line));
        } catch {
          raw.push({ unparsed_line: line });
        }
      }
      if (err.trim()) raw.push({ stderr: err });
      resolve(interpret(raw, code));
    });
  });
}

/** Pull the answer, tool counts and errors out of a stream-json transcript. Never alters the answer. */
export function interpret(raw: unknown[], exitCode: number | null): Attempt {
  const errors: string[] = [];
  let searches = 0;
  let fetches = 0;
  for (const ev of raw as any[]) {
    if (ev?.type !== "assistant") continue;
    for (const block of ev.message?.content ?? []) {
      if (block?.type !== "tool_use") continue;
      if (block.name === "WebSearch") searches++;
      if (block.name === "WebFetch") fetches++;
    }
  }
  const result = (raw as any[]).findLast((ev) => ev?.type === "result") ?? null;
  if (exitCode !== 0) errors.push(`claude exited with code ${exitCode}`);
  if (!result) errors.push("no result event in output");
  else if (result.is_error || result.subtype !== "success") errors.push(`run did not succeed: subtype=${result.subtype} stop_reason=${result.stop_reason}`);
  // A run where research was blocked is a broken run, not an answer: never publish it.
  const denials = (result?.permission_denials ?? []) as { tool_name?: string }[];
  if (denials.length > 0) errors.push(`${denials.length} tool calls were blocked (${[...new Set(denials.map((d) => d.tool_name))].join(", ")}); research did not happen`);
  if (searches === 0) errors.push("the model made no web searches");

  let content: unknown = result?.structured_output;
  if (content === undefined && typeof result?.result === "string") {
    try {
      content = JSON.parse(result.result);
    } catch {
      errors.push("final answer is not valid JSON");
    }
  }
  if (content === undefined || content === null) errors.push("no JSON answer found");
  else {
    const v = validateContent(content);
    errors.push(...v.errors.map((e) => `schema ${e}`));
  }
  return { raw, content, errors, result, searches, fetches };
}

function sh(cmd: string, cmdArgs: string[]): string {
  return execFileSync(cmd, cmdArgs, { cwd: ROOT, encoding: "utf8" }).trim();
}

function hasRemote(): boolean {
  try {
    return sh("git", ["remote"]).length > 0;
  } catch {
    return false;
  }
}

function openIssue(title: string, body: string) {
  if (!hasRemote()) {
    log("No git remote, so no GitHub issue opened. Failure details are above and in editions/raw/failed/.");
    return;
  }
  try {
    const url = sh("gh", ["issue", "create", "--title", title, "--body", body]);
    log(`Opened issue: ${url}`);
  } catch (e) {
    log(`Could not open a GitHub issue: ${(e as Error).message}`);
  }
}

async function main() {
  const config: Config = JSON.parse(readFileSync(path.join(ROOT, "config.json"), "utf8"));
  const prompt = readFileSync(path.join(ROOT, "prompt", "king.md"));
  const sha = createHash("sha256").update(prompt).digest("hex");

  const outRoot = DRY ? mkdtempSync(path.join(os.tmpdir(), "ifcwk-dry-")) : ROOT;
  const editionPath = path.join(outRoot, "editions", `${runDate}.json`);
  const rawPath = path.join(outRoot, "editions", "raw", `${runDate}.json`);
  if (!DRY && existsSync(editionPath) && !FORCE) die(`Edition ${runDate} already exists. Use --force to replace it.`);
  mkdirSync(path.dirname(rawPath), { recursive: true });

  let cliVersion = "";
  try {
    cliVersion = execFileSync(claudeBin(), ["--version"], { encoding: "utf8" }).trim();
  } catch {
    die("Claude Code CLI not found. Install it or set CLAUDE_BIN.");
  }

  log(`${DRY ? "DRY RUN" : "Run"} ${runDate}: model ${config.model}, effort ${config.effort}, max ${config.max_turns} turns, ${cliVersion}`);
  log(`king.md sha256 ${sha}`);

  let attempt: Attempt | null = null;
  for (let n = 1; n <= 2; n++) {
    log(`Attempt ${n}: asking the model (this can take many minutes)...`);
    const started = Date.now();
    attempt = await runClaude(config, prompt);
    log(`Attempt ${n} finished in ${Math.round((Date.now() - started) / 1000)}s, ${attempt.searches} searches, ${attempt.fetches} fetches`);
    if (attempt.errors.length === 0) {
      const usage = attempt.result!.usage ?? {};
      const edition: Edition = {
        edition_date: runDate,
        meta: {
          run_date: runDate,
          model_requested: config.model,
          model_returned: Object.keys(attempt.result!.modelUsage ?? {}),
          effort: config.effort,
          prompt_sha256: sha,
          usage: {
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
          },
          searches: attempt.searches,
          fetches: attempt.fetches,
          attempts: n,
          runner: "claude-code-cli (headless)",
          cli_version: cliVersion,
        },
        content: attempt.content as Edition["content"],
      };
      const check = validateEdition(edition);
      if (!check.ok) die(`Edition failed final validation: ${check.errors.join("; ")}`);
      // Published raw: machine/account fields stripped, model output untouched. Refuse to
      // publish if the home folder still shows up anywhere.
      const publicRaw = sanitizeTranscript(attempt.raw, os.homedir());
      const leaks = findLeaks([publicRaw, edition], [...homeVariants(os.homedir()), os.tmpdir()]);
      if (leaks.length > 0) die(`Local paths still present after sanitising (${leaks.length}); not publishing. Inspect the transcript.`);
      writeFileSync(rawPath, JSON.stringify(publicRaw, null, 2) + "\n");
      writeFileSync(editionPath, JSON.stringify(edition, null, 2) + "\n");
      log(`Saved ${editionPath}`);
      log(`Saved ${rawPath}`);
      if (DRY) {
        log("Dry run: nothing committed.");
        return;
      }
      sh("git", ["add", path.relative(ROOT, editionPath), path.relative(ROOT, rawPath)]);
      sh("git", ["commit", "-m", `Edition ${runDate} (${edition.meta.model_returned.join(", ")})`]);
      if (hasRemote()) {
        sh("git", ["push"]);
        log("Committed and pushed.");
      } else log("Committed. No git remote yet, so nothing pushed.");
      return;
    }
    const failedDir = path.join(outRoot, "editions", "raw", "failed");
    mkdirSync(failedDir, { recursive: true });
    const failedPath = path.join(failedDir, `${runDate}-attempt${n}.json`);
    writeFileSync(failedPath, JSON.stringify(attempt.raw, null, 2) + "\n");
    log(`Attempt ${n} failed (${attempt.errors.length} problems), raw saved to ${failedPath}:`);
    for (const e of attempt.errors.slice(0, 20)) log(`  - ${e}`);
  }

  const body = [
    `The ${runDate} edition failed validation twice and was not published.`,
    "",
    `Model: ${config.model}, effort ${config.effort}. Raw responses are saved locally in editions/raw/failed/ on the machine that ran it.`,
    "",
    "Problems on the last attempt:",
    ...attempt!.errors.slice(0, 30).map((e) => `- ${e}`),
  ].join("\n");
  if (!DRY) openIssue(`Edition ${runDate} failed`, body);
  else log("Dry run: no issue opened.");
  process.exit(1);
}

main().catch((e) => die((e as Error).stack ?? String(e)));
