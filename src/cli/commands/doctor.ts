import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { Effect } from "effect";
import { Command } from "effect/cli";
import { listThreads } from "@/app/Snapshot.ts";
import { tilde } from "@/cli/commands/shared.ts";
import { emit } from "@/cli/emit.ts";
import { output, plain } from "@/cli/options.ts";
import { Harnesses } from "@/ports/Harness.ts";
import { Runtimes } from "@/ports/Runtimes.ts";
import pkg from "../../../package.json" with { type: "json" };

export interface Check {
  readonly name: string;
  readonly status: "ok" | "warn" | "fail";
  readonly detail: string;
}

const HOMES = [
  ["claude", ".claude"],
  ["codex", ".codex"],
] as const;

export const doctorChecks = Effect.gen(function* () {
  const harnesses = yield* Harnesses;
  const { threads, unreadable } = yield* listThreads(false);
  const models = (yield* (yield* Runtimes).list).flatMap((r) => r.models);
  const checks: Check[] = [
    ...HOMES.map(([id, dir]): Check => {
      const path = `${homedir()}/${dir}`;
      return existsSync(path)
        ? { name: `${id} home`, status: "ok", detail: tilde(path) }
        : {
            name: `${id} home`,
            status: "warn",
            detail: `${tilde(path)} not found`,
          };
    }),
    ...harnesses.map((h): Check => {
      const n = threads.filter((t) => t.harness === h.id).length;
      return unreadable.includes(h.id)
        ? {
            name: `${h.id} threads`,
            status: "fail",
            detail: "cannot list them",
          }
        : { name: `${h.id} threads`, status: "ok", detail: `${n} found` };
    }),
    models.length
      ? { name: "ollama", status: "ok", detail: `${models.length} loaded` }
      : {
          name: "ollama",
          status: "warn",
          detail: "no loaded model, or not reachable",
        },
  ];
  return {
    data: { version: pkg.version, checks },
    lines: [
      `lane ${pkg.version}`,
      ...checks.map((c) => `${c.status.padEnd(4)}  ${c.name}  ${c.detail}`),
    ],
  };
});

export const doctor = Command.make("doctor", { ...output }, (c) =>
  emit(plain(c), doctorChecks, (out) =>
    "lines" in out &&
    (out.data as { checks: Check[] }).checks.some((x) => x.status === "fail")
      ? 1
      : 0,
  ),
).pipe(
  Command.withDescription(
    "Which harness data is found and readable; exits 1 if a harness cannot be listed",
  ),
);
