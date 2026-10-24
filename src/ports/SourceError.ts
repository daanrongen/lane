import { Data } from "effect";

export class SourceError extends Data.TaggedError("SourceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
