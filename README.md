# If Claude Was King

A long-running experiment at [ifclaudewasking.com](https://ifclaudewasking.com). Every three months the latest frontier Claude model is given the same fixed prompt ([prompt/king.md](prompt/king.md): "you are king of the world for one year, give your plan"), researches the world on the web, and its answer is published unedited.

There is no database and no API key. The git repo is the database, and runs use the site owner's Claude subscription through Claude Code.

```
prompt/king.md                  the fixed prompt, sent byte for byte. Never edited after launch.
config.json                     model, effort, max research turns, cadence
schema/edition.schema.json      JSON Schema for an edition file
editions/YYYY-MM-DD.json        a published edition (metadata + the model's answer, verbatim)
editions/raw/YYYY-MM-DD.json    the full Claude Code stream-json transcript of that run, with machine details stripped (see below)
editions/raw/failed/            raw output of failed attempts (local only, gitignored)
edition-zero/                   the original one-off answer, linked from /method, not in the timeline
scripts/run-edition.ts          the runner
src/                            the Astro site
```

## How a run works

1. A scheduled task in the Claude desktop app fires on the 1st of January, April, July and October and runs `npm run edition` in this folder.
2. The runner starts `claude -p` in an empty temp folder with:
   - system prompt replaced by exactly `Today's date is YYYY-MM-DD.`
   - `prompt/king.md` on stdin as the user message
   - only the `WebSearch` and `WebFetch` tools
   - `--json-schema` set to the content schema (minus constraints structured output can't enforce)
   - CLAUDE.md files, auto-memory, hooks, plugins, skills, slash commands, MCP servers and settings files switched off
   - `ANTHROPIC_API_KEY` removed from its environment, so it always uses the subscription
3. It validates the answer against the full schema plus three extra checks (indicators in order 1 to 10, every cited source exists, unique decree ranks). On failure it retries once.
4. On success it writes `editions/<date>.json` and `editions/raw/<date>.json`, commits, and pushes to `main`. Vercel deploys on push.
5. On a second failure it publishes nothing, saves the raw output to `editions/raw/failed/`, and opens a GitHub issue with the problems.

The runner never edits, trims or fixes the model's content.

### What is stripped from the published raw transcript

`src/lib/sanitize.ts` removes machine and account details before `editions/raw/<date>.json` is written:
- local paths in the init event (`cwd`, `original_cwd`, `scratchpad_path`, `powershell_path`, `additional_directories`)
- every `rate_limit_event`, which carries subscription usage and limits
- CLI stderr
- the home-folder prefix in tool results, replaced with `~`. Web fetch notes where it cached PDFs, using both the path and Claude Code's folder-name form (`C--Users-<name>-...`).

Assistant messages, the result event and the structured answer are never touched. A note at the end of each transcript says what was removed. The runner refuses to publish if any form of the home folder or temp folder still appears in the transcript or edition. Raw output of failed attempts, in `editions/raw/failed/`, is kept unsanitised and is never committed.

## Run an edition locally

Needs Node 22+ and Claude Code installed and signed in (`claude --version` works).

```bash
npm install
```

```bash
npm run edition:dry
```

A dry run does the full run but writes to a temp folder and commits nothing. The log prints where the files went.

```bash
npm run edition
```

A real run uses today's local date. Options: `--date YYYY-MM-DD` to set the date, `--force` to replace an existing edition for that date. A run with Fable 5.2 at `high` effort takes many minutes.

If Claude Code is somewhere unusual, set `CLAUDE_BIN` to its executable.

## Change the model

Edit `config.json`:

```json
{ "model": "claude-fable-5-2", "effort": "high", "max_turns": 60, "cadence_months": 3 }
```

- `model`: any model ID Claude Code accepts. Every edition records the model that actually answered (`meta.model_returned`), and `/method` lists the history.
- `effort`: `low`, `medium`, `high`, `xhigh` or `max`. Kept fixed so editions stay comparable.
- `max_turns`: a ceiling on research turns. Claude Code has no per-search cap, so the actual number of searches and fetches is recorded on each edition instead.

Do a dry run after changing the model, then commit the config change on its own.

## When a run fails

1. Read the issue the runner opened, or the console output of the scheduled task. It lists every validation problem.
2. Look at the raw transcripts in `editions/raw/failed/<date>-attempt1.json` and `-attempt2.json` on the machine that ran it.
3. Common causes:
   - **Not signed in / CLI missing**: run `claude` once interactively and sign in.
   - **Refusal or `max_turns` reached**: the result event's `subtype` and `stop_reason` say which. For `max_turns`, raise it in `config.json`.
   - **Schema failure**: the model returned something off-format. Do not edit the output. Re-run with `npm run edition` (same day) or `npm run edition -- --date <original date>`.
4. If a schema rule itself is wrong, fix the schema in its own commit, note it in the commit message, and re-run. Never hand-edit an edition file.

## Develop

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run check:secrets` fails if anything tracked looks like an API key or token. CI runs it with the tests, edition validation and the build on every push.

An independent experiment. Not affiliated with or endorsed by Anthropic. Generated by an AI model as a thought experiment. Not advice.
