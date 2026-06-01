import type { AppTarget } from "../types.js";
import { adbPath, run } from "./exec.js";

/** List attached Android devices/emulators (state == "device"). */
export async function listAndroidDevices(): Promise<string[]> {
  const { stdout } = await run(adbPath(), ["devices"]);
  return stdout
    .split(/\r?\n/)
    .slice(1) // skip "List of devices attached"
    .map((l) => l.trim())
    .filter((l) => l.endsWith("\tdevice"))
    .map((l) => l.split("\t")[0]);
}

/** Resolve a device udid: explicit value, or the single attached one if "auto". */
export async function resolveAndroidDevice(requested: string): Promise<string> {
  if (requested && requested !== "auto") return requested;
  const devices = await listAndroidDevices();
  if (devices.length === 0) {
    throw new Error("No Android device/emulator attached. Start an AVD or connect a device with USB debugging.");
  }
  if (devices.length > 1) {
    throw new Error(`Multiple Android devices attached (${devices.join(", ")}). Pass --device <udid>.`);
  }
  return devices[0];
}

export function buildAndroidCaps(device: string, app: AppTarget): Record<string, unknown> {
  const caps: Record<string, unknown> = {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    "appium:udid": device,
    "appium:newCommandTimeout": 300,
    // Keep typed unicode/secret text working reliably.
    "appium:unicodeKeyboard": true,
    "appium:resetKeyboard": true,
  };
  if (app.path) {
    caps["appium:app"] = app.path;
  } else if (app.id) {
    caps["appium:appPackage"] = app.id;
    if (app.activity) caps["appium:appActivity"] = app.activity;
    else caps["appium:appWaitActivity"] = "*";
  }
  return caps;
}
