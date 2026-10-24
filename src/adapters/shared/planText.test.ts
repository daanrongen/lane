import { describe, expect, test } from "bun:test";
import { planItems, statusOf } from "@/adapters/shared/planText.ts";

describe("planItems", () => {
  test("headings are the steps, with numbering and markup stripped", () => {
    const md =
      "# Title\n\n## 1. Domain\ntext\n## Phase 2: `Adapters`\n- not this";
    expect(planItems(md).map((i) => i.title)).toEqual(["Domain", "Adapters"]);
  });

  test("without headings, bullets are the steps", () => {
    expect(planItems("- one\n2. two").map((i) => [i.title, i.status])).toEqual([
      ["one", "next"],
      ["two", "next"],
    ]);
  });

  test("task statuses map onto next, doing and done", () => {
    expect(["pending", "in_progress", "completed", "?"].map(statusOf)).toEqual([
      "next",
      "doing",
      "done",
      "next",
    ]);
  });
});
