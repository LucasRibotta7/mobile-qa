import type { Platform } from "./types.js";

// Minimal structural type for the bits of the WebdriverIO browser we use.
type El = { waitForExist(o: { timeout: number }): Promise<unknown>; click(): Promise<unknown>; setValue(v: string): Promise<unknown>; clearValue(): Promise<unknown> };
type Browser = {
  $(sel: string): Promise<El> | El;
  getWindowSize(): Promise<{ width: number; height: number }>;
  action(type: string, opts?: unknown): {
    move(o: { x: number; y: number; duration?: number }): any;
    down(): any;
    up(): any;
    pause(ms: number): any;
    perform(): Promise<void>;
  };
  back(): Promise<unknown>;
  activateApp(id: string): Promise<unknown>;
  terminateApp(id: string): Promise<unknown>;
};

export interface Locator {
  id?: string;
  text?: string;
  xy?: { x: number; y: number };
}

function textXPath(platform: Platform, text: string): string {
  const t = text.replace(/"/g, '\\"');
  return platform === "android"
    ? `//*[@text="${t}" or @content-desc="${t}"]`
    : `//*[@label="${t}" or @name="${t}" or @value="${t}"]`;
}

async function find(browser: Browser, platform: Platform, by: Locator): Promise<El> {
  const sel = by.id ? `~${by.id}` : textXPath(platform, by.text!);
  const el = await browser.$(sel);
  await el.waitForExist({ timeout: 8000 });
  return el;
}

async function tapXY(browser: Browser, x: number, y: number): Promise<void> {
  await browser
    .action("pointer", { parameters: { pointerType: "touch" } })
    .move({ x, y, duration: 0 })
    .down()
    .pause(60)
    .up()
    .perform();
}

export async function tap(browser: Browser, platform: Platform, by: Locator): Promise<void> {
  if (by.xy) return tapXY(browser, by.xy.x, by.xy.y);
  const el = await find(browser, platform, by);
  await el.click();
}

export async function type(
  browser: Browser,
  platform: Platform,
  by: Locator,
  value: string,
): Promise<void> {
  const el = await find(browser, platform, by);
  await el.click();
  await el.clearValue().catch(() => {});
  await el.setValue(value);
}

export async function swipe(
  browser: Browser,
  dir: "up" | "down" | "left" | "right",
): Promise<void> {
  const { width, height } = await browser.getWindowSize();
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const dx = Math.round(width * 0.35);
  const dy = Math.round(height * 0.35);
  const from = { x: cx, y: cy };
  const to =
    dir === "up" ? { x: cx, y: cy - dy }
    : dir === "down" ? { x: cx, y: cy + dy }
    : dir === "left" ? { x: cx - dx, y: cy }
    : { x: cx + dx, y: cy };
  await browser
    .action("pointer", { parameters: { pointerType: "touch" } })
    .move({ x: from.x, y: from.y, duration: 0 })
    .down()
    .pause(100)
    .move({ x: to.x, y: to.y, duration: 300 })
    .up()
    .perform();
}

export async function back(browser: Browser): Promise<void> {
  await browser.back();
}

export async function launch(browser: Browser, id: string): Promise<void> {
  await browser.activateApp(id);
}

export async function terminate(browser: Browser, id: string): Promise<void> {
  await browser.terminateApp(id);
}
