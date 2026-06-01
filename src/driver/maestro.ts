import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { which } from "./exec.js";

export function maestroCmd(): string {
  return process.env.QA_MAESTRO ?? "maestro";
}

export async function maestroInstalled(): Promise<boolean> {
  const cmd = maestroCmd();
  // QA_MAESTRO may be an explicit path (e.g. the Windows .bat) — verify directly.
  if (isAbsolute(cmd)) return existsSync(cmd);
  return which(cmd);
}

export interface RunFlowOptions {
  device: string;
  flowPath: string;
  /** Credentials/params injected as `--env KEY=VALUE`; never written to YAML. */
  env: Record<string, string>;
  /** Working dir for the run; `takeScreenshot` lands here, plus debug output. */
  runDir: string;
}

export interface RunFlowResult {
  code: number;
  stdout: string;
  stderr: string;
  screenshots: string[];
}

/**
 * Execute a Maestro flow against a resolved device.
 * Runs with cwd=runDir so `takeScreenshot: <name>` lands in the run folder,
 * and points --debug-output at runDir/debug for failure artifacts.
 */
export function runFlow(opts: RunFlowOptions): Promise<RunFlowResult> {
  const args = ["test", "--device", opts.device, "--debug-output", join(opts.runDir, "debug")];
  for (const [k, v] of Object.entries(opts.env)) args.push("--env", `${k}=${v}`);
  args.push(opts.flowPath);

  return new Promise((resolve) => {
    const child = spawn(maestroCmd(), args, {
      cwd: opts.runDir,
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      let screenshots: string[] = [];
      try {
        screenshots = readdirSync(opts.runDir)
          .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
          .map((f) => join(opts.runDir, f));
      } catch {
        /* runDir may be empty */
      }
      resolve({ code: code ?? 1, stdout, stderr, screenshots });
    });
    child.on("error", (err) => {
      resolve({ code: 127, stdout, stderr: stderr + String(err), screenshots: [] });
    });
  });
}
