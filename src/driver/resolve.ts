import type { AppTarget, Platform, QaConfig } from "../types.js";
import { resolveAndroidDevice, buildAndroidCaps } from "./android.js";
import { resolveIosDevice, buildIosCaps } from "./ios.js";

/**
 * Guard: iOS automation requires macOS. Android runs anywhere adb runs.
 * Surfaces a clear error instead of a confusing driver failure.
 */
export function assertPlatformSupported(platform: Platform): void {
  if (platform === "ios" && process.platform !== "darwin") {
    throw new Error(
      "iOS automation requires macOS (Xcode + XCUITest). This host is " +
        `${process.platform}. Run iOS targets on a Mac; Android works here.`,
    );
  }
}

export async function resolveDeviceAndCaps(
  platform: Platform,
  requestedDevice: string,
  app: AppTarget,
  config: QaConfig,
): Promise<{ device: string; capabilities: Record<string, unknown> }> {
  assertPlatformSupported(platform);
  if (platform === "android") {
    const device = await resolveAndroidDevice(requestedDevice);
    return { device, capabilities: buildAndroidCaps(device, app) };
  }
  const device = await resolveIosDevice(requestedDevice);
  return { device, capabilities: buildIosCaps(device, app, config) };
}
