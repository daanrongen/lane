import { Effect, Layer } from "effect";
import type { Session } from "@/domain/session.ts";
import { SessionRepository } from "@/ports/SessionRepository.ts";

// Read on every poll, so tests can change what the catalog returns.
export const SessionRepositoryMemory = (read: () => readonly Session[]) =>
  Layer.succeed(SessionRepository, { list: Effect.sync(read) });
