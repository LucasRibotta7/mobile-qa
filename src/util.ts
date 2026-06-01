import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
/** bin/ at runtime → project root is one level up. */
export const projectRoot = resolve(dirname(__filename), "..");

/** Emit a single structured JSON line to stdout (what the agent parses). */
export function emit(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

/** Emit an error result and exit non-zero. */
export function fail(message: string, extra?: Record<string, unknown>): never {
  emit({ ok: false, error: message, ...extra });
  process.exit(1);
}

export function ok<T extends Record<string, unknown>>(obj: T): void {
  emit({ ok: true, ...obj });
}

/** Parse `--flag value` / `--flag` style args into a map + positional list. */
export function parseArgs(argv: string[]): {
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
