import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { Platform } from "./types.js";

/**
 * Open the live mirror (observation channel) so the human can watch the run.
 * Decorative only — Maestro/the agent never read from it. Returns the spawned PID.
 */
export function startWatch(platform: Platform, device: string): number | undefined {
  if (platform === "android") {
    const scrcpy =
      process.env.QA_SCRCPY ??
      (process.platform === "win32" ? "C:\\Users\\Lucas\\Lucas\\end\\end.exe" : "scrcpy");
    const bin = existsSync(scrcpy) ? scrcpy : "scrcpy";
    const child = spawn(bin, ["--serial", device, "--window-title", "QA watch"], {
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    child.unref();
    return child.pid;
  }
  // iOS: the Simulator window already shows actions live. Just bring it forward.
  if (process.platform === "darwin") {
    const child = spawn("open", ["-a", "Simulator"], { detached: true, stdio: "ignore" });
    child.unref();
    return child.pid;
  }
  return undefined;
}
