export type Platform = "android" | "ios";

export interface AppTarget {
  /** Android: appPackage; iOS: bundleId. Optional if `appPath` is given. */
  id?: string;
  /** Android: appActivity to launch (optional, autodetected if omitted). */
  activity?: string;
  /** Path to an .apk (Android) or .app/.ipa (iOS) to install before running. */
  path?: string;
}

export interface QaConfig {
  /** Appium server URL. If unreachable, the CLI spawns one. */
  appiumUrl: string;
  /** Max observe→act iterations the agent loop should run. */
  maxSteps: number;
  /** Named app targets, keyed by alias (e.g. "list-app"). */
  apps: Record<string, Record<Platform, AppTarget> | AppTarget>;
  android?: { defaultDevice?: string };
  ios?: {
    defaultDevice?: string;
    /** Required for physical iOS devices (WDA signing). */
    xcodeOrgId?: string;
    xcodeSigningId?: string;
  };
}

/** Persisted between separate CLI process invocations so commands can reattach. */
export interface SessionState {
  platform: Platform;
  appiumUrl: string;
  sessionId: string;
  capabilities: Record<string, unknown>;
  /** PID of an Appium server spawned by us (so `session stop` can kill it). */
  appiumPid?: number;
  /** Directory for this run's artifacts (runs/<ts>/). */
  runDir: string;
  /** Monotonic counter for milestone screenshots. */
  shotCount: number;
  device: string;
  appAlias?: string;
}

export interface UiElement {
  /** Stable locator: accessibility id (RN testID / accessibilityLabel). */
  id?: string;
  text?: string;
  type: string;
  bounds?: { x: number; y: number; width: number; height: number };
  clickable: boolean;
  focused?: boolean;
  /** True for password / secureTextEntry fields. */
  secure?: boolean;
}

export interface Observation {
  screenshot: string;
  step: number;
  elements: UiElement[];
}
