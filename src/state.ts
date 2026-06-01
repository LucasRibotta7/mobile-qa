import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SessionState } from "./types.js";
import { projectRoot } from "./util.js";

const STATE_PATH = join(projectRoot, ".qa-session.json");

export function saveState(state: SessionState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function loadState(): SessionState {
  if (!existsSync(STATE_PATH)) {
    throw new Error("No active session. Run `qa session start` first.");
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as SessionState;
}

export function hasState(): boolean {
  return existsSync(STATE_PATH);
}

export function clearState(): void {
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH);
}
