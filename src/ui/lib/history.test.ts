import { describe, expect, test } from "bun:test";
import { ThreadId } from "@/domain/ids.ts";
import type { Thread } from "@/domain/thread.ts";
import { history } from "@/ui/lib/history.ts";

const thread = (
  id: string,
  cwd: string,
  status: Thread["status"],
  updatedAt: number,
): Thread => ({
  harness: "claude",
  id: ThreadId(id),
  cwd,
  status,
  updatedAt,
});

const all = [
  thread("a", "/w", "past", 1),
  thread("b", "/w/sub", "past", 3),
  thread("c", "/w", "busy", 4),
  thread("d", "/x", "past", 2),
];

describe("history", () => {
  test("past threads, newest first", () => {
    expect(history(all).map((t) => t.id)).toEqual(
      ["b", "d", "a"].map(ThreadId),
    );
  });

  test("a workspace keeps its own, folders below it included", () => {
    expect(history(all, "/w").map((t) => t.id)).toEqual(
      ["b", "a"].map(ThreadId),
    );
  });
});
