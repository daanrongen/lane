import { Context, type Stream } from "effect";
import type { RunEvent } from "@/domain/events.ts";
import type { SessionId } from "@/domain/ids.ts";
import type { SourceError } from "@/ports/SourceError.ts";

// Ends when the session's transcripts are fully read; live sources never end.
export class RunSource extends Context.Service<
  RunSource,
  {
    readonly events: (id: SessionId) => Stream.Stream<RunEvent, SourceError>;
  }
>()("RunSource") {}
