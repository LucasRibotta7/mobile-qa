import { isAbsolute, join, resolve as resolvePath } from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import process from "node:process";
import type { Platform } from "./types.js";
import { loadConfig, resolveApp } from "./config.js";
import { resolveDevice, assertPlatformSupported } from "./driver/resolve.js";
import { listAndroidDevices } from "./driver/android.js";
import { listBootedSimulators } from "./driver/ios.js";
import { adbPath, run, which } from "./driver/exec.js";
import { maestroCmd, maestroInstalled, runFlow } from "./driver/maestro.js";
import { ensureRunDir, logAction } from "./report.js";
import { secretsAsEnv } from "./secrets.js";
import { scrub } from "./secrets.js";
import { startWatch } from "./watch.js";
import { ok, fail, parseArgs, timestamp, projectRoot } from "./util.js";

const argv = process.argv.slice(2);
const command = argv[0];
const { flags } = parseArgs(argv.slice(1));

function str(name: string, fallback = ""): string {
  const v = flags[name];
  return typeof v === "string" ? v : fallback;
}

async function main(): Promise<void> {
  switch (command) {
    case "doctor":
      return doctor();
    case "run":
      return doRun();
    case "watch":
      return doWatch();
    default:
      return fail(`Unknown command "${command}". Use doctor|run|watch.`);
  }
}

async function doctor(): Promise<void> {
  const checks: Record<string, unknown> = {};
  checks.node = process.version;
  checks.platform = process.platform;
  checks.maestro = (await maestroInstalled())
    ? maestroCmd()
    : 'not found — install from https://maestro.dev (needs Java 17+)';
  checks.java = (await which("java")) ? "yes" : "no — Maestro needs Java 17+";

  const adbOk = (await run(adbPath(), ["version"])).code === 0;
  checks.adb = adbOk ? adbPath() : "not found";
  checks.androidDevices = adbOk ? await listAndroidDevices() : [];

  if (process.platform === "darwin") {
    checks.xcrun = (await which("xcrun")) ? "yes" : "no — install Xcode";
    checks.bootedSimulators = await listBootedSimulators();
  } else {
    checks.ios = "skipped — iOS automation requires macOS";
  }
  ok({ checks });
}

async function doRun(): Promise<void> {
  const platform = str("platform") as Platform;
  if (platform !== "android" && platform !== "ios") return fail("Pass --platform android|ios");

  const config = loadConfig();
  try {
    assertPlatformSupported(platform);
  } catch (e) {
    return fail((e as Error).message);
  }

  const flowArg = str("flow");
  if (!flowArg) return fail("Pass --flow <path-to-yaml>");
  const flowPath = isAbsolute(flowArg) ? flowArg : resolvePath(projectRoot, flowArg);
  if (!existsSync(flowPath)) return fail(`Flow not found: ${flowPath}`);

  // App alias is optional here (the flow declares its own appId) but we validate it.
  const appArg = str("app");
  if (appArg) {
    try {
      resolveApp(config, appArg, platform);
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  const requested = str("device", platform === "android"
    ? config.android?.defaultDevice ?? "auto"
    : config.ios?.defaultDevice ?? "auto");
  let device: string;
  try {
    device = await resolveDevice(platform, requested);
  } catch (e) {
    return fail((e as Error).message);
  }

  if (!(await maestroInstalled())) {
    return fail("Maestro not installed. Install from https://maestro.dev (needs Java 17+).");
  }

  // Credentials → env (UPPERCASE). Never written to the flow YAML or git.
  let env: Record<string, string> = {};
  const creds = str("creds");
  if (creds) {
    try {
      env = secretsAsEnv(creds);
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  const runDir = join(projectRoot, "runs", timestamp());
  ensureRunDir(runDir);

  let watchPid: number | undefined;
  if (flags.watch) watchPid = startWatch(platform, device);

  logAction(runDir, { action: "run.start", platform, device, flow: flowArg, app: appArg || undefined });

  const result = await runFlow({ device, flowPath, env, runDir });

  // Persist a scrubbed combined log for inspection.
  writeFileSync(join(runDir, "maestro.log"), scrub(result.stdout + "\n--- stderr ---\n" + result.stderr));
  logAction(runDir, { action: "run.finish", exitCode: result.code, screenshots: result.screenshots.length });

  const passed = result.code === 0;
  const payload = {
    ok: passed,
    exitCode: result.code,
    runDir,
    screenshots: result.screenshots,
    watchPid,
    logTail: scrub(result.stdout.split(/\r?\n/).slice(-20).join("\n")),
  };
  process.stdout.write(JSON.stringify(passed ? payload : { ...payload, error: "Maestro flow failed" }) + "\n");
  process.exit(result.code);
}

async function doWatch(): Promise<void> {
  const platform = str("platform") as Platform;
  if (platform !== "android" && platform !== "ios") return fail("Pass --platform android|ios");
  let device: string;
  try {
    device = await resolveDevice(platform, str("device", "auto"));
  } catch (e) {
    return fail((e as Error).message);
  }
  const pid = startWatch(platform, device);
  ok({ action: "watch", device, pid });
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
