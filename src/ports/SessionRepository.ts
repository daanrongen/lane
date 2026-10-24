import { Context, type Effect } from "effect";
import type { Session } from "@/domain/session.ts";
import type { SourceError } from "@/ports/SourceError.ts";

export class SessionRepository extends Context.Service<
  SessionRepository,
  { readonly list: Effect.Effect<readonly Session[], SourceError> }
>()("SessionRepository") {}
