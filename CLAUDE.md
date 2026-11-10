# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ifclaudewasking.com: every 3 months the latest frontier Claude model answers the fixed prompt `prompt/king.md` (king of the world for a year) with web research, and the answer is published unedited. Static Astro site; the git repo is the database (one JSON file per edition). README.md covers the run flow and failure handling.

## Commands

- `npm test` runs all tests (vitest). One file: `npx vitest run tests/compare.test.ts`; one test: add `-t "detects rewording"`.
- `npm run build` / `npm run dev` for the site. In dev, `/editions/<date>` returns the raw JSON module (Vite serves the root `editions/` folder at that path); check edition pages with `npm run build && npm run preview`. `prebuild`/`predev` copy `edition-zero/` into `public/`.
- `npm run edition:dry` does a full model run into a temp folder, with no commit. `npm run edition` is a real run: it commits and pushes. Never run a real edition without the owner's go-ahead.
- `npx tsx scripts/validate-editions.ts` validates every committed edition. `npm run check:secrets` scans tracked files for key patterns. CI runs both.

## Before changing anything visible

Read `DESIGN.md` and follow it. It holds the honesty rules for how numbers are shown (published vs forecast vs with-plan), the motion rules, and the ordered checklist for "make it better". Check changes in the browser in both themes and at phone width.

## Architecture

- **No Anthropic API.** `scripts/run-edition.ts` runs `claude -p` (Claude Code headless, on the owner's subscription) in an empty temp dir. Its system prompt is replaced by `Today's date is YYYY-MM-DD.`, `king.md` goes in on stdin, and only the WebSearch/WebFetch tools are enabled. CLAUDE.md files, memory, hooks, plugins, skills and MCP are disabled, and API key env vars are stripped. Each of those flags exists because the model otherwise saw the owner's global CLAUDE.md and plugin hook output (tested). Keep them all when changing the invocation.
- Published raw transcripts go through `src/lib/sanitize.ts`, which strips init-event paths, rate-limit events and stderr, and replaces home-folder paths in tool results. The runner then hard-fails if any home-folder form (including Claude Code's `C--Users-<name>` slug) remains. Never sanitise assistant or result events; the model's output stays verbatim.
- After each edition, the same runner makes a second call with `prompt/forecast.md` plus the edition's content, producing `forecasts/<date>.json`: numeric baseline and with-plan forecasts per indicator. `src/lib/forecast.ts` validates and scores them (baseline only; with-plan is uncheckable by design and must always be labelled so). `scripts/lib/headless.ts` is the single place the isolated `claude -p` invocation lives.
- `data/pulse.json` holds monthly public measurements, refreshed by `.github/workflows/pulse.yml`. It is the only data no model has touched; never mix it with model output in one series.
- A desktop-app scheduled task triggers runs quarterly. GitHub Actions only runs CI (`.github/workflows/ci.yml`); Vercel deploys on push.
- `schema/edition.schema.json` is the single schema. `src/lib/schema.ts` validates it with ajv and adds semantic checks: indicator order, source references, unique ranks. `modelSchema()` strips constraints structured output rejects (min/max, maxItems, minItems > 1) before passing it to `--json-schema`. The full schema is still enforced locally.
- `src/lib/compare.ts` is pure and shared by tests and the `/compare` page (runs client-side from data embedded at build; no network calls). Decrees match by exact title, then greedy Jaccard similarity above `REWORD_THRESHOLD`.
- `src/lib/editions.ts` loads `editions/*.json` at build via `import.meta.glob`. `REPO_URL` is a placeholder until the GitHub repo exists.

## Invariants

- `prompt/king.md` and `prompt/forecast.md` are never edited. Its SHA-256 is recorded per edition.
- Edition content is published verbatim or not at all: never hand-edit `editions/*.json` or `forecasts/*.json`, and never trim or "fix" model output in code.
- Fixtures in `tests/fixture.ts` are synthetic and must never be copied into `editions/`.
- The footer disclaimer on every page is required wording (`src/layouts/Base.astro`).
- Figures with `verified: false` must stay visually distinct (dashed tonal card, "Unverified" chip, hollow chart point). Don't use coloured edge stripes on cards; use tonal surfaces and chips.
