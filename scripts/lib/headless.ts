/**
 * One clean, headless Claude Code call. Shared by the edition and forecast runners so the
 * isolation flags live in exactly one place.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface HeadlessOptions {
  model: string;
  effort: string;
  maxTurns: number;
  /** YYYY-MM-DD, the only thing in the system prompt. */
  date: string;
  /** The user message, sent on stdin byte for byte. */
  prompt: Buffer;
  /** JSON Schema for the final answer (already stripped of unsupported constraints). */
  schema: Record<string, unknown>;
}

export interface Transcript {
  raw: unknown[];
  result: Record<string, any> | null;
  content: unknown;
  errors: string[];
  searches: number;
  fetches: number;
}

/** The Claude Code binary. CLAUDE_BIN wins; on Windows use the real .exe so arguments need no shell quoting. */
export function claudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === "win32" && process.env.APPDATA) {
    const exe = path.join(process.env.APPDATA, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(exe)) return exe;
  }
  return "claude";
}

export function cliVersion(): string {
  return execFileSync(claudeBin(), ["--version"], { encoding: "utf8" }).trim();
}

/**
 * Everything the model sees: the system prompt (one line, the date), the user message on
 * stdin, the WebSearch and WebFetch tool definitions, and the output schema. CLAUDE.md files,
 * auto-memory, hooks, plugins, skills, slash commands, MCP servers and settings files are all
 * switched off, and it runs in an empty temp folder. Every flag here is load-bearing: without
 * them the model saw the owner's global instructions and plugin output (tested).
 */
export function headlessArgs(o: Omit<HeadlessOptions, "prompt">): string[] {
  return [
    "-p",
    "--model", o.model,
    "--effort", o.effort,
    "--system-prompt", `Today's date is ${o.date}.`,
    "--restricted",
    "--tools", "WebSearch,WebFetch",
    // Without this, headless mode refuses every tool call (no one is there to approve it).
    "--allowedTools", "WebSearch,WebFetch",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--mcp-config", JSON.stringify({ mcpServers: {} }),
    "--settings", JSON.stringify({ disableAllHooks: true }),
    "--no-session-persistence",
    "--max-turns", String(o.maxTurns),
    "--json-schema", JSON.stringify(o.schema),
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

export function runHeadless(o: HeadlessOptions): Promise<Transcript> {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "ifcwk-run-"));
  return new Promise((resolve) => {
    const child = spawn(claudeBin(), headlessArgs(o), { cwd, env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.stdin.end(o.prompt);
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
      resolve(readTranscript(raw, code));
    });
  });
}

/**
 * Pull the answer, tool counts and run-level errors out of a stream-json transcript.
 * Never alters the answer. Content validation is the caller's job.
 */
export function readTranscript(raw: unknown[], exitCode: number | null): Transcript {
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
  return { raw, result, content, errors, searches, fetches };
}

export function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
