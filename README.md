# mobile-qa

Agent-driven mobile QA. You give an agent a natural-language flow —
*"do the auth flow with the default user and confirm it lands on Home"* — and it drives a
**real device** (Android on Windows, iOS on Mac), executes the taps/typing, and captures a
screenshot at every milestone, ending with a `report.md`.

The agent is a **Claude Code skill** (`skills/mobile-qa/SKILL.md`). Device control is a
thin TypeScript CLI over **Appium**, so the *same* flow runs on Android and iOS — only the
driver capabilities differ.

## Architecture

Two channels against the same device:

- **Functional** (what the agent consumes): Appium → pixel-perfect screenshot + UI tree +
  tap/type/swipe.
- **Observation** (what *you* watch, optional `--watch`): scrcpy on Android / Simulator on
  Mac. Decorative — the agent never reads from it.

Locators prefer `accessibilityId` (React Native `testID` / `accessibilityLabel`), falling
back to visible text, then coordinates.

## Setup

### Common
```
npm install
npm run build      # compiles src/ → bin/
npm i -g appium
```

### Android (Windows or Mac)
```
appium driver install uiautomator2
```
- A JDK and the Android SDK platform-tools (`adb`). On this machine `adb` is auto-detected
  from the bundled scrcpy copy; otherwise put it on PATH or set `QA_ADB`.
- Start an emulator (AVD) or connect a device with USB debugging.

### iOS (Mac only)
```
appium driver install xcuitest
```
- Xcode + command line tools. Boot a simulator (`xcrun simctl boot <udid>` or open
  Simulator.app). Physical devices need WDA signing — set `xcodeOrgId`/`xcodeSigningId`
  in `qa.config.json`.

### Credentials
```
cp .qa.secrets.json.example .qa.secrets.json   # then fill in real values
```
`.qa.secrets.json` is gitignored. The agent references secrets by `group.field`
(e.g. `default_user.password`) and the CLI masks the value in all output.

## CLI reference

| Command | Purpose |
|---|---|
| `node bin/cli.js doctor` | Check deps + available devices per platform |
| `node bin/cli.js session start --platform android\|ios --app <alias\|path> [--device auto\|<udid>] [--watch]` | Start an Appium session + run dir |
| `node bin/cli.js observe` | Screenshot + simplified UI tree (JSON) |
| `node bin/cli.js tap --id <id> \| --text "<t>" \| --x <n> --y <n>` | Tap |
| `node bin/cli.js type --id <id> --value "<t>" \| --secret <group.field>` | Type text / credential |
| `node bin/cli.js swipe --dir up\|down\|left\|right` | Swipe |
| `node bin/cli.js back \| launch --id <appId> \| terminate --id <appId>` | Nav / app control |
| `node bin/cli.js watch` | Open live mirror |
| `node bin/cli.js session stop` | End session + cleanup |

Artifacts land in `runs/<timestamp>/`: numbered screenshots, `actions.jsonl`, `report.md`.

## Configuration

`qa.config.json` defines the Appium URL, the loop step budget (`maxSteps`), and named app
targets per platform. The `list-app` alias points at the Expo app in `../list-app`.

## Status

- ✅ Scaffold, CLI, doctor, session/observe/actions, secrets, report, watch — built & compiling.
- ⏳ End-to-end run requires Appium + a running emulator/device (not bundled).
- ⏳ iOS path validates only on macOS.
