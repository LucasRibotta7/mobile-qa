---
name: mobile-qa
description: >-
  Agent-driven mobile QA. Given a natural-language flow (e.g. "do the auth flow
  with these credentials") drive a real Android (Windows) or iOS (Mac) device via
  Appium, executing taps/typing and capturing a screenshot at every milestone, then
  write a QA report. Use when asked to QA, smoke-test, or walk a flow on a mobile app.
---

# Mobile QA (agent-driven)

You are the agent that drives the device. You run a closed loop:
**observe → reason → act → re-observe**, capturing screenshots and ending with a report.

The device-control surface is a TypeScript CLI in this project. Call it via Bash:

```
node bin/cli.js <command> [flags]
```

Every command prints **one line of JSON** to stdout. Parse it. `ok:false` means the
step failed — read `error` and adapt; never retry the identical call blindly.

## Before anything: build + preflight

1. If `bin/cli.js` is missing, run `npm install && npm run build` in the project root.
2. Run `node bin/cli.js doctor`. Confirm: Appium installed, the target platform's
   tooling present, and a device available (`androidDevices` non-empty on Windows,
   `bootedSimulators` non-empty on Mac). If something's missing, tell the user exactly
   what to install — do not proceed.

## Starting a run

```
node bin/cli.js session start --platform android|ios --app <alias|path> [--device auto|<udid>] [--watch]
```

- `--app` is an alias from `qa.config.json` (e.g. `list-app`) or a path to `.apk`/`.app`/`.ipa`.
- `--platform ios` only works on macOS; on Windows the CLI refuses it with a clear error.
- `--watch` opens the live mirror (scrcpy on Android, Simulator on Mac) **for the human** —
  you never read from it. Capture comes from the CLI, not the mirror.
- The response gives you `runDir` (where screenshots land) and `maxSteps` (your loop budget).

## The loop

Repeat until the goal is met, you're stuck, or you hit `maxSteps`:

1. `node bin/cli.js observe` → `{ screenshot, step, elements:[{id,text,type,bounds,clickable,secure}] }`.
2. **Read the screenshot** with the Read tool (path = `screenshot`) AND scan `elements`.
   Decide the single next action toward the goal.
3. Act — always prefer the most stable locator available:
   - `node bin/cli.js tap --id <accessibilityId>`   ← preferred (RN `testID`/`accessibilityLabel`)
   - `node bin/cli.js tap --text "<visibleText>"`    ← fallback
   - `node bin/cli.js tap --x <n> --y <n>`           ← last resort (use element `bounds` center)
   - `node bin/cli.js type --id <id> --value "<text>"`
   - `node bin/cli.js type --id <id> --secret <group.field>`   ← credentials (see below)
   - `node bin/cli.js swipe --dir up|down|left|right`
   - `node bin/cli.js back`
4. `observe` again to confirm the state changed as expected. Each `observe` saves a
   numbered milestone screenshot automatically.

**Stuck detection:** if two consecutive observes show the same screen after an action,
stop and report it — don't loop. If you cannot find a control the flow needs, report what
you see rather than guessing coordinates repeatedly.

## Credentials (never handle them in the clear)

- Credentials live in `.qa.secrets.json` (gitignored), grouped by key. You reference them
  by `group.field`, never by value.
- To type a password: `type --id passwordField --secret default_user.password`. The CLI
  resolves the value, types it, and masks it everywhere (stdout, `actions.jsonl`).
- Do **not** print credential values in your messages or the report. If the user pastes a
  credential into chat, ask them to put it in `.qa.secrets.json` instead.

## Finishing

1. Verify the goal's success condition against the final `observe` (expected screen,
   text present, no error banner).
2. Write `report.md` into `runDir` (use the Write tool) with: the goal, each step
   (action + milestone screenshot filename), the pass/fail verdict per assertion, and any
   anomalies. Never include secret values.
3. `node bin/cli.js session stop` to end the Appium session and close any server we spawned.

## Example: "do the auth flow with the default user, confirm it lands on Home"

```
node bin/cli.js doctor
node bin/cli.js session start --platform android --app list-app --watch
node bin/cli.js observe                      # → see login screen, read screenshot
node bin/cli.js tap  --id emailField
node bin/cli.js type --id emailField   --secret default_user.username
node bin/cli.js tap  --id passwordField
node bin/cli.js type --id passwordField --secret default_user.password
node bin/cli.js tap  --id signInButton
node bin/cli.js observe                      # → confirm Home screen + greeting
# write runs/<ts>/report.md, then:
node bin/cli.js session stop
```

The identical flow runs on iOS by changing only `--platform ios` (on a Mac) — locators by
`accessibilityId` resolve on both platforms.
