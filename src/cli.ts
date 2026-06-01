import { join } from "node:path";
import process from "node:process";
import type { AppTarget, Platform, SessionState } from "./types.js";
import { loadConfig, resolveApp } from "./config.js";
import { loadState, saveState, clearState, hasState } from "./state.js";
import { ensureAppiumServer, serverReachable, startSession, attachSession } from "./driver/appium.js";
import { resolveDeviceAndCaps, assertPlatformSupported } from "./driver/resolve.js";
import { listAndroidDevices } from "./driver/android.js";
import { listBootedSimulators } from "./driver/ios.js";
import { adbPath, run, which } from "./driver/exec.js";
import { observe } from "./observe.js";
import * as act from "./actions.js";
import { ensureRunDir, logAction } from "./report.js";
import { resolveSecret, mask } from "./secrets.js";
import { startWatch } from "./watch.js";
import { ok, fail, parseArgs, timestamp, projectRoot } from "./util.js";

const argv = process.argv.slice(2);
const [command, sub] = argv;
const { flags } = parseArgs(argv.slice(command === "session" ? 2 : 1));

function str(name: string, fallback = ""): string {
  const v = flags[name];
  return typeof v === "string" ? v : fallback;
}

async function main(): Promise<void> {
  switch (command) {
    case "doctor":
      return doctor();
    case "session":
      if (sub === "start") return sessionStart();
      if (sub === "stop") return sessionStop();
      return fail(`Unknown session subcommand "${sub}". Use start|stop.`);
    case "observe":
      return doObserve();
    case "tap":
      return doTap();
    case "type":
      return doType();
    case "swipe":
      return doSwipe();
    case "back":
      return withSession(async (b) => { await act.back(b as any); logAction(loadState().runDir, { action: "back" }); ok({ action: "back" }); });
    case "launch":
      return withSession(async (b) => { const id = str("id"); await act.launch(b as any, id); ok({ action: "launch", id }); });
    case "terminate":
      return withSession(async (b) => { const id = str("id"); await act.terminate(b as any, id); ok({ action: "terminate", id }); });
    case "watch":
      return doWatch();
    default:
      return fail(`Unknown command "${command}". Use doctor|session|observe|tap|type|swipe|back|launch|terminate|watch.`);
  }
}

async function doctor(): Promise<void> {
  const checks: Record<string, unknown> = {};
  checks.node = process.version;
  checks.platform = process.platform;
  const config = loadConfig();
  checks.appiumServer = (await serverReachable(config.appiumUrl)) ? "reachable" : "not running (will spawn on start)";
  checks.appiumInstalled = (await which(process.env.QA_APPIUM ?? "appium")) ? "yes" : "no — `npm i -g appium` then `appium driver install uiautomator2`";

  // Android
  const adbOk = (await run(adbPath(), ["version"])).code === 0;
  checks.adb = adbOk ? adbPath() : "not found";
  checks.androidDevices = adbOk ? await listAndroidDevices() : [];

  // iOS (only meaningful on macOS)
  if (process.platform === "darwin") {
    checks.xcrun = (await which("xcrun")) ? "yes" : "no — install Xcode";
    checks.idb = (await which("idb")) ? "yes" : "optional — `brew install facebook/fb/idb-companion`";
    checks.bootedSimulators = await listBootedSimulators();
  } else {
    checks.ios = "skipped — iOS automation requires macOS";
  }
  ok({ checks });
}

function resolveAppTarget(config: ReturnType<typeof loadConfig>, appArg: string, platform: Platform): { alias?: string; target: AppTarget } {
  if (/\.(apk|app|ipa)$/i.test(appArg)) return { target: { path: appArg } };
  return { alias: appArg, target: resolveApp(config, appArg, platform) };
}

