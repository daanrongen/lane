import type { RunEvent } from "@/domain/events.ts";

export interface Decoder {
  push(line: unknown): RunEvent[];
  // Resolves anything held back since the last line.
  settle(): RunEvent[];
  end(): RunEvent[];
}
