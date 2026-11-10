/**
 * Removes machine and account details from a Claude Code stream-json transcript before it is
 * published. Model output (assistant messages, tool results, the final result text and
 * structured output) is never changed.
 *
 * Removed:
 *  - local paths in the init event (cwd, original_cwd, scratchpad_path, powershell_path,
 *    additional_directories)
 *  - rate_limit_event entries (subscription usage and limits)
 *  - stderr from the CLI
 *  - the home-folder prefix in tool results (web fetch notes where it cached a PDF, e.g.
 *    "saved to C:\Users\<name>\.claude\..."), replaced with "~"
 * A note listing what was removed is appended as the last event.
 */
const INIT_PATH_FIELDS = ["cwd", "original_cwd", "scratchpad_path", "powershell_path", "additional_directories"];

export const SANITIZE_NOTE = {
  type: "ifclaudewasking_note",
  note: "Machine and account details were removed before publishing: local paths in the init event, rate-limit events (subscription usage), CLI stderr, and the home-folder prefix in tool results (replaced with ~). The model's own messages and answer are unchanged.",
};

function replaceDeep(value: unknown, from: string[], to: string): unknown {
  if (typeof value === "string") return from.reduce((s, f) => s.split(f).join(to), value);
  if (Array.isArray(value)) return value.map((v) => replaceDeep(v, from, to));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceDeep(v, from, to)]));
  return value;
}

/**
 * The ways a home folder shows up in Claude Code output: native path, forward-slash path, and
 * the slug Claude Code uses for folder names (every non-alphanumeric becomes "-", so
 * C:\Users\name -> C--Users-name).
 */
export function homeVariants(home: string): string[] {
  return [...new Set([home, home.replace(/\\/g, "/"), home.replace(/[^A-Za-z0-9]/g, "-")])].sort((a, b) => b.length - a.length);
}

export function sanitizeTranscript(events: unknown[], home?: string): unknown[] {
  const homeForms = home ? homeVariants(home) : [];
  const out: unknown[] = [];
  for (const ev of events as any[]) {
    if (ev && typeof ev === "object") {
      if (ev.type === "rate_limit_event") continue;
      if ("stderr" in ev && Object.keys(ev).length === 1) continue;
      if (ev.type === "system" && ev.subtype === "init") {
        const copy = { ...ev };
        for (const f of INIT_PATH_FIELDS) delete copy[f];
        out.push(copy);
        continue;
      }
      // Tool results arrive as "user" events. Only these get the home-folder prefix replaced.
      if (ev.type === "user" && homeForms.length > 0) {
        out.push(replaceDeep(ev, homeForms, "~"));
        continue;
      }
    }
    out.push(ev);
  }
  out.push(SANITIZE_NOTE);
  return out;
}

/** Any of `needles` still present anywhere in the transcript (case-insensitive). */
export function findLeaks(events: unknown[], needles: string[]): string[] {
  const text = JSON.stringify(events).toLowerCase().replace(/\\\\/g, "/");
  return needles.filter((n) => n && text.includes(n.toLowerCase().replace(/\\/g, "/")));
}
