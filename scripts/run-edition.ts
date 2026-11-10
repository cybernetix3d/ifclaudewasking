/**
 * Runs one edition, then its forecast. Each is one clean, headless Claude Code call that is
 * validated, saved and committed. See README.md.
 *
 *   npm run edition               real run: writes editions/ and forecasts/, commits and pushes
 *   npm run edition -- --dry-run  writes to a temp folder, commits nothing
 *   --date YYYY-MM-DD             override the run date (default: today, local time)
 *   --force                       overwrite an existing file for that date
 *   --forecast-only               skip the edition; forecast for the existing edition of that date
 *   --no-forecast                 run the edition only
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forecastModelSchema, validateForecast, validateForecastContent } from "../src/lib/forecast";
import { findLeaks, homeVariants, sanitizeTranscript } from "../src/lib/sanitize";
import { modelSchema, validateContent, validateEdition, type ValidationResult } from "../src/lib/schema";
import { cliVersion, localDate, runHeadless, type Transcript } from "./lib/headless";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Config {
  model: string;
  effort: string;
  max_turns: number;
  cadence_months: number;
}

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FORCE = args.includes("--force");
const FORECAST_ONLY = args.includes("--forecast-only");
const NO_FORECAST = args.includes("--no-forecast");
const dateArg = args[args.indexOf("--date") + 1];
const runDate = args.includes("--date") ? dateArg : localDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate ?? "")) die(`Bad --date: ${dateArg}`);

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function log(msg: string) {
  console.log(`[run-edition] ${msg}`);
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
    log("No git remote, so no GitHub issue opened. Failure details are above.");
    return;
  }
  try {
    log(`Opened issue: ${sh("gh", ["issue", "create", "--title", title, "--body", body])}`);
  } catch (e) {
    log(`Could not open a GitHub issue: ${(e as Error).message}`);
  }
}

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

interface Stage {
  /** "edition" or "forecast": used in logs, commit messages and issue titles. */
  name: string;
  /** Top-level folder the result is saved in. */
  dir: string;
  prompt: Buffer;
  schema: Record<string, unknown>;
  checkContent: (content: unknown) => ValidationResult;
  /** Wrap the model's answer with run metadata. Must not change the answer. */
  build: (t: Transcript, attempt: number) => Record<string, any>;
  checkFile: (file: unknown) => ValidationResult;
}

/** Ask, validate, retry once, then save and commit, or save the failure and open an issue. */
async function runStage(stage: Stage, config: Config, outRoot: string): Promise<boolean> {
  const filePath = path.join(outRoot, stage.dir, `${runDate}.json`);
  const rawPath = path.join(outRoot, stage.dir, "raw", `${runDate}.json`);
  if (!DRY && existsSync(filePath) && !FORCE) die(`The ${stage.name} for ${runDate} already exists. Use --force to replace it.`);
  mkdirSync(path.dirname(rawPath), { recursive: true });

  let last: Transcript | null = null;
  let problems: string[] = [];
  for (let n = 1; n <= 2; n++) {
    log(`${stage.name}, attempt ${n}: asking the model (this can take many minutes)...`);
    const started = Date.now();
    last = await runHeadless({ model: config.model, effort: config.effort, maxTurns: config.max_turns, date: runDate, prompt: stage.prompt, schema: stage.schema });
    problems = [...last.errors];
    if (last.content !== undefined && last.content !== null) problems.push(...stage.checkContent(last.content).errors.map((e) => `schema ${e}`));
    log(`${stage.name}, attempt ${n} finished in ${Math.round((Date.now() - started) / 1000)}s, ${last.searches} searches, ${last.fetches} fetches`);

    if (problems.length === 0) {
      const file = stage.build(last, n);
      const check = stage.checkFile(file);
      if (!check.ok) die(`The ${stage.name} failed final validation: ${check.errors.join("; ")}`);
      // Published raw: machine/account fields stripped, model output untouched. Refuse to
      // publish if the home folder still shows up anywhere.
      const publicRaw = sanitizeTranscript(last.raw, os.homedir());
      const leaks = findLeaks([publicRaw, file], [...homeVariants(os.homedir()), os.tmpdir()]);
      if (leaks.length > 0) die(`Local paths still present after sanitising (${leaks.length}); not publishing. Inspect the transcript.`);
      writeFileSync(rawPath, JSON.stringify(publicRaw, null, 2) + "\n");
      writeFileSync(filePath, JSON.stringify(file, null, 2) + "\n");
      log(`Saved ${filePath}`);
      log(`Saved ${rawPath}`);
      if (DRY) {
        log("Dry run: nothing committed.");
        return true;
      }
      sh("git", ["add", path.relative(ROOT, filePath), path.relative(ROOT, rawPath)]);
      sh("git", ["commit", "-m", `${stage.name[0].toUpperCase()}${stage.name.slice(1)} ${runDate} (${file.meta.model_returned.join(", ")})`]);
      if (hasRemote()) {
        sh("git", ["push"]);
        log("Committed and pushed.");
      } else log("Committed. No git remote yet, so nothing pushed.");
      return true;
    }

    const failedDir = path.join(outRoot, stage.dir, "raw", "failed");
    mkdirSync(failedDir, { recursive: true });
    const failedPath = path.join(failedDir, `${runDate}-attempt${n}.json`);
    writeFileSync(failedPath, JSON.stringify(last.raw, null, 2) + "\n");
    log(`${stage.name}, attempt ${n} failed (${problems.length} problems), raw saved to ${failedPath}:`);
    for (const e of problems.slice(0, 20)) log(`  - ${e}`);
  }

  const body = [
    `The ${runDate} ${stage.name} failed validation twice and was not published.`,
    "",
    `Model: ${config.model}, effort ${config.effort}. Raw responses are saved locally in ${stage.dir}/raw/failed/ on the machine that ran it.`,
    "",
    "Problems on the last attempt:",
    ...problems.slice(0, 30).map((e) => `- ${e}`),
  ].join("\n");
  if (!DRY) openIssue(`${stage.name[0].toUpperCase()}${stage.name.slice(1)} ${runDate} failed`, body);
  else log("Dry run: no issue opened.");
  return false;
}

