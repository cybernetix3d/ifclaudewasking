import { describe, expect, it } from "vitest";
import { findLeaks, homeVariants, sanitizeTranscript, SANITIZE_NOTE } from "../src/lib/sanitize";

const home = "C:\\Users\\someone";
const transcript = [
  { type: "system", subtype: "init", cwd: `${home}\\AppData\\Local\\Temp\\run`, original_cwd: `${home}\\x`, scratchpad_path: `${home}\\y`, powershell_path: "C:\\Windows\\ps.exe", additional_directories: [], model: "m", tools: ["WebSearch"] },
  { type: "assistant", message: { content: [{ type: "text", text: "Answer text stays exactly as is." }] } },
  { type: "rate_limit_event", rate_limit_info: { utilization: 0.4 } },
  { type: "result", subtype: "success", result: "{}", structured_output: { a: 1 } },
  { stderr: `warning at ${home}` },
];

describe("sanitizeTranscript", () => {
  const out = sanitizeTranscript(transcript) as any[];

  it("removes local paths from the init event but keeps the rest", () => {
    const init = out.find((e) => e.subtype === "init");
    for (const f of ["cwd", "original_cwd", "scratchpad_path", "powershell_path", "additional_directories"]) expect(init).not.toHaveProperty(f);
    expect(init.model).toBe("m");
    expect(init.tools).toEqual(["WebSearch"]);
  });

  it("drops rate-limit events and stderr", () => {
    expect(out.some((e) => e.type === "rate_limit_event")).toBe(false);
    expect(out.some((e) => "stderr" in e)).toBe(false);
  });

  it("leaves model output untouched", () => {
    expect(out[1]).toBe(transcript[1]);
    expect(out.find((e) => e.type === "result")).toBe(transcript[3]);
  });

  it("appends a note and leaves no home path behind", () => {
    expect(out.at(-1)).toEqual(SANITIZE_NOTE);
    expect(findLeaks(out, [home])).toEqual([]);
    expect(findLeaks(transcript, [home])).toEqual([home]);
  });

  it("replaces the home folder in tool results only", () => {
    const events = [
      { type: "user", message: { content: [{ type: "tool_result", content: `PDF also saved to ${home}\\.claude\\x.pdf` }] } },
      { type: "user", tool_use_result: { note: "C:/Users/someone/.claude/y.pdf" } },
    ];
    const clean = sanitizeTranscript(events, home) as any[];
    expect(clean[0].message.content[0].content).toBe("PDF also saved to ~\\.claude\\x.pdf");
    expect(clean[1].tool_use_result.note).toBe("~/.claude/y.pdf");
    expect(findLeaks(clean, [home])).toEqual([]);
    expect(events[0].message!.content[0].content).toContain(home);
  });

  it("also catches the folder-name slug of the home path", () => {
    const events = [{ type: "user", message: { content: "saved to C--Users-someone-AppData-Local-Temp-run/x.pdf" } }];
    const clean = sanitizeTranscript(events, home) as any[];
    expect(clean[0].message.content).toBe("saved to ~-AppData-Local-Temp-run/x.pdf");
    expect(findLeaks(clean, homeVariants(home))).toEqual([]);
  });

  it("does not modify its input", () => {
    expect((transcript[0] as any).cwd).toBeDefined();
  });
});
