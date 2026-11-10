import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import config from "../../config.json" with { type: "json" };
import type { Edition } from "./types";

const files = import.meta.glob<Edition>("/editions/*.json", { eager: true, import: "default" });

/** All published editions, newest first. */
export const editions: Edition[] = Object.values(files).sort((a, b) => b.edition_date.localeCompare(a.edition_date));

export const latest: Edition | undefined = editions[0];

export function getEdition(date: string): Edition | undefined {
  return editions.find((e) => e.edition_date === date);
}

export { config };

const kingBytes = readFileSync(path.join(process.cwd(), "prompt", "king.md"));
export const kingText = kingBytes.toString("utf8");
export const kingSha = createHash("sha256").update(kingBytes).digest("hex");
export const schemaText = readFileSync(path.join(process.cwd(), "schema", "edition.schema.json"), "utf8");

export const REPO_URL = "https://github.com/cybernetix3d/ifclaudewasking";

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatBillions(n: number | null): string {
  if (n === null) return "Not verified";
  return `US$${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}bn`;
}

/**
 * The model that wrote the answer. Claude Code also routes fetched pages through a smaller
 * helper model, which appears in model_returned; the answering model is the requested one
 * when the API confirms it ran.
 */
export function answeringModel(e: Edition): string {
  return e.meta.model_returned.includes(e.meta.model_requested) ? e.meta.model_requested : e.meta.model_returned.join(", ");
}

export function helperModels(e: Edition): string[] {
  return e.meta.model_returned.filter((m) => m !== answeringModel(e));
}

/** 1 for the first edition ever published, counting up. */
export function editionNumber(e: Edition): number {
  return editions.length - editions.findIndex((x) => x.edition_date === e.edition_date);
}
