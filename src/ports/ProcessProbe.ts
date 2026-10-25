import { Context, Effect, Layer } from "effect";
import type { RawProcess } from "@/domain/presence.ts";
import type { SourceError } from "@/ports/SourceError.ts";

// The processes running now whose command matches one of the patterns, with their directories.
export class ProcessProbe extends Context.Service<
  ProcessProbe,
  {
    readonly find: (
      patterns: readonly RegExp[],
    ) => Effect.Effect<readonly RawProcess[], SourceError>;
  }
>()("ProcessProbe") {
  static readonly none = Layer.succeed(ProcessProbe, {
    find: () => Effect.succeed([]),
  });
}
