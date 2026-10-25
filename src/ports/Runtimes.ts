import { Context, Effect, Layer } from "effect";
import type { Runtime } from "@/domain/runtime.ts";

// What agents run on right now, such as the models an Ollama server has loaded.
export class Runtimes extends Context.Service<
  Runtimes,
  { readonly list: Effect.Effect<readonly Runtime[]> }
>()("Runtimes") {
  static readonly none = Layer.succeed(Runtimes, {
    list: Effect.succeed([]),
  });
}
