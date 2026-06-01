import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Observation, Platform, SessionState, UiElement } from "./types.js";

type Browser = { saveScreenshot(p: string): Promise<unknown>; getPageSource(): Promise<string> };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
});

interface PreservedNode {
  ":@"?: Record<string, string>;
  [tag: string]: unknown;
}

/** Parse Android bounds string "[x1,y1][x2,y2]" into a rect. */
function parseAndroidBounds(b?: string): UiElement["bounds"] {
  if (!b) return undefined;
  const m = b.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return undefined;
  const [, x1, y1, x2, y2] = m.map(Number);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function androidElement(attrs: Record<string, string>): UiElement | null {
  const cls = attrs["class"] ?? "node";
  const id = attrs["content-desc"] || attrs["resource-id"] || undefined;
  const text = attrs["text"] || undefined;
  if (!id && !text && attrs["clickable"] !== "true") return null; // prune noise
  return {
    id,
    text,
    type: cls.split(".").pop() ?? cls,
    bounds: parseAndroidBounds(attrs["bounds"]),
    clickable: attrs["clickable"] === "true",
    focused: attrs["focused"] === "true",
    secure: attrs["password"] === "true",
  };
}

function iosElement(attrs: Record<string, string>): UiElement | null {
  const type = (attrs["type"] ?? "").replace("XCUIElementType", "") || "Other";
  const id = attrs["name"] || undefined;
  const text = attrs["label"] || attrs["value"] || undefined;
  const clickable = /Button|Cell|Link|Switch|TextField|StaticText/.test(type);
  if (!id && !text && !clickable) return null;
  const x = Number(attrs["x"]), y = Number(attrs["y"]);
  const w = Number(attrs["width"]), h = Number(attrs["height"]);
  return {
    id,
    text,
    type,
    bounds: Number.isFinite(x) ? { x, y, width: w, height: h } : undefined,
    clickable,
    secure: type === "SecureTextField",
  };
}

function walk(nodes: PreservedNode[], platform: Platform, out: UiElement[]): void {
  for (const node of nodes) {
    const tag = Object.keys(node).find((k) => k !== ":@");
    if (!tag) continue;
    const attrs = node[":@"] ?? {};
    const el = platform === "android" ? androidElement(attrs) : iosElement(attrs);
    if (el) out.push(el);
    const children = node[tag] as PreservedNode[];
    if (Array.isArray(children)) walk(children, platform, out);
  }
}

export async function observe(browser: Browser, state: SessionState): Promise<Observation> {
  const step = state.shotCount + 1;
  const screenshot = join(state.runDir, `${String(step).padStart(3, "0")}.png`);
  await browser.saveScreenshot(screenshot);
  const xml = await browser.getPageSource();
  const tree = parser.parse(xml) as PreservedNode[];
  const elements: UiElement[] = [];
  walk(tree, state.platform, elements);
  return { screenshot, step, elements };
}
