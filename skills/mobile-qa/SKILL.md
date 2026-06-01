---
name: mobile-qa
description: >-
  Agent-driven mobile QA for your own app via Maestro. Given a natural-language flow
  (e.g. "do the auth flow with the default user"), author a Maestro YAML flow, run it on a
  real Android (Windows) or iOS (Mac) device, capture screenshots per milestone, and write
  a QA report — repairing the flow if it fails. Use when asked to QA, smoke-test, or
  regression-check a flow on a mobile app whose source you control.
---

# Mobile QA (Maestro, agent-authored flows)

Your job is to turn a natural-language goal into a **Maestro flow**, run it, and verify the
result. The intelligence is in *authoring and repairing the YAML* — Maestro handles the
actual taps, waits, and retries far more reliably than driving the device tap-by-tap.

The runner is a thin TypeScript CLI. Call it via Bash:

```
node bin/cli.js <command> [flags]
```

Each command prints **one line of JSON** to stdout. `run` also exits with Maestro's exit
code (0 = passed). Parse the JSON; on failure read `logTail` and the screenshots, then fix
the flow — never re-run an unchanged failing flow.

## Before anything: build + preflight

1. If `bin/cli.js` is missing: `npm install && npm run build`.
2. `node bin/cli.js doctor`. Confirm: `maestro` installed, `java` present, and a device
   available (`androidDevices` non-empty on Windows / `bootedSimulators` on Mac). If
   something's missing, tell the user exactly what to install — do not proceed.

## Authoring the flow

Write a YAML file under `flows/<name>.yaml`. Structure:

```yaml
appId: com.your.app          # the package (Android) / bundleId (iOS)
---
- launchApp:
    clearState: true
- takeScreenshot: 001_start  # capture a milestone — numbered, descriptive
- tapOn:
    id: "signInButton"       # prefer id (RN testID); else visible text: tapOn: "Sign in"
- inputText: ${USERNAME}     # credentials are env vars, never literals (see below)
- assertVisible: "Home"      # the success condition
```

Guidance:
- **Capture liberally**: a `takeScreenshot` before and after each meaningful state change.
  Numbered names sort in order and land in the run folder automatically.
- **Locators**: prefer `id:` (React Native `testID` / `accessibilityLabel`); fall back to
  visible text; use `point:` only as a last resort.
- **Assertions** encode the goal's success condition (`assertVisible`, `assertNotVisible`).
  For fuzzy checks you can use Maestro's `assertWithAI`.
- The **same flow runs on both platforms** — only `--platform` changes at run time.
- If you need to discover real selectors, tell the user to run `maestro studio` (interactive)
  — it's a human-driven tool, not something you launch from here.

## Credentials (never in the YAML)

- Secrets live in `.qa.secrets.json` (gitignored), grouped by key. In the flow you reference
  them as env vars: `${USERNAME}`, `${PASSWORD}` (a group's fields, uppercased).
- At run time pass `--creds <group>`; the CLI injects the values as Maestro `--env` and masks
  them in the saved log. The YAML stays secret-free and commit-safe.
- Never print credential values in messages or the report.

## Running

```
node bin/cli.js run --platform android|ios --app <alias> --flow flows/<name>.yaml [--creds <group>] [--watch]
```

- `--watch` opens the live mirror (scrcpy on Android, Simulator on Mac) **for the human**.
- Response: `{ ok, exitCode, runDir, screenshots:[...], logTail }`. Screenshots and a
  scrubbed `maestro.log` land in `runDir` (`runs/<timestamp>/`).

## The loop

1. Author `flows/<name>.yaml` from the goal.
2. `run` it.
3. If `ok:false`: Read `logTail` and the screenshots (Read tool) to see where it broke
   (wrong selector, missing wait, unexpected screen). **Fix the YAML** and re-run. Repeat up
   to `maxRepairs` (from `qa.config.json`), then stop and report what's blocking.
4. On `ok:true`: Read the milestone screenshots, confirm the success assertion really
   reflects the goal, and write `report.md` into `runDir` (Write tool): the goal, each
   milestone (screenshot filename), the verdict, and any anomalies. No secret values.

## Example: "do the auth flow with the default user, confirm it lands on Home"

```
node bin/cli.js doctor
# author flows/auth.yaml (see flows/auth.yaml for the template)
node bin/cli.js run --platform android --app list-app --flow flows/auth.yaml --creds default_user --watch
# read runs/<ts>/*.png, verify "Home" reached, write runs/<ts>/report.md
```

> Scope: this skill QAs apps **you control** (you can add `testID`s and predefine the flow).
> For exploring a third-party app whose flow you can't predefine, a live observe→act driver
> is the right tool instead — that's a separate mode, not this one.
