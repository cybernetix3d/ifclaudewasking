import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "../../schema/edition.schema.json" with { type: "json" };
import type { Edition, EditionContent } from "./types";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateEditionFn = ajv.compile(schema);
const validateContentFn = ajv.compile({
  ...schema.definitions.content,
  definitions: schema.definitions,
});

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Checks the JSON Schema can't express: order and cross-references. */
function semanticErrors(c: EditionContent): string[] {
  const errors: string[] = [];
  c.indicators.forEach((ind, i) => {
    if (ind.id !== i + 1) errors.push(`/indicators/${i}: expected id ${i + 1}, got ${ind.id}`);
  });
  const sourceIds = new Set<number>();
  for (const s of c.sources) {
    if (sourceIds.has(s.id)) errors.push(`/sources: duplicate id ${s.id}`);
    sourceIds.add(s.id);
  }
  const checkRefs = (where: string, ids: number[]) => {
    for (const id of ids) if (!sourceIds.has(id)) errors.push(`${where}: source_id ${id} is not in sources`);
  };
  c.indicators.forEach((ind, i) => checkRefs(`/indicators/${i}`, ind.source_ids));
  c.decrees.forEach((d, i) => checkRefs(`/decrees/${i}`, d.source_ids));
  const ranks = new Set<number>();
  c.decrees.forEach((d, i) => {
    if (ranks.has(d.rank)) errors.push(`/decrees/${i}: duplicate rank ${d.rank}`);
    ranks.add(d.rank);
  });
  return errors;
}

function format(errs: typeof validateEditionFn.errors): string[] {
  return (errs ?? []).map((e) => `${e.instancePath || "/"}: ${e.message}`);
}

/** Validate the model's answer on its own (what the runner checks before adding metadata). */
export function validateContent(content: unknown): ValidationResult {
  if (!validateContentFn(content)) return { ok: false, errors: format(validateContentFn.errors) };
  const errors = semanticErrors(content as unknown as EditionContent);
  return { ok: errors.length === 0, errors };
}

/** Validate a full edition file (metadata + content). */
export function validateEdition(edition: unknown): ValidationResult {
  if (!validateEditionFn(edition)) return { ok: false, errors: format(validateEditionFn.errors) };
  const errors = semanticErrors((edition as unknown as Edition).content);
  return { ok: errors.length === 0, errors };
}

const UNSUPPORTED_BY_MODEL = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "pattern", "maxItems"];

/**
 * The content schema in the subset structured output accepts: numeric, string-length and
 * array-length constraints removed (minItems kept only as 0 or 1). The full schema is
 * still enforced locally by validateContent.
 */
export function modelSchema(): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (UNSUPPORTED_BY_MODEL.includes(k)) continue;
        if (k === "minItems") {
          out[k] = Math.min(Number(v), 1);
          continue;
        }
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(schema.definitions.content) as Record<string, unknown>;
}
