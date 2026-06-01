import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppTarget, Platform, QaConfig } from "./types.js";
import { projectRoot } from "./util.js";

export function loadConfig(): QaConfig {
  const path = join(projectRoot, "qa.config.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as QaConfig;
  return raw;
}

/** Resolve a per-platform app target from a config alias. */
export function resolveApp(
  config: QaConfig,
  alias: string,
  platform: Platform,
): AppTarget {
  const entry = config.apps[alias];
  if (!entry) {
    throw new Error(`Unknown app alias "${alias}". Known: ${Object.keys(config.apps).join(", ")}`);
  }
  // Either a flat AppTarget or a {android,ios} map.
  if ("android" in entry || "ios" in entry) {
    const perPlatform = entry as Record<Platform, AppTarget>;
    const target = perPlatform[platform];
    if (!target) throw new Error(`App "${alias}" has no ${platform} target.`);
    return target;
  }
  return entry as AppTarget;
}
