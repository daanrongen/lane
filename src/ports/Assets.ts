import { Context, Effect, Layer, type Scope } from "effect";
import type { Asset } from "@/domain/assets.ts";
import type { SourceError } from "@/ports/SourceError.ts";

// One owner of setup: a harness, a provider, or a shared folder. `cwd` scopes project-level files.
export interface AssetReader {
  readonly source: string;
  readonly read: (cwd: string) => Effect.Effect<readonly Asset[], SourceError>;
}

export class Assets extends Context.Service<Assets, readonly AssetReader[]>()(
  "Assets",
) {}

export const assetsOf = <E, R>(
  ...all: readonly Effect.Effect<AssetReader, E, R | Scope.Scope>[]
) => Layer.effect(Assets, Effect.all(all));
