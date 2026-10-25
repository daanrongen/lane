import type { Thread } from "@/domain/thread.ts";
import { within } from "@/domain/workspace.ts";

// Threads with no process behind them, newest first; of one workspace when given.
export const history = (threads: readonly Thread[], root?: string) =>
  threads
    .filter((t) => t.status === "past" && (!root || within(root, t.cwd)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
