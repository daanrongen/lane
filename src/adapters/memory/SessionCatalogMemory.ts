import { Effect, Layer } from "effect";
import type { Session } from "@/domain/session.ts";
import { SessionCatalog } from "@/ports/SessionCatalog.ts";

// Read on every poll, so tests can change what the catalog returns.
export const SessionCatalogMemory = (read: () => readonly Session[]) =>
  Layer.succeed(SessionCatalog, { list: Effect.sync(read) });
