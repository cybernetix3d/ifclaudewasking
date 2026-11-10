// Copies edition zero into public/ so the site serves it. The original in edition-zero/ is the source of truth.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/edition-zero", { recursive: true });
cpSync("edition-zero/seven-weeks-as-king.html", "public/edition-zero/seven-weeks-as-king.html");
