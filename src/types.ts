export type Platform = "android" | "ios";

export interface AppTarget {
  /** Android: appPackage; iOS: bundleId. Used as the flow's appId. */
  id?: string;
  /** Path to an .apk (Android) or .app/.ipa (iOS) to install before running. */
  path?: string;
}

export interface QaConfig {
  /** Max retries the agent should attempt when repairing a failing flow. */
  maxRepairs: number;
  /** Named app targets, keyed by alias (e.g. "list-app"). */
  apps: Record<string, Record<Platform, AppTarget> | AppTarget>;
  android?: { defaultDevice?: string };
  ios?: { defaultDevice?: string };
}
