import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { Command } from "effect/cli";
import { SnapshotLayer } from "@/app/Layers.ts";
import { lane } from "@/cli/root.ts";
import pkg from "../../package.json" with { type: "json" };

// Runs one command and returns the exit status.
export const main = async (argv: readonly string[]) => {
  process.exitCode = 0;
  await Command.runWith(lane, { version: pkg.version })(argv).pipe(
    Effect.provide(SnapshotLayer),
    Effect.provide(BunServices.layer),
    Effect.catch(() =>
      Effect.sync(() => {
        process.exitCode ||= 2;
      }),
    ),
    Effect.runPromise,
  );
  return Number(process.exitCode);
};