function meta(config: Config, t: Transcript, attempt: number, version: string) {
  return {
    run_date: runDate,
    model_requested: config.model,
    model_returned: Object.keys(t.result!.modelUsage ?? {}),
    effort: config.effort,
    searches: t.searches,
    fetches: t.fetches,
    attempts: attempt,
    cli_version: version,
  };
}

async function main() {
  const config: Config = JSON.parse(readFileSync(path.join(ROOT, "config.json"), "utf8"));
  const outRoot = DRY ? mkdtempSync(path.join(os.tmpdir(), "ifcwk-dry-")) : ROOT;
  let version = "";
  try {
    version = cliVersion();
  } catch {
    die("Claude Code CLI not found. Install it or set CLAUDE_BIN.");
  }
  log(`${DRY ? "DRY RUN" : "Run"} ${runDate}: model ${config.model}, effort ${config.effort}, max ${config.max_turns} turns, ${version}`);

  if (!FORECAST_ONLY) {
    const king = readFileSync(path.join(ROOT, "prompt", "king.md"));
    log(`king.md sha256 ${sha256(king)}`);
    const ok = await runStage(
      {
        name: "edition",
        dir: "editions",
        prompt: king,
        schema: modelSchema(),
        checkContent: validateContent,
        build: (t, n) => {
          const usage = t.result!.usage ?? {};
          return {
            edition_date: runDate,
            meta: {
              ...meta(config, t, n, version),
              prompt_sha256: sha256(king),
              usage: {
                input_tokens: usage.input_tokens ?? 0,
                output_tokens: usage.output_tokens ?? 0,
                cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
                cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
              },
              runner: "claude-code-cli (headless)",
            },
            content: t.content,
          };
        },
        checkFile: validateEdition,
      },
      config,
      outRoot,
    );
    if (!ok) process.exit(1);
  }

  if (NO_FORECAST) return;

  // The forecast: a second fixed prompt, followed by the plan the model has just written.
  // In a dry run with --forecast-only there is no fresh edition in the temp folder, so read the real one.
  const editionPath = [path.join(outRoot, "editions", `${runDate}.json`), path.join(ROOT, "editions", `${runDate}.json`)].find(existsSync);
  if (!editionPath) die(`No edition for ${runDate} to forecast from.`);
  const editionBytes = readFileSync(editionPath);
  const forecastPrompt = readFileSync(path.join(ROOT, "prompt", "forecast.md"));
  log(`forecast.md sha256 ${sha256(forecastPrompt)}`);
  const plan = Buffer.from(JSON.stringify(JSON.parse(editionBytes.toString("utf8")).content, null, 2) + "\n", "utf8");
  const ok = await runStage(
    {
      name: "forecast",
      dir: "forecasts",
      prompt: Buffer.concat([forecastPrompt, plan]),
      schema: forecastModelSchema(),
      checkContent: (c) => validateForecastContent(c, runDate),
      build: (t, n) => ({
        edition_date: runDate,
        meta: { ...meta(config, t, n, version), prompt_sha256: sha256(forecastPrompt), edition_sha256: sha256(editionBytes) },
        content: t.content,
      }),
      checkFile: validateForecast,
    },
    config,
    outRoot,
  );
  // The edition is already published; a failed forecast is reported but is not a failed edition.
  if (!ok) process.exit(2);
}

main().catch((e) => die((e as Error).stack ?? String(e)));
