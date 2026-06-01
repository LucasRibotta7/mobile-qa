import { appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { scrub } from "./secrets.js";

export function ensureRunDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Append one scrubbed action record to actions.jsonl. */
export function logAction(runDir: string, record: Record<string, unknown>): void {
  const line = scrub(JSON.stringify({ ts: new Date().toISOString(), ...record }));
  appendFileSync(join(runDir, "actions.jsonl"), line + "\n");
}

/** Write the human-facing QA report (caller composes the markdown). */
export function writeReport(runDir: string, markdown: string): string {
  const path = join(runDir, "report.md");
  writeFileSync(path, scrub(markdown));
  return path;
}
