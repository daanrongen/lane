import { describe, expect, test } from "bun:test";
import type { AgentView, Floor } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";
import { emptyUsage } from "@/domain/run.ts";
import { find, search } from "@/ui/lib/palette.ts";

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

describe("find", () => {
  const floor = {
    feed: [
      {
        touches: [{ _tag: "Host", host: "api.linear.app" }],
      },
    ],
    agents: [],
  } as unknown as Floor;
  const all = [agent("billing", "claude", "working")];

  test("an empty query lists agents only", () => {
    expect(find(floor, all, "")).toEqual([{ agent: all[0] as AgentView }]);
  });

  test("a query finds agents and touched refs, then offers a feed filter", () => {
    const hits = find(floor, all, "linear");
    expect(hits.map((h) => Object.keys(h)[0])).toEqual(["ref", "text"]);
    expect(find(floor, all, "bill").map((h) => Object.keys(h)[0])).toEqual([
      "agent",
      "text",
    ]);
  });
});
