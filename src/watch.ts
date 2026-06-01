import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { SessionState } from "./types.js";

/**
 * Open the live mirror (observation channel) so the human can watch the agent.
 * Decorative only — the agent never reads from this. Returns the spawned PID.
 */
export function startWatch(state: SessionState): number | undefined {
  if (state.platform === "android") {
    const scrcpy =
      process.env.QA_SCRCPY ??
      (process.platform === "win32" ? "C:\\Users\\Lucas\\Lucas\\end\\end.exe" : "scrcpy");
    const bin = existsSync(scrcpy) ? scrcpy : "scrcpy";
    const child = spawn(bin, ["--serial", state.device, "--window-title", "QA watch"], {
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
