import { describe, expect, test } from "bun:test";
import type { AgentView } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";
import { emptyUsage } from "@/domain/run.ts";
import { search } from "@/ui/lib/palette.ts";

const agent = (name: string, harness: string, state: AgentView["state"]) =>
  ({
    ref: AgentRef(harness, name, "main"),
    name,
    harness,
    state,
    workspace: "/w/shop",
    model: "gpt-5.5",
    usage: emptyUsage,
  }) as unknown as AgentView;

describe("search", () => {
  const all = [
    agent("button", "codex", "needs-you"),
    agent("billing", "claude", "working"),
  ];

  test("finds agents by name, harness, state, workspace or model", () => {
    expect(search(all, "bill").map((a) => a.name)).toEqual(["billing"]);
    expect(search(all, "codex").map((a) => a.name)).toEqual(["button"]);
    expect(search(all, "needs").map((a) => a.name)).toEqual(["button"]);
    expect(search(all, "shop").length).toBe(2);
    expect(search(all, "gpt").length).toBe(2);
  });

  test("every word must match, and an empty query lists everyone", () => {
    expect(search(all, "claude working").length).toBe(1);
    expect(search(all, "claude needs").length).toBe(0);
    expect(search(all, "  ").length).toBe(2);
  });
});
