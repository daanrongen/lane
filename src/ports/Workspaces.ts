import { Context, Effect, Layer } from "effect";
import type { Workspace } from "@/domain/workspace.ts";

// Which workspace a directory belongs to.
export class Workspaces extends Context.Service<
  Workspaces,
  { readonly of: (cwd: string) => Effect.Effect<Workspace> }
>()("Workspaces") {
  // Every directory is its own workspace.
  static readonly flat = Layer.succeed(Workspaces, {
    of: (cwd) => Effect.succeed({ root: cwd }),
  });
}
