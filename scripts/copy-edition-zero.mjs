// Copies files the site serves as-is into public/: edition zero and the JSON Schemas.
// The originals in edition-zero/ and schema/ are the source of truth.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/edition-zero", { recursive: true });
cpSync("edition-zero/seven-weeks-as-king.html", "public/edition-zero/seven-weeks-as-king.html");
mkdirSync("public/schema", { recursive: true });
for (const f of ["edition.schema.json", "forecast.schema.json"]) cpSync(`schema/${f}`, `public/schema/${f}`);
