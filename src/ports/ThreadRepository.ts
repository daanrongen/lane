import { Context, type Effect } from "effect";
import type { Thread } from "@/domain/thread.ts";
import type { SourceError } from "@/ports/SourceError.ts";

export class ThreadRepository extends Context.Service<
  ThreadRepository,
  { readonly list: Effect.Effect<readonly Thread[], SourceError> }
>()("ThreadRepository") {}
