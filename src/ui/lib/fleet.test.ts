import { describe, expect, test } from "bun:test";
import type { AgentView, Floor } from "@/domain/floor.ts";
import { AgentRef } from "@/domain/ids.ts";
import { emptyUsage } from "@/domain/run.ts";
import { groups, order, step, stepAttention } from "@/ui/lib/fleet.ts";

const view = (
  thread: string,
  agent: string,
  depth: number,
  workspace = "/w",
  name = agent,
): AgentView => ({
  ref: AgentRef("claude", thread, agent),
  harness: "claude",
  thread,
  origin: "thread",
  workspace,
  depth,
  name,
  state: "working",
  usage: emptyUsage,
  progress: { done: 0, total: 0 },
  modes: {},
  acts: 0,
  failed: 0,
  insights: [],
  lane: [],
});

const agents = [
  view("t2", "main", 0, "/w", "zeta"),
  view("t2", "sub", 1),
  view("t1", "main", 0, "/w", "alpha"),
  view("t3", "main", 0, "/a", "solo"),
];

const floor = {
  workspaces: [
    { root: "/w", agents: agents.slice(0, 3).map((a) => a.ref) },
    { root: "/a", agents: [agents[3]?.ref] },
  ],
  agents,
  attention: [{ agent: agents[2]?.ref, reason: "approval" }],
} as unknown as Floor;

describe("fleet", () => {
  const gs = groups(floor);

  test("workspaces are alphabetical, roots by name, children after their parent", () => {
    expect(gs.map((g) => g.workspace.root)).toEqual(["/a", "/w"]);
    expect(order(gs).map((a) => a.name)).toEqual([
      "solo",
      "alpha",
      "zeta",
      "sub",
    ]);
  });

  test("stepping wraps round and starts at either end", () => {
    const all = order(gs);
    expect(step(all, undefined, 1)).toBe(all[0]);
    expect(step(all, undefined, -1)).toBe(all.at(-1));
    expect(step(all, all.at(-1)?.ref, 1)).toBe(all[0]);
    expect(step(all, all[0]?.ref, -1)).toBe(all.at(-1));
  });

  test("attention stepping skips agents that need nothing", () => {
    const all = order(gs);
    expect(stepAttention(floor, all, undefined, 1)).toBe(agents[2]);
    expect(stepAttention(floor, all, agents[2]?.ref, 1)).toBe(agents[2]);
  });
});
