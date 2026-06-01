# mobile-qa

Agent-driven mobile QA for **apps you control**. You give an agent a natural-language flow —
*"do the auth flow with the default user and confirm it lands on Home"* — and it **authors a
[Maestro](https://maestro.dev) flow**, runs it on a **real device** (Android on Windows, iOS
on Mac), captures a screenshot at every milestone, and writes a `report.md` — repairing the
flow if it fails.

The agent is a **Claude Code skill** (`skills/mobile-qa/SKILL.md`). Maestro does the actual
driving (taps, waits, retries) far more robustly than tapping a device step-by-step, and the
*same* flow runs on Android and iOS — only `--platform` changes.

## Why Maestro (and when not to)

- **This repo = QA of your own app**: you can add `testID`s and predefine the flow, so
  Maestro's declarative, low-flake YAML is the right tool. Flows are version-controlled and
  CI-friendly.
- **Exploring a third-party app** whose flow you can't predefine needs an adaptive
  observe→act driver instead — a different mode, intentionally out of scope here.

## Architecture

Two channels against the same device:

- **Functional** (what runs the test): Maestro → flow execution + milestone screenshots.
- **Observation** (what *you* watch, optional `--watch`): scrcpy on Android / Simulator on
  Mac. Decorative — the test never reads from it.

Locators prefer `id` (React Native `testID` / `accessibilityLabel`), then visible text.

## Setup

```
npm install
npm run build      # compiles src/ → bin/
```

Install Maestro (needs **Java 17+**):
- macOS / Linux: `curl -fsSL "https://get.maestro.mobile.dev" | bash`
- Windows: see https://docs.maestro.dev/getting-started/installing-maestro/windows
  (native or WSL2). Maestro drives Android over `adb`.

Per platform:
- **Android** (Windows or Mac): a JDK + Android platform-tools (`adb`). On this machine `adb`
  is auto-detected from the bundled scrcpy copy; otherwise put it on PATH or set `QA_ADB`.
  Start an emulator (AVD) or connect a device with USB debugging.
- **iOS** (Mac only): Xcode + command line tools; boot a simulator. Maestro uses idb under
  the hood for iOS.

Credentials:
```
cp .qa.secrets.json.example .qa.secrets.json   # then fill in real values
```
`.qa.secrets.json` is gitignored. Flows reference secrets as env vars (`${USERNAME}`,
`${PASSWORD}`); pass `--creds <group>` at run time and the CLI injects + masks them. No
secret value ever lives in a flow or in git.

## CLI reference

| Command | Purpose |
|---|---|
| `node bin/cli.js doctor` | Check Maestro/Java + available devices per platform |
| `node bin/cli.js run --platform android\|ios --app <alias> --flow <path> [--creds <group>] [--watch]` | Run a Maestro flow, collect screenshots |
| `node bin/cli.js watch --platform android\|ios [--device <udid>]` | Open the live mirror |

Artifacts land in `runs/<timestamp>/`: numbered screenshots, `maestro.log` (scrubbed),
`actions.jsonl`, and the agent-written `report.md`. `run` exits with Maestro's exit code.

## Flows

Authored under `flows/`. See `flows/auth.yaml` (credentials via env) and
`flows/navigate-tabs.yaml` (no-auth smoke test) for the patterns. `qa.config.json` maps app
aliases (e.g. `list-app`) to package/bundle ids per platform and sets `maxRepairs` (the
agent's repair budget).

## Status

- ✅ Maestro runner, CLI (doctor/run/watch), device resolution, secret-as-env injection,
  report scaffolding, watch, example flows — built & compiling.
- ⏳ End-to-end run requires Maestro + a running emulator/device (not bundled).
- ⏳ iOS path validates only on macOS.
