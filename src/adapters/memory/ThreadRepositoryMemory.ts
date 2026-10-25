import { Effect, Layer } from "effect";
import type { Thread } from "@/domain/thread.ts";
import { ThreadRepository } from "@/ports/ThreadRepository.ts";

// Read on every poll, so tests can change what the catalog returns.
export const ThreadRepositoryMemory = (read: () => readonly Thread[]) =>
  Layer.succeed(ThreadRepository, { list: Effect.sync(read) });
