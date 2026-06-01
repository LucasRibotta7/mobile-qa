import { spawn } from "node:child_process";
import { remote, attach } from "webdriverio";
import type { SessionState } from "../types.js";

type Browser = Awaited<ReturnType<typeof remote>>;

function conn(url: string) {
  const u = new URL(url);
  return {
    protocol: u.protocol.replace(":", "") as "http" | "https",
    hostname: u.hostname,
    port: Number(u.port || (u.protocol === "https:" ? 443 : 4723)),
    path: u.pathname && u.pathname !== "/" ? u.pathname : "/",
  };
}

/** Is an Appium server already answering at this URL? */
export async function serverReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(new URL("/status", url), { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure an Appium server is up. If one is already reachable, do nothing.
 * Otherwise spawn `appium` detached and poll until ready.
 * Returns the spawned PID (so the session can later kill it), or undefined.
 */
export async function ensureAppiumServer(url: string): Promise<number | undefined> {
  if (await serverReachable(url)) return undefined;
  const cmd = process.env.QA_APPIUM ?? "appium";
  const { port, path } = conn(url);
  const child = spawn(cmd, ["--port", String(port), "--base-path", path], {
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  child.unref();

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 750));
    if (await serverReachable(url)) return child.pid;
  }
  throw new Error("Appium server did not become ready within 30s. Is `appium` installed and on PATH?");
}

export async function startSession(
  url: string,
  capabilities: Record<string, unknown>,
): Promise<Browser> {
  const c = conn(url);
  return remote({ ...c, logLevel: "error", capabilities });
}

/** Reattach to an existing session created by a prior CLI invocation. */
export async function attachSession(state: SessionState): Promise<Browser> {
  const c = conn(state.appiumUrl);
  return attach({
    ...c,
    sessionId: state.sessionId,
    capabilities: state.capabilities,
  } as Parameters<typeof attach>[0]);
}
