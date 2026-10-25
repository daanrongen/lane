import { describe, expect, test } from "bun:test";
import { statusOf } from "@/adapters/shared/taskStatus.ts";

describe("statusOf", () => {
  test("task statuses map onto next, doing and done", () => {
    expect(["pending", "in_progress", "completed", "?"].map(statusOf)).toEqual([
      "next",
      "doing",
      "done",
      "next",
    ]);
  });
});