async function sessionStart(): Promise<void> {
  if (hasState()) return fail("A session is already active. Run `qa session stop` first.");
  const platform = str("platform") as Platform;
  if (platform !== "android" && platform !== "ios") return fail("Pass --platform android|ios");
  const config = loadConfig();
  try {
    assertPlatformSupported(platform);
  } catch (e) {
    return fail((e as Error).message);
  }
  const device = str("device", platform === "android" ? config.android?.defaultDevice ?? "auto" : config.ios?.defaultDevice ?? "auto");
  const appArg = str("app");
  if (!appArg) return fail("Pass --app <alias|path>");

  let target: AppTarget, alias: string | undefined;
  try {
    ({ target, alias } = resolveAppTarget(config, appArg, platform));
  } catch (e) {
    return fail((e as Error).message);
  }

  // Resolve the device first so we fail fast when none is attached,
  // instead of waiting on an Appium server spawn we won't need.
  let resolved;
  try {
    resolved = await resolveDeviceAndCaps(platform, device, target, config);
  } catch (e) {
    return fail((e as Error).message);
  }

  let appiumPid: number | undefined;
  try {
    appiumPid = await ensureAppiumServer(config.appiumUrl);
  } catch (e) {
    return fail((e as Error).message);
  }

  const browser = await startSession(config.appiumUrl, resolved.capabilities);
  const runDir = join(projectRoot, "runs", timestamp());
  ensureRunDir(runDir);

  const state: SessionState = {
    platform,
    appiumUrl: config.appiumUrl,
    sessionId: (browser as unknown as { sessionId: string }).sessionId,
    capabilities: resolved.capabilities,
    appiumPid,
    runDir,
    shotCount: 0,
    device: resolved.device,
    appAlias: alias,
  };
  saveState(state);

  let watchPid: number | undefined;
  if (flags.watch) watchPid = startWatch(state);

  logAction(runDir, { action: "session.start", platform, device: resolved.device, app: alias ?? appArg });
  ok({ sessionId: state.sessionId, device: resolved.device, platform, runDir, watchPid, maxSteps: config.maxSteps });
}

async function withSession(fn: (browser: unknown) => Promise<void>): Promise<void> {
  let state: SessionState;
  try {
    state = loadState();
  } catch (e) {
    return fail((e as Error).message);
  }
  const browser = await attachSession(state);
  await fn(browser);
}

async function doObserve(): Promise<void> {
  const state = loadState();
  const browser = await attachSession(state);
  const observation = await observe(browser as any, state);
  state.shotCount = observation.step;
  saveState(state);
  logAction(state.runDir, { action: "observe", step: observation.step, screenshot: observation.screenshot, elementCount: observation.elements.length });
  ok({ ...observation });
}

function locatorFromFlags(): act.Locator {
  if (typeof flags.id === "string") return { id: flags.id };
  if (typeof flags.text === "string") return { text: flags.text };
  if (typeof flags.x === "string" && typeof flags.y === "string") return { xy: { x: Number(flags.x), y: Number(flags.y) } };
  throw new Error("Pass a locator: --id <accessibilityId> | --text <visibleText> | --x <n> --y <n>");
}

async function doTap(): Promise<void> {
  const state = loadState();
  const browser = await attachSession(state);
  let by: act.Locator;
  try { by = locatorFromFlags(); } catch (e) { return fail((e as Error).message); }
  try {
    await act.tap(browser as any, state.platform, by);
  } catch (e) {
    logAction(state.runDir, { action: "tap", target: by, error: (e as Error).message });
    return fail(`tap failed: ${(e as Error).message}`, { target: by });
  }
  logAction(state.runDir, { action: "tap", target: by });
  ok({ action: "tap", target: by });
}

async function doType(): Promise<void> {
  const state = loadState();
  const browser = await attachSession(state);
  let by: act.Locator;
  try { by = locatorFromFlags(); } catch (e) { return fail((e as Error).message); }

  let value: string;
  let secret = false;
  if (typeof flags.secret === "string") {
    secret = true;
    try { value = resolveSecret(flags.secret); } catch (e) { return fail((e as Error).message); }
  } else if (typeof flags.text === "string" && !by.text) {
    value = flags.text;
  } else if (typeof flags.value === "string") {
    value = flags.value;
  } else {
    return fail("Pass --value <text> or --secret <group.field>");
  }

  try {
    await act.type(browser as any, state.platform, by, value);
  } catch (e) {
    return fail(`type failed: ${(e as Error).message}`);
  }
  logAction(state.runDir, { action: "type", target: by, value: secret ? mask() : value });
  ok({ action: "type", target: by, value: secret ? mask() : value });
}

async function doSwipe(): Promise<void> {
  const state = loadState();
  const browser = await attachSession(state);
  const dir = str("dir") as "up" | "down" | "left" | "right";
  if (!["up", "down", "left", "right"].includes(dir)) return fail("Pass --dir up|down|left|right");
  await act.swipe(browser as any, dir);
  logAction(state.runDir, { action: "swipe", dir });
  ok({ action: "swipe", dir });
}

async function doWatch(): Promise<void> {
  const state = loadState();
  const pid = startWatch(state);
  ok({ action: "watch", pid });
}

async function sessionStop(): Promise<void> {
  if (!hasState()) return ok({ stopped: false, reason: "no active session" });
  const state = loadState();
  try {
    const browser = await attachSession(state);
    await (browser as unknown as { deleteSession(): Promise<void> }).deleteSession();
  } catch {
    // session may already be gone; continue cleanup
  }
  if (state.appiumPid) {
    try { process.kill(state.appiumPid); } catch { /* already dead */ }
  }
  const runDir = state.runDir;
  clearState();
  ok({ stopped: true, runDir });
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
