import { describe, expect, test } from "bun:test";
import {
  goalStatus,
  payloadTitle,
  taskEvents,
} from "@/adapters/codex/tasks.ts";
import { AgentId } from "@/domain/ids.ts";

describe("codex tasks", () => {
  test("goal statuses map onto next, doing and done", () => {
    expect(
      ["active", "pursuing", "complete", "achieved", "paused"].map(goalStatus),
    ).toEqual(["doing", "doing", "done", "done", "next"]);
  });

  test("a queued item's text is found wherever its payload keeps it", () => {
    expect(payloadTitle('{"text":"fix the build\\nplease"}')).toBe(
      "fix the build",
    );
    expect(payloadTitle('{"content":[{"type":"text","text":"hello"}]}')).toBe(
      "hello",
    );
    expect(payloadTitle("plain")).toBe("plain");
  });

  test("goals and the queue become one task list each, empty ones are skipped", () => {
    const events = taskEvents(
      AgentId("a"),
      3,
      [{ objective: "ship", status: "active" }],
      [],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      _tag: "PlanReported",
      plan: { source: "goal", items: [{ title: "ship", status: "doing" }] },
    });
  });
});
